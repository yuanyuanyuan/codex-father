import type { ReviewDecision } from "../../utils/agent/review.js";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions.mjs";

import { TerminalChatCommandReview } from "./terminal-chat-command-review.js";
import { log, isLoggingEnabled } from "../../utils/agent/log.js";
import { createInputItem } from "../../utils/input-utils.js";
import { setSessionId } from "../../utils/session.js";
import { clearTerminal, onExit } from "../../utils/terminal.js";
import Spinner from "../vendor/ink-spinner.js";
import TextInput from "../vendor/ink-text-input.js";
import { Box, Text, useApp, useInput, useStdin } from "ink";
import { fileURLToPath } from "node:url";
import React, { useCallback, useState, Fragment } from "react";
import { useInterval } from "use-interval";

const suggestions = [
  "explain this codebase to me",
  "fix any build errors",
  "are there any bugs in my code?",
];

export default function TerminalChatInput({
  isNew,
  loading,
  submitInput,
  confirmationPrompt,
  submitConfirmation,
  setPrevItems,
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
  setPrevItems: (prevItems: Array<ChatCompletionMessageParam>) => void;
  setItems: React.Dispatch<
    React.SetStateAction<Array<ChatCompletionMessageParam>>
  >;
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

  useInput(
    (_input, _key) => {
      if (!confirmationPrompt && !loading) {
        if (_key.upArrow) {
          if (history.length > 0) {
            if (historyIndex == null) {
              setDraftInput(input);
            }

            let newIndex: number;
            if (historyIndex == null) {
              newIndex = history.length - 1;
            } else {
              newIndex = Math.max(0, historyIndex - 1);
            }
            setHistoryIndex(newIndex);
            setInput(history[newIndex] ?? "");
          }
          return;
        }

        if (_key.downArrow) {
          if (historyIndex == null) {
            return;
          }

          const newIndex = historyIndex + 1;
          if (newIndex >= history.length) {
            setHistoryIndex(null);
            setInput(draftInput);
          } else {
            setHistoryIndex(newIndex);
            setInput(history[newIndex] ?? "");
          }
          return;
        }
      }

      if (input.trim() === "" && isNew) {
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
        setPrevItems([]);
        clearTerminal();

        // Emit a system message to confirm the clear action.  We *append*
        // it so Ink's <Static> treats it as new output and actually renders it.
        setItems((prev) => [
          ...prev,
          {
            role: "assistant",
            content: [{ type: "text", text: "Context cleared" }],
          },
        ]);

        return;
      }

      // detect image file paths for dynamic inclusion
      const images: Array<string> = [];
      let text = inputValue;
      // markdown-style image syntax: ![alt](path)
      text = text.replace(/!\[[^\]]*?\]\(([^)]+)\)/g, (_m, p1: string) => {
        images.push(p1.startsWith("file://") ? fileURLToPath(p1) : p1);
        return "";
      });
      // quoted file paths ending with common image extensions (e.g. '/path/to/img.png')
      text = text.replace(
        /['"]([^'"]+?\.(?:png|jpe?g|gif|bmp|webp|svg))['"]/gi,
        (_m, p1: string) => {
          images.push(p1.startsWith("file://") ? fileURLToPath(p1) : p1);
          return "";
        },
      );
      // bare file paths ending with common image extensions
      text = text.replace(
        // eslint-disable-next-line no-useless-escape
        /\b(?:\.[\/\\]|[\/\\]|[A-Za-z]:[\/\\])?[\w-]+(?:[\/\\][\w-]+)*\.(?:png|jpe?g|gif|bmp|webp|svg)\b/gi,
        (match: string) => {
          images.push(
            match.startsWith("file://") ? fileURLToPath(match) : match,
          );
          return "";
        },
      );
      text = text.trim();

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
      setPrevItems,
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
      <Box borderStyle="round">
        {loading ? (
          <TerminalChatInputThinking
            onInterrupt={interruptAgent}
            active={active}
          />
        ) : (
          <Box paddingX={1}>
            <TextInput
              focus={active}
              placeholder={
                selectedSuggestion
                  ? `"${suggestions[selectedSuggestion - 1]}"`
                  : "send a message" +
                    (isNew ? " or press tab to select a suggestion" : "")
              }
              showCursor
              value={input}
              onChange={(value) => {
                setDraftInput(value);
                if (historyIndex != null) {
                  setHistoryIndex(null);
                }
                setInput(value);
              }}
              onSubmit={onSubmit}
            />
          </Box>
        )}
      </Box>
      <Box paddingX={2} marginBottom={1}>
        <Text dimColor>
          {isNew && !input ? (
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
              send q or ctrl+c to exit | send "/clear" to reset | send "/help"
              for commands | press enter to send
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

  // Cycle the "Thinking…" animation dots.
  useInterval(() => {
    setDots((prev) => (prev.length < 3 ? prev + "." : ""));
  }, 500);

  // Listen for the escape key to allow the user to interrupt the current
  // operation. We require two presses within a short window (1.5s) to avoid
  // accidental cancellations.
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
        <Text>Thinking{dots}</Text>
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
