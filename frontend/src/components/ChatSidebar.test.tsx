import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { sendChatMock } = vi.hoisted(() => ({
  sendChatMock: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  sendChat: sendChatMock,
}));

import { ChatSidebar } from "@/components/ChatSidebar";

describe("ChatSidebar", () => {
  const onBoardRefresh = vi.fn();

  beforeEach(() => {
    onBoardRefresh.mockReset();
    sendChatMock.mockReset();
  });

  // The chat is collapsed by default behind a floating button; open it first.
  const openChat = async () => {
    render(<ChatSidebar onBoardRefresh={onBoardRefresh} />);
    await userEvent.click(screen.getByRole("button", { name: "Open AI chat" }));
  };

  it("is collapsed by default and shows only the toggle button", () => {
    render(<ChatSidebar onBoardRefresh={onBoardRefresh} />);
    expect(
      screen.getByRole("button", { name: "Open AI chat" })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Chat input")).not.toBeInTheDocument();
  });

  it("opens the panel and shows the empty state prompt", async () => {
    await openChat();
    expect(screen.getByText(/ask me to add/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Chat input")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
  });

  it("closes the panel when the close button is clicked", async () => {
    await openChat();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByLabelText("Chat input")).not.toBeInTheDocument();
  });

  it("sends a message and displays the assistant reply", async () => {
    sendChatMock.mockResolvedValue({ reply: "The answer is 4.", board_updated: false });
    await openChat();

    await userEvent.type(screen.getByLabelText("Chat input"), "What is 2+2?");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await screen.findByText("What is 2+2?");
    await screen.findByText("The answer is 4.");
    expect(onBoardRefresh).not.toHaveBeenCalled();
  });

  it("calls onBoardRefresh when board_updated is true", async () => {
    sendChatMock.mockResolvedValue({ reply: "Done!", board_updated: true });
    await openChat();

    await userEvent.type(screen.getByLabelText("Chat input"), "Add a card");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(onBoardRefresh).toHaveBeenCalledOnce());
  });

  it("shows an error when the request fails", async () => {
    sendChatMock.mockRejectedValue(new Error("Network error"));
    await openChat();

    await userEvent.type(screen.getByLabelText("Chat input"), "Hello");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await screen.findByRole("alert");
    expect(screen.getByRole("alert")).toHaveTextContent(/could not reach/i);
    expect(onBoardRefresh).not.toHaveBeenCalled();
  });
});
