import type { Page } from "@playwright/test";

// Mirrors the backend default board / frontend initialData (enough for e2e).
export const seedBoard = () => ({
  columns: [
    { id: "col-backlog", title: "Backlog", cardIds: ["card-1", "card-2"] },
    { id: "col-discovery", title: "Discovery", cardIds: ["card-3"] },
    { id: "col-progress", title: "In Progress", cardIds: ["card-4", "card-5"] },
    { id: "col-review", title: "Review", cardIds: ["card-6"] },
    { id: "col-done", title: "Done", cardIds: ["card-7", "card-8"] },
  ],
  cards: {
    "card-1": { id: "card-1", title: "Align roadmap themes", details: "Draft quarterly themes." },
    "card-2": { id: "card-2", title: "Gather customer signals", details: "Review support tags." },
    "card-3": { id: "card-3", title: "Prototype analytics view", details: "Sketch dashboard." },
    "card-4": { id: "card-4", title: "Refine status language", details: "Standardize labels." },
    "card-5": { id: "card-5", title: "Design card layout", details: "Add hierarchy." },
    "card-6": { id: "card-6", title: "QA micro-interactions", details: "Verify states." },
    "card-7": { id: "card-7", title: "Ship marketing page", details: "Final copy approved." },
    "card-8": { id: "card-8", title: "Close onboarding sprint", details: "Document notes." },
  },
});

// Installs an authenticated session plus a stateful in-memory board API:
// GET returns the current board, PUT replaces it. The state lives in this
// closure (Node side), so it survives page.reload() within a test.
export async function mockBoardApi(page: Page) {
  let board = seedBoard();
  await page.route("**/api/me", (route) =>
    route.fulfill({ status: 200, json: { username: "user" } })
  );
  await page.route("**/api/board", (route) => {
    if (route.request().method() === "PUT") {
      board = route.request().postDataJSON();
      return route.fulfill({ status: 200, json: board });
    }
    return route.fulfill({ status: 200, json: board });
  });
}
