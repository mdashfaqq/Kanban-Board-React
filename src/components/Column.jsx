import { useState } from "react";
import Card from "./Card";

export default function Column({ column, cardIds, allCardIds, cards, dispatch, dragging, setDragging }) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dropIndex, setDropIndex] = useState(null);

  const addCard = (e) => {
    e.preventDefault();
    const tags = [...title.matchAll(/#(\w+)/g)].map((m) => m[1]); // "#frontend" becomes a tag
    const clean = title.replace(/#\w+/g, "").trim();
    if (!clean) return;
    dispatch({ type: "ADD_CARD", columnId: column.id, title: clean, priority, tags });
    setTitle("");
  };

  // Map a position among *visible* cards to a position in the full column,
  // so dropping still works correctly while a filter is hiding some cards.
  const toFullIndex = (visibleIndex) => {
    if (visibleIndex >= cardIds.length) return allCardIds.length;
    return allCardIds.indexOf(cardIds[visibleIndex]);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    const cardEls = [...e.currentTarget.querySelectorAll("[data-card]")];
    const idx = cardEls.findIndex((el) => {
      const box = el.getBoundingClientRect();
      return e.clientY < box.top + box.height / 2;
    });
    setDropIndex(idx === -1 ? cardEls.length : idx);
  };

  const onDrop = (e) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragging;
    if (id) {
      let target = toFullIndex(dropIndex ?? cardIds.length);
      // Moving down within the same column: removing the card first shifts indexes by one.
      const from = allCardIds.indexOf(id);
      if (from !== -1 && from < target) target -= 1;
      dispatch({ type: "MOVE_CARD", id, toColumn: column.id, toIndex: target });
    }
    setDropIndex(null);
    setDragging(null);
  };

  return (
    <section
      className={`column ${dropIndex !== null ? "drop-target" : ""}`}
      onDragOver={onDragOver}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget) && setDropIndex(null)}
      onDrop={onDrop}
    >
      <h2>
        {column.title} <span className="count">{allCardIds.length}</span>
      </h2>

      <div className="cards">
        {cardIds.map((id, i) => (
          <div key={id}>
            {dropIndex === i && dragging && <div className="drop-line" />}
            <Card card={cards[id]} dispatch={dispatch} isDragging={dragging === id} setDragging={setDragging} />
          </div>
        ))}
        {dropIndex === cardIds.length && dragging && <div className="drop-line" />}
        {cardIds.length === 0 && <p className="empty">Drop cards here</p>}
      </div>

      <form onSubmit={addCard} className="add">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New card (use #tags)" />
        <select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Priority">
          <option value="high">High</option>
          <option value="medium">Med</option>
          <option value="low">Low</option>
        </select>
        <button type="submit">Add</button>
      </form>
    </section>
  );
}
