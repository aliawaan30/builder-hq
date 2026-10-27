import { useState, type ReactNode } from 'react';

export interface Column {
  id: string;
  label: string;
}

interface Props<T extends { id: string }> {
  label: string;
  columns: Column[];
  items: T[];
  columnOf: (item: T) => string;
  onMove: (item: T, column: string) => void;
  onOpen: (item: T) => void;
  renderCard: (item: T) => ReactNode;
  onAdd?: (column: string) => void;
}

export function Kanban<T extends { id: string }>({ label, columns, items, columnOf, onMove, onOpen, renderCard, onAdd }: Props<T>) {
  const [over, setOver] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const end = () => {
    setOver(null);
    setDragging(null);
  };

  return (
    <div className="kanban" aria-label={label}>
      {columns.map((col) => {
        const list = items.filter((i) => columnOf(i) === col.id);
        return (
          <section
            key={col.id}
            className={`col${over === col.id ? ' is-over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              if (over !== col.id) setOver(col.id);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const item = items.find((i) => i.id === e.dataTransfer.getData('text/plain'));
              end();
              if (item && columnOf(item) !== col.id) onMove(item, col.id);
            }}
          >
            <header className="col-head">
              <h3>{col.label}</h3>
              <span className="count">{list.length}</span>
              {onAdd && (
                <button type="button" className="icon-btn" aria-label={`Add to ${col.label}`} onClick={() => onAdd(col.id)}>
                  +
                </button>
              )}
            </header>
            <div className="col-body">
              {list.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  draggable
                  className={`card${dragging === item.id ? ' is-dragging' : ''}`}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', item.id);
                    e.dataTransfer.effectAllowed = 'move';
                    setDragging(item.id);
                  }}
                  onDragEnd={end}
                  onClick={() => onOpen(item)}
                >
                  {renderCard(item)}
                </button>
              ))}
              {!list.length && <p className="col-empty">Nothing here</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
