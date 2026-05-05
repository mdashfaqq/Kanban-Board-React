import { useState } from "react";

export default function Card({ card, dispatch, isDragging, setDragging }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(card.title);

  const save = () => {
    const title = draft.trim();
    if (title && title !== card.title) dispatch({ type: "UPDATE_CARD", id: card.id, changes: { title } });
    else setDraft(card.title);
    setEditing(false);
  };

  const cyclePriority = () => {
    const order = ["low", "medium", "high"];
    const next = order[(order.indexOf(card.priority) + 1) % order.length];
    dispatch({ type: "UPDATE_CARD", id: card.id, changes: { priority: next } });
  };

  return (
    <article
      data-card
      className={`card ${card.priority} ${isDragging ? "dragging" : ""}`}
      draggable={!editing}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", card.id);
        e.dataTransfer.effectAllowed = "move";
        setDragging(card.id);
      }}
      onDragEnd={() => setDragging(null)}
    >
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") { setDraft(card.title); setEditing(false); }
          }}
        />
      ) : (
        <p onDoubleClick={() => setEditing(true)} title="Double-click to edit">{card.title}</p>
      )}
      <footer>
        <button className={`badge ${card.priority}`} onClick={cyclePriority} title="Click to change priority">
          {card.priority}
        </button>
        {card.tags.map((t) => (
          <span key={t} className="tag">#{t}</span>
        ))}
        <button className="delete" aria-label="Delete card" onClick={() => dispatch({ type: "DELETE_CARD", id: card.id })}>
          ×
        </button>
      </footer>
    </article>
  );
}
