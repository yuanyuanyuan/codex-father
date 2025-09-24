// Based on reference implementation from
// https://cookbook.openai.com/examples/gpt4-1_prompting_guide#reference-implementation-apply_patchpy

import fs from "fs";
import path from "path";
import {
  ADD_FILE_PREFIX,
  DELETE_FILE_PREFIX,
  END_OF_FILE_PREFIX,
  MOVE_FILE_TO_PREFIX,
  PATCH_SUFFIX,
  UPDATE_FILE_PREFIX,
  HUNK_ADD_LINE_PREFIX,
  PATCH_PREFIX,
} from "src/parse-apply-patch";

// -----------------------------------------------------------------------------
// Types & Models
// -----------------------------------------------------------------------------

export enum ActionType {
  ADD = "add",
  DELETE = "delete",
  UPDATE = "update",
}

export interface FileChange {
  type: ActionType;
  old_content?: string | null;
  new_content?: string | null;
  move_path?: string | null;
}

export interface Commit {
  changes: Record<string, FileChange>;
}

export function assemble_changes(
  orig: Record<string, string | null>,
  updatedFiles: Record<string, string | null>,
): Commit {
  const commit: Commit = { changes: {} };
  for (const [p, newContent] of Object.entries(updatedFiles)) {
    const oldContent = orig[p];
    if (oldContent === newContent) {
      continue;
    }
    if (oldContent !== undefined && newContent !== undefined) {
      commit.changes[p] = {
        type: ActionType.UPDATE,
        old_content: oldContent,
        new_content: newContent,
      };
    } else if (newContent !== undefined) {
      commit.changes[p] = {
        type: ActionType.ADD,
        new_content: newContent,
      };
    } else if (oldContent !== undefined) {
      commit.changes[p] = {
        type: ActionType.DELETE,
        old_content: oldContent,
      };
    } else {
      throw new Error("Unexpected state in assemble_changes");
    }
  }
  return commit;
}

// -----------------------------------------------------------------------------
// Patch‑related structures
// -----------------------------------------------------------------------------

export interface Chunk {
  orig_index: number; // line index of the first line in the original file
  del_lines: Array<string>;
  ins_lines: Array<string>;
}

export interface PatchAction {
  type: ActionType;
  new_file?: string | null;
  chunks: Array<Chunk>;
  move_path?: string | null;
}

export interface Patch {
  actions: Record<string, PatchAction>;
}

export class DiffError extends Error {}

// -----------------------------------------------------------------------------
// Parser (patch text -> Patch)
// -----------------------------------------------------------------------------

class Parser {
  current_files: Record<string, string>;
  lines: Array<string>;
  index = 0;
  patch: Patch = { actions: {} };
  fuzz = 0;

  constructor(currentFiles: Record<string, string>, lines: Array<string>) {
    this.current_files = currentFiles;
    this.lines = lines;
  }

  private is_done(prefixes?: Array<string>): boolean {
    if (this.index >= this.lines.length) {
      return true;
    }
    if (
      prefixes &&
      prefixes.some((p) => this.lines[this.index]!.startsWith(p.trim()))
    ) {
      return true;
    }
    return false;
  }

  private startswith(prefix: string | Array<string>): boolean {
    const prefixes = Array.isArray(prefix) ? prefix : [prefix];
    return prefixes.some((p) => this.lines[this.index]!.startsWith(p));
  }

  private read_str(prefix = "", returnEverything = false): string {
    if (this.index >= this.lines.length) {
      throw new DiffError(`Index: ${this.index} >= ${this.lines.length}`);
    }
    if (this.lines[this.index]!.startsWith(prefix)) {
      const text = returnEverything
        ? this.lines[this.index]
        : this.lines[this.index]!.slice(prefix.length);
      this.index += 1;
      return text ?? "";
    }
    return "";
  }

  parse(): void {
    while (!this.is_done([PATCH_SUFFIX])) {
      let path = this.read_str(UPDATE_FILE_PREFIX);
      if (path) {
        if (this.patch.actions[path]) {
          throw new DiffError(`Update File Error: Duplicate Path: ${path}`);
        }
        const moveTo = this.read_str(MOVE_FILE_TO_PREFIX);
        if (!(path in this.current_files)) {
          throw new DiffError(`Update File Error: Missing File: ${path}`);
        }
        const text = this.current_files[path];
        const action = this.parse_update_file(text ?? "");
        action.move_path = moveTo || undefined;
        this.patch.actions[path] = action;
        continue;
      }
      path = this.read_str(DELETE_FILE_PREFIX);
      if (path) {
        if (this.patch.actions[path]) {
          throw new DiffError(`Delete File Error: Duplicate Path: ${path}`);
        }
        if (!(path in this.current_files)) {
          throw new DiffError(`Delete File Error: Missing File: ${path}`);
        }
        this.patch.actions[path] = { type: ActionType.DELETE, chunks: [] };
        continue;
      }
      path = this.read_str(ADD_FILE_PREFIX);
      if (path) {
        if (this.patch.actions[path]) {
          throw new DiffError(`Add File Error: Duplicate Path: ${path}`);
        }
        if (path in this.current_files) {
          throw new DiffError(`Add File Error: File already exists: ${path}`);
        }
        this.patch.actions[path] = this.parse_add_file();
        continue;
      }
      throw new DiffError(`Unknown Line: ${this.lines[this.index]}`);
    }
    if (!this.startswith(PATCH_SUFFIX.trim())) {
      throw new DiffError("Missing End Patch");
    }
    this.index += 1;
  }

  private parse_update_file(text: string): PatchAction {
    const action: PatchAction = { type: ActionType.UPDATE, chunks: [] };
    const fileLines = text.split("\n");
    let index = 0;

    while (
      !this.is_done([
        PATCH_SUFFIX,
        UPDATE_FILE_PREFIX,
        DELETE_FILE_PREFIX,
        ADD_FILE_PREFIX,
        END_OF_FILE_PREFIX,
      ])
    ) {
      const defStr = this.read_str("@@ ");
      let sectionStr = "";
      if (!defStr && this.lines[this.index] === "@@") {
        sectionStr = this.lines[this.index]!;
        this.index += 1;
      }
      if (!(defStr || sectionStr || index === 0)) {
        throw new DiffError(`Invalid Line:\n${this.lines[this.index]}`);
      }
      if (defStr.trim()) {
        let found = false;
        if (!fileLines.slice(0, index).some((s) => s === defStr)) {
          for (let i = index; i < fileLines.length; i++) {
            if (fileLines[i] === defStr) {
              index = i + 1;
              found = true;
              break;
            }
          }
        }
        if (
          !found &&
          !fileLines.slice(0, index).some((s) => s.trim() === defStr.trim())
        ) {
          for (let i = index; i < fileLines.length; i++) {
            if (fileLines[i]!.trim() === defStr.trim()) {
              index = i + 1;
              this.fuzz += 1;
              found = true;
              break;
            }
          }
        }
      }

      const [nextChunkContext, chunks, endPatchIndex, eof] = peek_next_section(
        this.lines,
        this.index,
      );
      const [newIndex, fuzz] = find_context(
        fileLines,
        nextChunkContext,
        index,
        eof,
      );
      if (newIndex === -1) {
        const ctxText = nextChunkContext.join("\n");
        if (eof) {
          throw new DiffError(`Invalid EOF Context ${index}:\n${ctxText}`);
        } else {
          throw new DiffError(`Invalid Context ${index}:\n${ctxText}`);
        }
      }
      this.fuzz += fuzz;
      for (const ch of chunks) {
        ch.orig_index += newIndex;
        action.chunks.push(ch);
      }
      index = newIndex + nextChunkContext.length;
      this.index = endPatchIndex;
    }
    return action;
  }

  private parse_add_file(): PatchAction {
    const lines: Array<string> = [];
    while (
      !this.is_done([
        PATCH_SUFFIX,
        UPDATE_FILE_PREFIX,
        DELETE_FILE_PREFIX,
        ADD_FILE_PREFIX,
      ])
    ) {
      const s = this.read_str();
      if (!s.startsWith(HUNK_ADD_LINE_PREFIX)) {
        throw new DiffError(`Invalid Add File Line: ${s}`);
      }
      lines.push(s.slice(1));
    }
    return {
      type: ActionType.ADD,
      new_file: lines.join("\n"),
      chunks: [],
    };
  }
}

function find_context_core(
  lines: Array<string>,
  context: Array<string>,
  start: number,
): [number, number] {
  if (context.length === 0) {
    return [start, 0];
  }
  for (let i = start; i < lines.length; i++) {
    if (lines.slice(i, i + context.length).join("\n") === context.join("\n")) {
      return [i, 0];
    }
  }
  for (let i = start; i < lines.length; i++) {
    if (
      lines
        .slice(i, i + context.length)
        .map((s) => s.trimEnd())
        .join("\n") === context.map((s) => s.trimEnd()).join("\n")
    ) {
      return [i, 1];
    }
  }
  for (let i = start; i < lines.length; i++) {
    if (
      lines
        .slice(i, i + context.length)
        .map((s) => s.trim())
        .join("\n") === context.map((s) => s.trim()).join("\n")
    ) {
      return [i, 100];
    }
  }
  return [-1, 0];
}

function find_context(
  lines: Array<string>,
  context: Array<string>,
  start: number,
  eof: boolean,
): [number, number] {
  if (eof) {
    let [newIndex, fuzz] = find_context_core(
      lines,
      context,
      lines.length - context.length,
    );
    if (newIndex !== -1) {
      return [newIndex, fuzz];
    }
    [newIndex, fuzz] = find_context_core(lines, context, start);
    return [newIndex, fuzz + 10000];
  }
  return find_context_core(lines, context, start);
}

function peek_next_section(
  lines: Array<string>,
  initialIndex: number,
): [Array<string>, Array<Chunk>, number, boolean] {
  let index = initialIndex;
  const old: Array<string> = [];
  let delLines: Array<string> = [];
  let insLines: Array<string> = [];
  const chunks: Array<Chunk> = [];
  let mode: "keep" | "add" | "delete" = "keep";

  while (index < lines.length) {
    const s = lines[index]!;
    if (
      [
        "@@",
        PATCH_SUFFIX,
        UPDATE_FILE_PREFIX,
        DELETE_FILE_PREFIX,
        ADD_FILE_PREFIX,
        END_OF_FILE_PREFIX,
      ].some((p) => s.startsWith(p.trim()))
    ) {
      break;
    }
    if (s === "***") {
      break;
    }
    if (s.startsWith("***")) {
      throw new DiffError(`Invalid Line: ${s}`);
    }
    index += 1;
    const lastMode: "keep" | "add" | "delete" = mode;
    let line = s;
    if (line[0] === HUNK_ADD_LINE_PREFIX) {
      mode = "add";
    } else if (line[0] === "-") {
      mode = "delete";
    } else if (line[0] === " ") {
      mode = "keep";
    } else {
      // Tolerate invalid lines where the leading whitespace is missing. This is necessary as
      // the model sometimes doesn't fully adhere to the spec and returns lines without leading
      // whitespace for context lines.
      mode = "keep";
      line = " " + line;

      // TODO: Re-enable strict mode.
      // throw new DiffError(`Invalid Line: ${line}`)
    }

    line = line.slice(1);
    if (mode === "keep" && lastMode !== mode) {
      if (insLines.length || delLines.length) {
        chunks.push({
          orig_index: old.length - delLines.length,
          del_lines: delLines,
          ins_lines: insLines,
        });
      }
      delLines = [];
      insLines = [];
    }
    if (mode === "delete") {
      delLines.push(line);
      old.push(line);
    } else if (mode === "add") {
      insLines.push(line);
    } else {
      old.push(line);
    }
  }
  if (insLines.length || delLines.length) {
    chunks.push({
      orig_index: old.length - delLines.length,
      del_lines: delLines,
      ins_lines: insLines,
    });
  }
  if (index < lines.length && lines[index] === END_OF_FILE_PREFIX) {
    index += 1;
    return [old, chunks, index, true];
  }
  return [old, chunks, index, false];
}

// -----------------------------------------------------------------------------
// High‑level helpers
// -----------------------------------------------------------------------------

export function text_to_patch(
  text: string,
  orig: Record<string, string>,
): [Patch, number] {
  const lines = text.trim().split("\n");
  if (
    lines.length < 2 ||
    !(lines[0] ?? "").startsWith(PATCH_PREFIX.trim()) ||
    lines[lines.length - 1] !== PATCH_SUFFIX.trim()
  ) {
    throw new DiffError("Invalid patch text");
  }
  const parser = new Parser(orig, lines);
  parser.index = 1;
  parser.parse();
  return [parser.patch, parser.fuzz];
}

export function identify_files_needed(text: string): Array<string> {
  const lines = text.trim().split("\n");
  const result = new Set<string>();
  for (const line of lines) {
    if (line.startsWith(UPDATE_FILE_PREFIX)) {
      result.add(line.slice(UPDATE_FILE_PREFIX.length));
    }
    if (line.startsWith(DELETE_FILE_PREFIX)) {
      result.add(line.slice(DELETE_FILE_PREFIX.length));
    }
  }
  return [...result];
}

export function identify_files_added(text: string): Array<string> {
  const lines = text.trim().split("\n");
  const result = new Set<string>();
  for (const line of lines) {
    if (line.startsWith(ADD_FILE_PREFIX)) {
      result.add(line.slice(ADD_FILE_PREFIX.length));
    }
  }
  return [...result];
}

function _get_updated_file(
  text: string,
  action: PatchAction,
  path: string,
): string {
  if (action.type !== ActionType.UPDATE) {
    throw new Error("Expected UPDATE action");
  }
  const origLines = text.split("\n");
  const destLines: Array<string> = [];
  let origIndex = 0;
  for (const chunk of action.chunks) {
    if (chunk.orig_index > origLines.length) {
      throw new DiffError(
        `${path}: chunk.orig_index ${chunk.orig_index} > len(lines) ${origLines.length}`,
      );
    }
    if (origIndex > chunk.orig_index) {
      throw new DiffError(
        `${path}: orig_index ${origIndex} > chunk.orig_index ${chunk.orig_index}`,
      );
    }
    destLines.push(...origLines.slice(origIndex, chunk.orig_index));
    const delta = chunk.orig_index - origIndex;
    origIndex += delta;

    // inserted lines
    if (chunk.ins_lines.length) {
      for (const l of chunk.ins_lines) {
        destLines.push(l);
      }
    }
    origIndex += chunk.del_lines.length;
  }
  destLines.push(...origLines.slice(origIndex));
  return destLines.join("\n");
}

export function patch_to_commit(
  patch: Patch,
  orig: Record<string, string>,
): Commit {
  const commit: Commit = { changes: {} };
  for (const [pathKey, action] of Object.entries(patch.actions)) {
    if (action.type === ActionType.DELETE) {
      commit.changes[pathKey] = {
        type: ActionType.DELETE,
        old_content: orig[pathKey],
      };
    } else if (action.type === ActionType.ADD) {
      commit.changes[pathKey] = {
        type: ActionType.ADD,
        new_content: action.new_file ?? "",
      };
    } else if (action.type === ActionType.UPDATE) {
      const newContent = _get_updated_file(orig[pathKey]!, action, pathKey);
      commit.changes[pathKey] = {
        type: ActionType.UPDATE,
        old_content: orig[pathKey],
        new_content: newContent,
        move_path: action.move_path ?? undefined,
      };
    }
  }
  return commit;
}

// -----------------------------------------------------------------------------
// Filesystem helpers for Node environment
// -----------------------------------------------------------------------------

export function load_files(
  paths: Array<string>,
  openFn: (p: string) => string,
): Record<string, string> {
  const orig: Record<string, string> = {};
  for (const p of paths) {
    try {
      orig[p] = openFn(p);
    } catch {
      // Convert any file read error into a DiffError so that callers
      // consistently receive DiffError for patch-related failures.
      throw new DiffError(`File not found: ${p}`);
    }
  }
  return orig;
}

export function apply_commit(
  commit: Commit,
  writeFn: (p: string, c: string) => void,
  removeFn: (p: string) => void,
): void {
  for (const [p, change] of Object.entries(commit.changes)) {
    if (change.type === ActionType.DELETE) {
      removeFn(p);
    } else if (change.type === ActionType.ADD) {
      writeFn(p, change.new_content ?? "");
    } else if (change.type === ActionType.UPDATE) {
      if (change.move_path) {
        writeFn(change.move_path, change.new_content ?? "");
        removeFn(p);
      } else {
        writeFn(p, change.new_content ?? "");
      }
    }
  }
}

export function process_patch(
  text: string,
  openFn: (p: string) => string,
  writeFn: (p: string, c: string) => void,
  removeFn: (p: string) => void,
): string {
  if (!text.startsWith(PATCH_PREFIX)) {
    throw new DiffError("Patch must start with *** Begin Patch\\n");
  }
  const paths = identify_files_needed(text);
  const orig = load_files(paths, openFn);
  const [patch, _fuzz] = text_to_patch(text, orig);
  const commit = patch_to_commit(patch, orig);
  apply_commit(commit, writeFn, removeFn);
  return "Done!";
}

// -----------------------------------------------------------------------------
// Default filesystem implementations
// -----------------------------------------------------------------------------

function open_file(p: string): string {
  return fs.readFileSync(p, "utf8");
}

function write_file(p: string, content: string): void {
  if (path.isAbsolute(p)) {
    throw new DiffError("We do not support absolute paths.");
  }
  const parent = path.dirname(p);
  if (parent !== ".") {
    fs.mkdirSync(parent, { recursive: true });
  }
  fs.writeFileSync(p, content, "utf8");
}

function remove_file(p: string): void {
  fs.unlinkSync(p);
}

// -----------------------------------------------------------------------------
// CLI mode. Not exported, executed only if run directly.
// -----------------------------------------------------------------------------

if (import.meta.url === `file://${process.argv[1]}`) {
  let patchText = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => (patchText += chunk));
  process.stdin.on("end", () => {
    if (!patchText) {
      // eslint-disable-next-line no-console
      console.error("Please pass patch text through stdin");
      process.exit(1);
    }
    try {
      const result = process_patch(
        patchText,
        open_file,
        write_file,
        remove_file,
      );
      // eslint-disable-next-line no-console
      console.log(result);
    } catch (err: unknown) {
      // eslint-disable-next-line no-console
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
}
