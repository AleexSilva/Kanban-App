"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { createId, moveCard, type BoardData } from "@/lib/kanban";
import { getBoard, saveBoard } from "@/lib/api";

// pointerWithin finds the droppable whose bounds contain the pointer — exact and
// column-aware. rectIntersection handles drops in gaps or column headers where
// the pointer falls outside all registered droppables.
const collisionDetection: CollisionDetection = (args) => {
  const pw = pointerWithin(args);
  return pw.length > 0 ? pw : rectIntersection(args);
};

type KanbanBoardProps = {
  onLogout?: () => void;
  refreshTrigger?: number;
};

type Status = "loading" | "ready" | "error";

export const KanbanBoard = ({ onLogout, refreshTrigger }: KanbanBoardProps = {}) => {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  // Tracks the last column seen during onDragOver so handleDragEnd has a
  // fallback when the pointer leaves all droppable bounds just before mouseup.
  const overColumnIdRef = useRef<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  useEffect(() => {
    getBoard()
      .then((data) => {
        setBoard(data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [refreshTrigger]);

  const persist = (next: BoardData) => {
    void saveBoard(next).catch(() => {});
  };

  // Optimistic local update that also persists the resulting board.
  const mutate = (producer: (prev: BoardData) => BoardData) => {
    setBoard((prev) => {
      if (!prev) return prev;
      const next = producer(prev);
      persist(next);
      return next;
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
    overColumnIdRef.current = null;
  };

  const handleDragOver = ({ over }: DragOverEvent) => {
    if (!over || !board) return;
    const id = over.id as string;
    const isColumn = board.columns.some((col) => col.id === id);
    overColumnIdRef.current = isColumn
      ? id
      : (board.columns.find((col) => col.cardIds.includes(id))?.id ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);
    const overId = (over?.id as string | undefined) ?? overColumnIdRef.current;
    overColumnIdRef.current = null;
    if (!overId || active.id === overId) return;
    mutate((prev) => ({
      ...prev,
      columns: moveCard(prev.columns, active.id as string, overId),
    }));
  };

  // Rename updates locally on each keystroke for smooth typing; it persists on
  // blur (handleRenameCommit) to avoid a request per keystroke.
  const handleRenameColumn = (columnId: string, title: string) => {
    setBoard((prev) =>
      prev
        ? {
            ...prev,
            columns: prev.columns.map((column) =>
              column.id === columnId ? { ...column, title } : column
            ),
          }
        : prev
    );
  };

  const handleRenameCommit = useCallback(() => {
    if (board) persist(board);
  }, [board]);

  const handleAddCard = (columnId: string, title: string, details: string) => {
    const id = createId("card");
    mutate((prev) => ({
      ...prev,
      cards: {
        ...prev.cards,
        [id]: { id, title, details: details || "No details yet." },
      },
      columns: prev.columns.map((column) =>
        column.id === columnId
          ? { ...column, cardIds: [...column.cardIds, id] }
          : column
      ),
    }));
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    mutate((prev) => ({
      ...prev,
      cards: Object.fromEntries(
        Object.entries(prev.cards).filter(([id]) => id !== cardId)
      ),
      columns: prev.columns.map((column) =>
        column.id === columnId
          ? {
              ...column,
              cardIds: column.cardIds.filter((id) => id !== cardId),
            }
          : column
      ),
    }));
  };

  const handleEditCard = (cardId: string, title: string, details: string) => {
    mutate((prev) => ({
      ...prev,
      cards: {
        ...prev.cards,
        [cardId]: { ...prev.cards[cardId], title, details },
      },
    }));
  };

  const activeCard = activeCardId && board ? board.cards[activeCardId] : null;

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen max-w-[1500px] flex-col gap-10 px-6 pb-16 pt-12">
        <header className="flex flex-col gap-6 rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                Single Board Kanban
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
                Kanban Studio
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--gray-text)]">
                Keep momentum visible. Rename columns, drag cards between stages,
                and capture quick notes without getting buried in settings.
              </p>
            </div>
            <div className="flex flex-col items-end gap-3">
              {onLogout ? (
                <button
                  type="button"
                  onClick={onLogout}
                  className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)] transition hover:border-[var(--primary-blue)]"
                >
                  Log out
                </button>
              ) : null}
              <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                  Focus
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--primary-blue)]">
                  One board. Five columns. Zero clutter.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {board?.columns.map((column) => (
              <div
                key={column.id}
                className="flex items-center gap-2 rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]"
              >
                <span className="h-2 w-2 rounded-full bg-[var(--accent-yellow)]" />
                {column.title}
              </div>
            ))}
          </div>
        </header>

        {status === "loading" ? (
          <p className="text-sm text-[var(--gray-text)]">Loading board...</p>
        ) : null}
        {status === "error" ? (
          <p role="alert" className="text-sm text-[var(--secondary-purple)]">
            Could not load the board.
          </p>
        ) : null}

        {status === "ready" && board ? (
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <section className="grid gap-6 lg:grid-cols-5">
              {board.columns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  cards={column.cardIds.map((cardId) => board.cards[cardId])}
                  onRename={handleRenameColumn}
                  onRenameCommit={handleRenameCommit}
                  onAddCard={handleAddCard}
                  onDeleteCard={handleDeleteCard}
                  onEditCard={handleEditCard}
                />
              ))}
            </section>
            <DragOverlay>
              {activeCard ? (
                <div className="w-[260px]">
                  <KanbanCardPreview card={activeCard} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : null}
      </main>
    </div>
  );
};
