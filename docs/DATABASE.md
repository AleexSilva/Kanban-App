# Database

The MVP uses a local SQLite database. Each user's Kanban board is stored as a single JSON document,
matching the frontend `BoardData` shape exactly, so there is no mapping layer between the API and the
UI. The schema includes a `users` table to support multiple users in the future, even though the MVP
has only the one hardcoded user.

## Why JSON-in-SQLite (not normalized tables)

The frontend already owns a complete, normalized board model (`columns` with ordered `cardIds`, plus a
`cards` lookup). Splitting that into relational tables (boards / columns / cards with foreign keys and
ordering columns) would add migration code, join logic, and an object-relational mapping for no MVP
benefit. Storing the board as one JSON blob:

- mirrors the frontend contract one-to-one (read/write the same shape the UI uses),
- makes `GET /api/board` and `PUT /api/board` trivial (read/replace one row),
- keeps the door open for normalization later if querying inside boards is ever needed.

This follows the project's "keep it simple, never over-engineer" standard.

## Schema

```sql
CREATE TABLE IF NOT EXISTS users (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS boards (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    data    TEXT NOT NULL          -- BoardData serialized as JSON
);
```

- `users`: one row per user. The MVP seeds a single row, `username = "user"` (the hardcoded login).
- `boards`: one row per user (`user_id` is both primary key and foreign key, enforcing one board per
  user for the MVP). `data` holds the entire board as a JSON string.

## The `data` JSON shape

The `data` column holds exactly the frontend `BoardData` type from
[frontend/src/lib/kanban.ts](../frontend/src/lib/kanban.ts):

```jsonc
{
  "columns": [
    { "id": "col-backlog", "title": "Backlog", "cardIds": ["card-1", "card-2"] }
    // ...
  ],
  "cards": {
    "card-1": { "id": "card-1", "title": "Align roadmap themes", "details": "..." }
    // ...
  }
}
```

Field-for-field match with the TypeScript types:

| TypeScript (`kanban.ts`)                          | JSON in `data`                          |
| ------------------------------------------------- | --------------------------------------- |
| `Card = { id: string; title: string; details: string }` | `{ "id", "title", "details" }` (all strings) |
| `Column = { id: string; title: string; cardIds: string[] }` | `{ "id", "title", "cardIds": [string] }` |
| `BoardData = { columns: Column[]; cards: Record<string, Card> }` | `{ "columns": [...], "cards": { id: Card } }` |

Card ordering within a column is the order of `cardIds`. The `cards` map is keyed by card id; each
card's own `id` matches its key.

## Creation and seeding

- The SQLite file (default `pm.db`, path overridable via an env var such as `DATABASE_PATH`) is created
  automatically on startup if it does not exist.
- The `CREATE TABLE IF NOT EXISTS` statements run on startup, so tables are created on first run.
- On first access for a user with no board row, the backend seeds a default board equivalent to the
  frontend `initialData` (5 columns, 8 cards) and stores it. Subsequent reads return the stored board.

This is implemented in Part 6 (backend API routes). This document defines the shape and approach that
Part 6 follows.
