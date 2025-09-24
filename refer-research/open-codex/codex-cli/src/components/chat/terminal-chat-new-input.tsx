import type { MultilineTextEditorHandle } from "./multiline-editor";
import type { ReviewDecision } from "../../utils/agent/review.js";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions.mjs";
import type { ResponseItem } from "openai/resources/responses/responses.mjs";

import MultilineTextEditor from "./multiline-editor";
import { TerminalChatCommandReview } from "./terminal-chat-command-review.js";
import { log, isLoggingEnabled } from "../../utils/agent/log.js";
import { createInputItem } from "../../utils/input-utils.js";
import { setSessionId } from "../../utils/session.js";
import { clearTerminal, onExit } from "../../utils/terminal.js";
import Spinner from "../vendor/ink-spinner.js";
import { Box, Text, useApp, useInput, useStdin } from "ink";
import { fileURLToPath } from "node:url";
import React, { useCallback, useState, Fragment } from "react";
import { useInterval } from "use-interval";

const suggestions = [
  "explain this codebase to me",
  "fix any build errors",
  "are there any bugs in my code?",
];

const typeHelpText = `ctrl+c to exit | "/clear" to reset context | "/help" for commands | ↑↓ to recall history | ctrl+x to open external editor | enter to send`;

// Enable verbose logging for the history‑navigation logic when the
// DEBUG_TCI environment variable is truthy.  The traces help while debugging
// unit‑test failures but remain silent in production.
const DEBUG_HIST =
  process.env["DEBUG_TCI"] === "1" || process.env["DEBUG_TCI"] === "true";

const thinkingTexts = ["Thinking"]; /* [
  "Consulting the rubber duck",
  "Maximizing paperclips",
  "Reticulating splines",
  "Immanentizing the Eschaton",
  "Thinking",
  "Thinking about thinking",
  "Spinning in circles",
  "Counting dust specks",
  "Updating priors",
  "Feeding the utility monster",
  "Taking off",
  "Wireheading",
  "Counting to infinity",
  "Staring into the Basilisk",
  "Running acausal tariff negotiations",
  "Searching the library of babel",
  "Multiplying matrices",
  "Solving the halting problem",
  "Counting grains of sand",
  "Simulating a simulation",
  "Asking the oracle",
  "Detangling qubits",
  "Reading tea leaves",
  "Pondering universal love and transcendent joy",
  "Feeling the AGI",
  "Shaving the yak",
  "Escaping local minima",
  "Pruning the search tree",
  "Descending the gradient",
  "Painting the bikeshed",
  "Securing funding",
]; */

export default function TerminalChatInput({
  isNew: _isNew,
  loading,
  submitInput,
  confirmationPrompt,
  submitConfirmation,
  setLastResponseId,
  setItems,
  contextLeftPercent,
  openOverlay,
  openModelOverlay,
  openApprovalOverlay,
  openHelpOverlay,
  interruptAgent,
  active,
}: {
  isNew: boolean;
  loading: boolean;
  submitInput: (input: Array<ChatCompletionMessageParam>) => void;
  confirmationPrompt: React.ReactNode | null;
  submitConfirmation: (
    decision: ReviewDecision,
    customDenyMessage?: string,
  ) => void;
  setLastResponseId: (lastResponseId: string) => void;
  setItems: React.Dispatch<React.SetStateAction<Array<ResponseItem>>>;
  contextLeftPercent: number;
  openOverlay: () => void;
  openModelOverlay: () => void;
  openApprovalOverlay: () => void;
  openHelpOverlay: () => void;
  interruptAgent: () => void;
  active: boolean;
}): React.ReactElement {
  const app = useApp();
  const [selectedSuggestion, setSelectedSuggestion] = useState<number>(0);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<Array<string>>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [draftInput, setDraftInput] = useState<string>("");
  // Multiline text editor is now the default input mode.  We keep an
  // incremental `editorKey` so that we can force‑remount the component and
  // thus reset its internal buffer after each successful submit.
  const [editorKey, setEditorKey] = useState(0);

  // Imperative handle from the multiline editor so we can query caret position
  const editorRef = React.useRef<MultilineTextEditorHandle | null>(null);

  // Track the caret row across keystrokes so we can tell whether the cursor
  // was *already* on the first/last line before the current key event.  This
  // lets us distinguish between a normal vertical navigation (e.g. moving
  // from row 1 → row 0 inside a multi‑line draft) and an attempt to navigate
  // the chat history (pressing ↑ again while already at row 0).
  const prevCursorRow = React.useRef<number | null>(null);

  useInput(
    (_input, _key) => {
      if (!confirmationPrompt && !loading) {
        if (_key.upArrow) {
          if (DEBUG_HIST) {
            // eslint-disable-next-line no-console
            console.log("[TCI] upArrow", {
              historyIndex,
              input,
              cursorRow: editorRef.current?.getRow?.(),
            });
          }
          // Only recall history when the caret was *already* on the very first
          // row *before* this key‑press.  That means the user pressed ↑ while
          // the cursor sat at the top – mirroring how shells like Bash/zsh
          // enter history navigation.  When the caret starts on a lower line
          // the first ↑ should merely move it up one row; only a subsequent
          // press (when we are *still* at row 0) should trigger the recall.

          const cursorRow = editorRef.current?.getRow?.() ?? 0;
          const wasAtFirstRow = (prevCursorRow.current ?? cursorRow) === 0;

          if (history.length > 0 && cursorRow === 0 && wasAtFirstRow) {
            if (historyIndex == null) {
              const currentDraft = editorRef.current?.getText?.() ?? input;
              setDraftInput(currentDraft);
              if (DEBUG_HIST) {
                // eslint-disable-next-line no-console
                console.log("[TCI] store draft", JSON.stringify(currentDraft));
              }
            }

            let newIndex: number;
            if (historyIndex == null) {
              newIndex = history.length - 1;
            } else {
              newIndex = Math.max(0, historyIndex - 1);
            }
            setHistoryIndex(newIndex);
            setInput(history[newIndex] ?? "");
            // Re‑mount the editor so it picks up the new initialText.
            setEditorKey((k) => k + 1);
            return; // we handled the key
          }
          // Otherwise let the event propagate so the editor moves the caret.
        }

        if (_key.downArrow) {
          if (DEBUG_HIST) {
            // eslint-disable-next-line no-console
            console.log("[TCI] downArrow", { historyIndex, draftInput, input });
          }
          // Only move forward in history when we're already *in* history mode
          // AND the caret sits on the last line of the buffer (so ↓ within a
          // multi‑line draft simply moves the caret down).
          if (historyIndex != null && editorRef.current?.isCursorAtLastRow()) {
            const newIndex = historyIndex + 1;
            if (newIndex >= history.length) {
              setHistoryIndex(null);
              setInput(draftInput);
              setEditorKey((k) => k + 1);
            } else {
              setHistoryIndex(newIndex);
              setInput(history[newIndex] ?? "");
              setEditorKey((k) => k + 1);
            }
            return; // handled
          }
          // Otherwise let it propagate.
        }
      }

      if (input.trim() === "") {
        if (_key.tab) {
          setSelectedSuggestion(
            (s) => (s + (_key.shift ? -1 : 1)) % (suggestions.length + 1),
          );
        } else if (selectedSuggestion && _key.return) {
          const suggestion = suggestions[selectedSuggestion - 1] || "";
          setInput("");
          setSelectedSuggestion(0);
          submitInput([
            {
              role: "user",
              content: [{ type: "text", text: suggestion }],
            },
          ]);
        }
      } else if (_input === "\u0003" || (_input === "c" && _key.ctrl)) {
        setTimeout(() => {
          app.exit();
          onExit();
          process.exit(0);
        }, 60);
      }

      // Update the cached cursor position *after* we've potentially handled
      // the key so that the next event has the correct "previous" reference.
      prevCursorRow.current = editorRef.current?.getRow?.() ?? null;
    },
    { isActive: active },
  );

  const onSubmit = useCallback(
    async (value: string) => {
      const inputValue = value.trim();
      if (!inputValue) {
        return;
      }

      if (inputValue === "/history") {
        setInput("");
        openOverlay();
        return;
      }

      if (inputValue === "/help") {
        setInput("");
        openHelpOverlay();
        return;
      }

      if (inputValue.startsWith("/model")) {
        setInput("");
        openModelOverlay();
        return;
      }

      if (inputValue.startsWith("/approval")) {
        setInput("");
        openApprovalOverlay();
        return;
      }

      if (inputValue === "q" || inputValue === ":q" || inputValue === "exit") {
        setInput("");
        // wait one 60ms frame
        setTimeout(() => {
          app.exit();
          onExit();
          process.exit(0);
        }, 60);
        return;
      } else if (inputValue === "/clear" || inputValue === "clear") {
        setInput("");
        setSessionId("");
        setLastResponseId("");
        clearTerminal();

        // Emit a system message to confirm the clear action.  We *append*
        // it so Ink's <Static> treats it as new output and actually renders it.
        setItems((prev) => [
          ...prev,
          {
            id: `clear-${Date.now()}`,
            type: "message",
            role: "system",
            content: [{ type: "input_text", text: "Context cleared" }],
          },
        ]);

        return;
      }

      const images: Array<string> = [];
      const text = inputValue
        .replace(/!\[[^\]]*?\]\(([^)]+)\)/g, (_m, p1: string) => {
          images.push(p1.startsWith("file://") ? fileURLToPath(p1) : p1);
          return "";
        })
        .trim();

      const inputItem = await createInputItem(text, images);
      submitInput([inputItem]);
      setHistory((prev) => {
        if (prev[prev.length - 1] === value) {
          return prev;
        }
        return [...prev, value];
      });
      setHistoryIndex(null);
      setDraftInput("");
      setSelectedSuggestion(0);
      setInput("");
    },
    [
      setInput,
      submitInput,
      setLastResponseId,
      setItems,
      app,
      setHistory,
      setHistoryIndex,
      openOverlay,
      openApprovalOverlay,
      openModelOverlay,
      openHelpOverlay,
    ],
  );

  if (confirmationPrompt) {
    return (
      <TerminalChatCommandReview
        confirmationPrompt={confirmationPrompt}
        onReviewCommand={submitConfirmation}
      />
    );
  }

  return (
    <Box flexDirection="column">
      {loading ? (
        <Box borderStyle="round">
          <TerminalChatInputThinking
            onInterrupt={interruptAgent}
            active={active}
          />
        </Box>
      ) : (
        <>
          <Box borderStyle="round">
            <MultilineTextEditor
              ref={editorRef}
              onChange={(txt: string) => setInput(txt)}
              key={editorKey}
              initialText={input}
              height={8}
              focus={active}
              onSubmit={(txt) => {
                onSubmit(txt);

                setEditorKey((k) => k + 1);

                setInput("");
                setHistoryIndex(null);
                setDraftInput("");
              }}
            />
          </Box>
          <Box paddingX={2} marginBottom={1}>
            <Text dimColor>
              {!input ? (
                <>
                  try:{" "}
                  {suggestions.map((m, key) => (
                    <Fragment key={key}>
                      {key !== 0 ? " | " : ""}
                      <Text
                        backgroundColor={
                          key + 1 === selectedSuggestion ? "blackBright" : ""
                        }
                      >
                        {m}
                      </Text>
                    </Fragment>
                  ))}
                </>
              ) : (
                <>
                  {typeHelpText}
                  {contextLeftPercent < 25 && (
                    <>
                      {" — "}
                      <Text color="red">
                        {Math.round(contextLeftPercent)}% context left
                      </Text>
                    </>
                  )}
                </>
              )}
            </Text>
          </Box>
        </>
      )}
    </Box>
  );
}

function TerminalChatInputThinking({
  onInterrupt,
  active,
}: {
  onInterrupt: () => void;
  active: boolean;
}) {
  const [dots, setDots] = useState("");
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);

  const [thinkingText] = useState(
    () => thinkingTexts[Math.floor(Math.random() * thinkingTexts.length)],
  );

  // ---------------------------------------------------------------------
  // Raw stdin listener to catch the case where the terminal delivers two
  // consecutive ESC bytes ("\x1B\x1B") in a *single* chunk. Ink's `useInput`
  // collapses that sequence into one key event, so the regular two‑step
  // handler above never sees the second press.  By inspecting the raw data
  // we can identify this special case and trigger the interrupt while still
  // requiring a double press for the normal single‑byte ESC events.
  // ---------------------------------------------------------------------

  const { stdin, setRawMode } = useStdin();

  React.useEffect(() => {
    if (!active) {
      return;
    }

    // Ensure raw mode – already enabled by Ink when the component has focus,
    // but called defensively in case that assumption ever changes.
    setRawMode?.(true);

    const onData = (data: Buffer | string) => {
      if (awaitingConfirm) {
        return; // already awaiting a second explicit press
      }

      // Handle both Buffer and string forms.
      const str = Buffer.isBuffer(data) ? data.toString("utf8") : data;
      if (str === "\x1b\x1b") {
        // Treat as the first Escape press – prompt the user for confirmation.
        if (isLoggingEnabled()) {
          log(
            "raw stdin: received collapsed ESC ESC – starting confirmation timer",
          );
        }
        setAwaitingConfirm(true);
        setTimeout(() => setAwaitingConfirm(false), 1500);
      }
    };

    stdin?.on("data", onData);

    return () => {
      stdin?.off("data", onData);
    };
  }, [stdin, awaitingConfirm, onInterrupt, active, setRawMode]);

  useInterval(() => {
    setDots((prev) => (prev.length < 3 ? prev + "." : ""));
  }, 500);

  useInput(
    (_input, key) => {
      if (!key.escape) {
        return;
      }

      if (awaitingConfirm) {
        if (isLoggingEnabled()) {
          log("useInput: second ESC detected – triggering onInterrupt()");
        }
        onInterrupt();
        setAwaitingConfirm(false);
      } else {
        if (isLoggingEnabled()) {
          log("useInput: first ESC detected – waiting for confirmation");
        }
        setAwaitingConfirm(true);
        setTimeout(() => setAwaitingConfirm(false), 1500);
      }
    },
    { isActive: active },
  );

  return (
    <Box flexDirection="column" gap={1}>
      <Box gap={2}>
        <Spinner type="ball" />
        <Text>
          {thinkingText}
          {dots}
        </Text>
      </Box>
      {awaitingConfirm && (
        <Text dimColor>
          Press <Text bold>Esc</Text> again to interrupt and enter a new
          instruction
        </Text>
      )}
    </Box>
  );
}
