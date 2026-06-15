import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { initialData } from "@/lib/kanban";

const { getBoardMock, saveBoardMock } = vi.hoisted(() => ({
  getBoardMock: vi.fn(),
  saveBoardMock: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  getBoard: getBoardMock,
  saveBoard: saveBoardMock,
}));

import { KanbanBoard } from "@/components/KanbanBoard";

beforeEach(() => {
  getBoardMock.mockResolvedValue(structuredClone(initialData));
  saveBoardMock.mockResolvedValue(undefined);
});

const firstColumn = async () =>
  (await screen.findAllByTestId(/column-/i))[0];

describe("KanbanBoard", () => {
  it("loads and renders five columns from the API", async () => {
    render(<KanbanBoard />);
    expect(await screen.findAllByTestId(/column-/i)).toHaveLength(5);
    expect(getBoardMock).toHaveBeenCalled();
  });

  it("renames a column and persists on blur", async () => {
    render(<KanbanBoard />);
    const column = await firstColumn();
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    expect(input).toHaveValue("New Name");

    fireEvent.blur(input);
    expect(saveBoardMock).toHaveBeenCalled();
  });

  it("adds and removes a card", async () => {
    render(<KanbanBoard />);
    const column = await firstColumn();
    await userEvent.click(
      within(column).getByRole("button", { name: /add a card/i })
    );

    await userEvent.type(
      within(column).getByPlaceholderText(/card title/i),
      "New card"
    );
    await userEvent.type(
      within(column).getByPlaceholderText(/details/i),
      "Notes"
    );
    await userEvent.click(
      within(column).getByRole("button", { name: /add card/i })
    );

    expect(within(column).getByText("New card")).toBeInTheDocument();
    expect(saveBoardMock).toHaveBeenCalled();

    await userEvent.click(
      within(column).getByRole("button", { name: /delete new card/i })
    );
    expect(within(column).queryByText("New card")).not.toBeInTheDocument();
  });

  it("edits a card's title and persists", async () => {
    render(<KanbanBoard />);
    const column = await firstColumn();

    await userEvent.click(
      within(column).getByRole("button", { name: /edit align roadmap themes/i })
    );
    const titleInput = within(column).getByLabelText("Card title");
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "Updated title");
    await userEvent.click(within(column).getByRole("button", { name: /save/i }));

    expect(within(column).getByText("Updated title")).toBeInTheDocument();
    expect(saveBoardMock).toHaveBeenCalled();
  });
});
