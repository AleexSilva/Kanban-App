import { expect, test } from "@playwright/test";
import { seedBoard } from "./seed";

test("chat reply appears in sidebar and board updates when board_updated is true", async ({
  page,
}) => {
  let board = seedBoard();

  await page.route("**/api/me", (route) =>
    route.fulfill({ status: 200, json: { username: "user" } })
  );

  // Stateful board mock: GET returns current board, PUT replaces it.
  await page.route("**/api/board", (route) => {
    if (route.request().method() === "PUT") {
      board = route.request().postDataJSON();
      return route.fulfill({ status: 200, json: board });
    }
    return route.fulfill({ status: 200, json: board });
  });

  // Chat mock: adds a new card to the board state so the subsequent GET returns it.
  await page.route("**/api/chat", (route) => {
    board.cards["card-ai"] = {
      id: "card-ai",
      title: "AI created card",
      details: "Added by the assistant.",
    };
    board.columns[0].cardIds.push("card-ai");
    return route.fulfill({
      status: 200,
      json: { reply: "Done, I added a card!", board_updated: true },
    });
  });

  await page.goto("/");
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);

  // Send a message via the chat sidebar.
  await page.getByLabel("Chat input").fill("Add a card please");
  await page.getByRole("button", { name: /send/i }).click();

  // The assistant reply appears in the chat.
  await expect(page.getByText("Done, I added a card!")).toBeVisible();

  // The board refreshes and the new card is visible.
  await expect(page.getByText("AI created card")).toBeVisible();
});
