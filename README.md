# Kanban Board (React)

A Trello-style task board built with **React 18 and Vite**, with native HTML5 drag and drop, precise drop positioning, inline editing, tags, priorities, search and filtering, and automatic persistence. No UI or drag-and-drop libraries.

## Features

- **Drag and drop** between and within columns, with a drop-position indicator line
- **Filter-aware drops**: dropping while a filter hides some cards still lands in the correct position in the full list
- **Inline editing**: double-click a card to rename it (Enter saves, Esc cancels)
- **Priorities**: click a card's badge to cycle low → medium → high, color-coded
- **Tags**: type `#frontend` in a new card's title to tag it
- **Search and filter** by title, tag or priority
- **Progress bar** for completed vs total cards
- **Persistence** to `localStorage`, with safe fallbacks
- **Dark mode** that follows the system theme
- **Unit-tested reducer** (Vitest)

## Architecture

All board state lives in a single `useReducer` with a normalized shape:

```js
{
  cards:   { c1: { id, title, priority, tags }, ... },   // lookup by id
  columns: { todo: ["c2", "c3"], progress: ["c1"], ... }  // ordered ids per column
}
```

Normalizing means moving a card only rewrites two small id arrays, and card data is never duplicated. The reducer (`src/boardReducer.js`) is a pure function with no React imports, which keeps it easy to unit-test.

## Run it

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

```bash
npm test          # reducer unit tests
npm run build     # production build in dist/
```

## Project structure

```
src/
  boardReducer.js        # pure state logic: add, update, delete, move, filter
  boardReducer.test.js   # Vitest unit tests
  App.jsx                # layout, filters, persistence
  components/Column.jsx  # drop zone, drop-index calculation, add-card form
  components/Card.jsx    # draggable card, inline edit, priority toggle
  App.css                # styles + dark mode
```

## Possible extensions

- Touch support for mobile drag and drop
- Multiple boards and user-defined columns
- Backend sync with a REST API

## Tech stack

React 18, Vite, JavaScript, CSS, Vitest
