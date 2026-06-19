# Code Review Exceptions

All 15 items from `code_review.md` have been resolved. No open exceptions remain.

---

## Previously excepted — #4 / #10: ESLint `react-hooks/set-state-in-effect` (resolved)

**Was:** Bug #4's fix added a `useEffect` in `KanbanCard.tsx` that called `setState` inside an
effect body, triggering the `react-hooks/set-state-in-effect` lint rule from
`eslint-config-next/core-web-vitals`.

**Resolution:** Replaced the `useEffect` approach with a content-based `key` on `KanbanCard` in
`KanbanColumn.tsx`:

```tsx
<KanbanCard
  key={`${card.id}:${card.title}:${card.details}`}
  card={card}
  ...
/>
```

When the AI updates a card's title or details, React remounts the component with fresh local
state from the new props — no `setState` inside an effect needed. `npm run lint` is now clean.
