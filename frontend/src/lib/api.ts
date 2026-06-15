import type { BoardData } from "@/lib/kanban";

export async function getBoard(): Promise<BoardData> {
  const response = await fetch("/api/board");
  if (!response.ok) {
    throw new Error("Failed to load board.");
  }
  return (await response.json()) as BoardData;
}

export async function saveBoard(board: BoardData): Promise<void> {
  const response = await fetch("/api/board", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(board),
  });
  if (!response.ok) {
    throw new Error("Failed to save board.");
  }
}

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type ChatResponse = { reply: string; board_updated: boolean };

export async function sendChat(
  message: string,
  history: ChatMessage[]
): Promise<ChatResponse> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });
  if (!response.ok) {
    throw new Error("Chat request failed.");
  }
  return (await response.json()) as ChatResponse;
}
