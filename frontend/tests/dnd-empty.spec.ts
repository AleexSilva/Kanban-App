import { expect, test } from "@playwright/test";
import { mockBoardApi } from "./seed";

test.beforeEach(async ({ page }) => {
  await mockBoardApi(page);
});

type Page = import("@playwright/test").Page;

// Drag a card and drop it at a point (offsetY from the column top) inside a column.
async function dragCardToColumnY(
  page: Page,
  cardTestId: string,
  columnTestId: string,
  offsetY: number
) {
  const card = page.getByTestId(cardTestId);
  const column = page.getByTestId(columnTestId);
  const cardBox = await card.boundingBox();
  const columnBox = await column.boundingBox();
  if (!cardBox || !columnBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }
  await page.mouse.move(
    cardBox.x + cardBox.width / 2,
    cardBox.y + cardBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    columnBox.x + columnBox.width / 2,
    columnBox.y + offsetY,
    { steps: 16 }
  );
  await page.mouse.up();
}

// Returns the ordered card test ids within a column.
async function cardOrder(page: Page, columnTestId: string): Promise<string[]> {
  return page
    .getByTestId(columnTestId)
    .locator('[data-testid^="card-"]')
    .evaluateAll((nodes) =>
      nodes.map((n) => n.getAttribute("data-testid") ?? "")
    );
}

test("moves a card into an empty column", async ({ page }) => {
  await page.goto("/");

  // Empty the review column (it only has card-6).
  const reviewColumn = page.getByTestId("column-col-review");
  await reviewColumn
    .getByRole("button", { name: "Delete QA micro-interactions", exact: true })
    .click();
  await expect(reviewColumn.getByText("Drop a card here")).toBeVisible();

  // Drag card-1 from Backlog into the now-empty Review column.
  await dragCardToColumnY(page, "card-card-1", "column-col-review", 200);

  await expect(reviewColumn.getByTestId("card-card-1")).toBeVisible();
});

test("moves a card into the empty space below cards in another column", async ({
  page,
}) => {
  await page.goto("/");
  // Discovery has a single card (card-3) and lots of empty space below it.
  // Drop near the bottom of the column, over the empty background.
  await dragCardToColumnY(page, "card-card-1", "column-col-discovery", 480);

  await expect(
    page.getByTestId("column-col-discovery").getByTestId("card-card-1")
  ).toBeVisible();
});

test("reorders a card to the bottom empty space of its own column", async ({
  page,
}) => {
  await page.goto("/");
  // Wait for the board to finish loading before reading DOM state.
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
  // Done has card-7 then card-8. Drag card-7 to the bottom empty area.
  expect(await cardOrder(page, "column-col-done")).toEqual([
    "card-card-7",
    "card-card-8",
  ]);

  await dragCardToColumnY(page, "card-card-7", "column-col-done", 480);

  expect(await cardOrder(page, "column-col-done")).toEqual([
    "card-card-8",
    "card-card-7",
  ]);
});
