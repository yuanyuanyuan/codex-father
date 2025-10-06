import { promises as fs } from 'node:fs';
import path from 'node:path';

import { XMLParser } from 'fast-xml-parser';
import YAML from 'yaml';

import { createError } from '../error-boundary.js';
import { StructuredInstructionsSchema, type StructuredInstructions } from './schema.js';

type InstructionFormat = 'json' | 'yaml' | 'xml';

export interface LoadInstructionsOptions {
  cwd?: string;
}

export interface LoadInstructionsResult {
  data: StructuredInstructions;
  format: InstructionFormat;
  sourcePath: string;
}

export interface PrepareInstructionsOptions extends LoadInstructionsOptions {
  outputDir?: string;
  now?: Date;
  expectedTaskId?: string;
}

export interface PreparedInstructions extends LoadInstructionsResult {
  normalizedPath: string;
}

const XML_PARSER = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  allowBooleanAttributes: true,
  trimValues: false,
  textNodeName: '#text',
  processEntities: false,
});

export async function loadStructuredInstructions(
  inputPath: string,
  options: LoadInstructionsOptions = {}
): Promise<LoadInstructionsResult> {
  const cwd = options.cwd ?? process.cwd();
  const resolved = path.isAbsolute(inputPath) ? inputPath : path.resolve(cwd, inputPath);

  try {
    await fs.access(resolved);
  } catch {
    throw createError.validation(`指令文件不存在: ${resolved}`);
  }

  const raw = await fs.readFile(resolved, 'utf8');
  const ext = path.extname(resolved).toLowerCase();

  let format: InstructionFormat = 'json';
  let parsed: unknown;

  if (ext === '.yaml' || ext === '.yml') {
    format = 'yaml';
    parsed = YAML.parse(raw);
  } else if (ext === '.xml') {
    format = 'xml';
    parsed = convertXmlToJson(XML_PARSER.parse(raw));
  } else {
    format = 'json';
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      const xmlCandidate = tryParseXml(raw);
      if (xmlCandidate) {
        format = 'xml';
        parsed = xmlCandidate;
      } else {
        const yamlCandidate = tryParseYaml(raw);
        if (yamlCandidate) {
          format = 'yaml';
          parsed = yamlCandidate;
        } else {
          throw createError.validation(`无法解析指令文件（非有效 JSON / YAML / XML）: ${resolved}`);
        }
      }
    }
  }

  const validation = StructuredInstructionsSchema.safeParse(parsed);
  if (!validation.success) {
    const issues = validation.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`);
    throw createError.validation(
      `结构化指令无效: ${resolved}`,
      undefined,
      issues.length ? issues : undefined
    );
  }

  return {
    data: validation.data,
    format,
    sourcePath: resolved,
  };
}

export async function prepareStructuredInstructions(
  inputPath: string,
  options: PrepareInstructionsOptions = {}
): Promise<PreparedInstructions> {
  const { data, format, sourcePath } = await loadStructuredInstructions(inputPath, options);

  if (options.expectedTaskId) {
    const hasTask = data.tasks.some((task) => task.id === options.expectedTaskId);
    if (!hasTask) {
      throw createError.validation(
        `任务 ID '${options.expectedTaskId}' 不存在于指令 ${path.basename(sourcePath)} 中`
      );
    }
  }

  const targetDir = options.outputDir
    ? path.isAbsolute(options.outputDir)
      ? options.outputDir
      : path.resolve(options.cwd ?? process.cwd(), options.outputDir)
    : path.resolve(options.cwd ?? process.cwd(), '.codex-father', 'instructions');

  await fs.mkdir(targetDir, { recursive: true });

  const timestamp = formatTimestamp(options.now ?? new Date());
  const slug = slugify(data.id || 'instructions');
  const filename = `${timestamp}-${slug}.json`;
  const normalizedPath = path.join(targetDir, filename);

  const payload = {
    meta: {
      source: sourcePath,
      format,
      normalizedAt: new Date().toISOString(),
    },
    instructions: data,
  };

  await fs.writeFile(normalizedPath, JSON.stringify(payload, null, 2), 'utf8');

  return {
    data,
    format,
    sourcePath,
    normalizedPath,
  };
}

function formatTimestamp(date: Date): string {
  const pad = (value: number): string => value.toString().padStart(2, '0');
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hour = pad(date.getUTCHours());
  const minute = pad(date.getUTCMinutes());
  const second = pad(date.getUTCSeconds());
  return `${year}${month}${day}-${hour}${minute}${second}`;
}

function slugify(value: string): string {
  const normalized = value
    .trim()
    .replace(/[^A-Za-z0-9_.-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
  return normalized.length > 0 ? normalized.slice(0, 80) : 'instructions';
}

function tryParseYaml(content: string): unknown | null {
  try {
    return YAML.parse(content);
  } catch {
    return null;
  }
}

function tryParseXml(content: string): unknown | null {
  try {
    const parsed = XML_PARSER.parse(content);
    return convertXmlToJson(parsed);
  } catch {
    return null;
  }
}

function convertXmlToJson(xml: unknown): unknown {
  if (!xml || typeof xml !== 'object' || !('instructions' in xml)) {
    throw createError.validation('XML 指令缺少 <instructions> 根元素');
  }

  const root = (xml as { instructions: Record<string, unknown> }).instructions;

  if (!root || typeof root !== 'object') {
    throw createError.validation('无法解析 XML 指令根元素');
  }

  const base: Record<string, unknown> = {
    version: getAttr(root, 'version'),
    id: getAttr(root, 'id'),
  };

  if (!base.version || !base.id) {
    throw createError.validation('XML 指令缺少 version 或 id 属性');
  }

  const context = readText((root as Record<string, unknown>).context);
  if (context) {
    base.context = context;
  }

  const objective = readText((root as Record<string, unknown>).objective);
  if (objective) {
    base.objective = objective;
  }

  const audience = readText((root as Record<string, unknown>).audience);
  if (audience) {
    base.audience = audience;
  }

  const style = readText((root as Record<string, unknown>).style);
  if (style) {
    base.style = style;
  }

  const tone = readText((root as Record<string, unknown>).tone);
  if (tone) {
    base.tone = tone;
  }

  const envNode = (root as Record<string, unknown>).env;
  if (envNode && typeof envNode === 'object') {
    const allowAttr = getAttr(envNode, 'allow');
    if (allowAttr) {
      const allowList = allowAttr
        .split(',')
        .map((token) => token.trim())
        .filter(Boolean);
      if (allowList.length > 0) {
        base.env = { allow: allowList };
      }
    }
  }

  const constraintsNode = (root as Record<string, unknown>).constraints;
  if (constraintsNode && typeof constraintsNode === 'object') {
    const timeout = toInt(getAttr(constraintsNode, 'timeoutMs'));
    const maxParallel = toInt(getAttr(constraintsNode, 'maxParallel'));
    const constraints: Record<string, number> = {};
    if (typeof timeout === 'number') {
      constraints.timeoutMs = timeout;
    }
    if (typeof maxParallel === 'number') {
      constraints.maxParallel = maxParallel;
    }
    if (Object.keys(constraints).length > 0) {
      base.constraints = constraints;
    }
  }

  const responseNode = (root as Record<string, unknown>).response;
  if (responseNode && typeof responseNode === 'object') {
    const formatAttr = getAttr(responseNode, 'format');
    const artifactsRaw = (responseNode as Record<string, unknown>).artifact;
    const artifacts = ensureArray(artifactsRaw)
      .map((item) => readText(item))
      .filter((item): item is string => Boolean(item));
    const response: Record<string, unknown> = {};
    if (formatAttr) {
      response.format = formatAttr;
    }
    if (artifacts.length > 0) {
      response.artifacts = artifacts;
    }
    if (Object.keys(response).length > 0) {
      base.response = response;
    }
  }

  const vcsNode = (root as Record<string, unknown>).vcs;
  if (vcsNode && typeof vcsNode === 'object') {
    const branch = getAttr(vcsNode, 'branch');
    const commitMessage = getAttr(vcsNode, 'commitMessage');
    const prNode = (vcsNode as Record<string, unknown>).pr;

    if (!branch || !commitMessage || !prNode || typeof prNode !== 'object') {
      throw createError.validation('XML 指令中的 <vcs> 节点缺少必要字段');
    }

    const prTitle = getAttr(prNode, 'title');
    if (!prTitle) {
      throw createError.validation('XML 指令中的 <pr> 节点缺少 title 属性');
    }

    const labelsAttr = getAttr(prNode, 'labels');
    const labels = labelsAttr
      ? labelsAttr
          .split(',')
          .map((label) => label.trim())
          .filter(Boolean)
      : undefined;
    const draftAttr = getAttr(prNode, 'draft');
    const draft = draftAttr ? parseBoolean(draftAttr) : undefined;
    const reviewersAttr = getAttr(prNode, 'reviewers');
    const reviewers = reviewersAttr
      ? reviewersAttr
          .split(',')
          .map((r) => r.trim())
          .filter(Boolean)
      : undefined;
    const bodyText = readText(prNode);

    base.vcs = {
      branch,
      commitMessage,
      pr: {
        title: prTitle,
        ...(bodyText ? { body: bodyText } : {}),
        ...(labels ? { labels } : {}),
        ...(typeof draft === 'boolean' ? { draft } : {}),
        ...(reviewers ? { reviewers } : {}),
      },
    };
  }

  const tasks = collectTaskNodes(root as Record<string, unknown>).map((taskItem) =>
    convertXmlTask(taskItem)
  );
  if (tasks.length === 0) {
    throw createError.validation('XML 指令缺少 <task> 定义');
  }
  base.tasks = tasks;

  return base;
}

function collectTaskNodes(source: Record<string, unknown>): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];

  const visit = (value: unknown): void => {
    if (value === undefined || value === null) {
      return;
    }
    const items = ensureArray(value as Record<string, unknown> | Array<Record<string, unknown>>);
    for (const item of items) {
      if (!item || typeof item !== 'object') {
        continue;
      }
      const record = item as Record<string, unknown>;
      const hasId = Boolean(getAttr(record, 'id'));
      const hasSteps = 'step' in record;
      if (hasId && hasSteps) {
        results.push(record);
      }
      if ('task' in record) {
        visit(record.task);
      }
    }
  };

  if ('tasks' in source) {
    visit((source as Record<string, unknown>).tasks);
  }
  if ('task' in source) {
    visit((source as Record<string, unknown>).task);
  }

  return results;
}

function convertXmlTask(taskNode: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!taskNode) {
    throw createError.validation('XML 指令中的 <task> 节点无效');
  }

  const id = getAttr(taskNode, 'id');
  if (!id) {
    throw createError.validation('<task> 节点缺少 id 属性');
  }

  const description = getAttr(taskNode, 'description') ?? readText(taskNode.description);

  const stepNodes = ensureArray(
    taskNode.step as Record<string, unknown> | Array<Record<string, unknown>>
  );
  if (stepNodes.length === 0) {
    throw createError.validation(`<task id="${id}"> 缺少 <step> 定义`);
  }

  const steps = stepNodes.map((stepNode) => convertXmlStep(stepNode));

  return {
    id,
    ...(description ? { description } : {}),
    steps,
  };
}

function convertXmlStep(stepNode: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!stepNode || typeof stepNode !== 'object') {
    throw createError.validation('XML 指令中的 <step> 节点无效');
  }

  const id = getAttr(stepNode, 'id');
  if (!id) {
    throw createError.validation('<step> 节点缺少 id 属性');
  }

  const whenAttr = getAttr(stepNode, 'when');
  const workdirAttr = getAttr(stepNode, 'workdir');
  const timeoutAttr = getAttr(stepNode, 'timeoutMs');
  const shellAttr = getAttr(stepNode, 'shell');
  const scriptAttr = getAttr(stepNode, 'script');
  const continueAttr = getAttr(stepNode, 'continueOnError');
  const allowExitCodesAttr = getAttr(stepNode, 'allowExitCodes');

  const runScript = scriptAttr ?? readText(stepNode, { trim: false });

  if (!runScript || runScript.trim().length === 0) {
    throw createError.validation(`<step id="${id}"> 缺少可执行内容`);
  }

  const run = scriptAttr
    ? {
        shell: shellAttr === 'sh' ? 'sh' : 'bash',
        script: runScript,
      }
    : runScript;

  const allowExitCodes = allowExitCodesAttr
    ? allowExitCodesAttr
        .split(',')
        .map((token) => Number.parseInt(token.trim(), 10))
        .filter((value) => Number.isFinite(value))
    : undefined;

  const artifactsRaw = stepNode.artifact ?? stepNode.artifacts;
  const artifacts = ensureArray(artifactsRaw)
    .map((entry) => readText(entry))
    .filter((entry): entry is string => Boolean(entry));

  const errorMatchersRaw = stepNode.errorMatcher ?? stepNode.errorMatchers;
  const errorMatchers = ensureArray(errorMatchersRaw)
    .map((entry) => readText(entry))
    .filter((entry): entry is string => Boolean(entry));

  const envNode = stepNode.env;
  let env: Record<string, unknown> | undefined;
  if (envNode && typeof envNode === 'object') {
    const setters = (envNode as Record<string, unknown>).set;
    if (setters && typeof setters === 'object') {
      const setEntries = ensureArray(
        setters as Record<string, unknown> | Array<Record<string, unknown>>
      )
        .map((item) => toKeyValue(item))
        .filter((item): item is [string, string] => Boolean(item));
      if (setEntries.length > 0) {
        env = { set: Object.fromEntries(setEntries) };
      }
    }
  }

  return {
    id,
    run,
    ...(whenAttr ? { when: whenAttr } : {}),
    ...(workdirAttr ? { workdir: workdirAttr } : {}),
    ...(timeoutAttr ? { timeoutMs: toInt(timeoutAttr) } : {}),
    ...(continueAttr ? { continueOnError: parseBoolean(continueAttr) } : {}),
    ...(allowExitCodes && allowExitCodes.length > 0 ? { allowExitCodes } : {}),
    ...(errorMatchers.length > 0 ? { errorMatchers } : {}),
    ...(artifacts.length > 0 ? { artifacts } : {}),
    ...(env ? { env } : {}),
  };
}

function readText(
  node: unknown,
  options: {
    trim?: boolean;
  } = {}
): string | undefined {
  const { trim = true } = options;
  if (node === undefined || node === null) {
    return undefined;
  }

  if (typeof node === 'string') {
    return trim ? node.trim() : node;
  }

  if (typeof node === 'number' || typeof node === 'boolean') {
    return String(node);
  }

  if (typeof node === 'object') {
    const record = node as Record<string, unknown>;
    if ('#text' in record) {
      return readText(record['#text'], { trim });
    }
  }

  return undefined;
}

function ensureArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function getAttr(node: unknown, name: string): string | undefined {
  if (!node || typeof node !== 'object') {
    return undefined;
  }
  const record = node as Record<string, unknown>;
  const key = `@_${name}`;
  const value = record[key];
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) {
    return false;
  }
  return undefined;
}

function toInt(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toKeyValue(node: unknown): [string, string] | undefined {
  if (!node || typeof node !== 'object') {
    return undefined;
  }
  const record = node as Record<string, unknown>;
  const name = getAttr(record, 'name');
  const value = getAttr(record, 'value') ?? readText(record);
  if (!name || value === undefined) {
    return undefined;
  }
  return [name, value];
}
