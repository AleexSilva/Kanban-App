"use client";

import { useEffect, useRef, useState } from "react";
import { sendChat, type ChatMessage } from "@/lib/api";

type ChatSidebarProps = {
  onBoardRefresh: () => void;
};

export const ChatSidebar = ({ onBoardRefresh }: ChatSidebarProps) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages, loading, open]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const history = messages;
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const result = await sendChat(text, history);
      setMessages([...next, { role: "assistant", content: result.reply }]);
      if (result.board_updated) {
        onBoardRefresh();
      }
    } catch {
      setError("Could not reach the AI. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  return (
    <>
      {open && (
        <section
          aria-label="AI chat"
          className="fixed bottom-24 right-6 z-50 flex h-[min(560px,75vh)] w-[360px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-3xl border border-[var(--stroke)] bg-white shadow-[var(--shadow)]"
        >
          <div className="flex items-start justify-between border-b border-[var(--stroke)] px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                AI Assistant
              </p>
              <h2 className="mt-1 font-display text-lg font-semibold text-[var(--navy-dark)]">
                Board Chat
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-transparent px-2 py-1 text-sm font-semibold text-[var(--gray-text)] transition hover:border-[var(--stroke)] hover:text-[var(--navy-dark)]"
            >
              Close
            </button>
          </div>

          <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && !loading && (
              <p className="mt-8 text-center text-sm text-[var(--gray-text)]">
                Ask me to add, move, or edit cards on your board.
              </p>
            )}

            {messages.map((msg, i) =>
              msg.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-[var(--primary-blue)] px-4 py-2.5 text-sm text-white">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-[var(--stroke)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--navy-dark)]">
                    {msg.content}
                  </div>
                </div>
              )
            )}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-tl-sm border border-[var(--stroke)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--gray-text)]">
                  Thinking...
                </div>
              </div>
            )}

            {error && (
              <p role="alert" className="text-center text-xs text-[var(--secondary-purple)]">
                {error}
              </p>
            )}

            <div ref={bottomRef} />
          </div>

          <div className="border-t border-[var(--stroke)] p-4">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask the AI..."
                rows={2}
                aria-label="Chat input"
                className="flex-1 resize-none rounded-xl border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none placeholder:text-[var(--gray-text)] focus:border-[var(--primary-blue)]"
              />
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={!input.trim() || loading}
                className="rounded-xl bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
              >
                Send
              </button>
            </div>
            <p className="mt-2 text-xs text-[var(--gray-text)]">
              Enter to send, Shift+Enter for newline
            </p>
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? "Close AI chat" : "Open AI chat"}
        aria-expanded={open}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--secondary-purple)] text-white shadow-[var(--shadow)] transition hover:opacity-90"
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 5.5A1.5 1.5 0 015.5 4h13A1.5 1.5 0 0120 5.5v9a1.5 1.5 0 01-1.5 1.5H9l-4 4v-4H5.5A1.5 1.5 0 014 14.5v-9z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
    </>
  );
};
