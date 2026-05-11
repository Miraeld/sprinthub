import React, { useState } from 'react';
import { BoardItem } from '../../src/types';
import { ItemCard } from './ItemCard';

interface Props {
  column: string;
  items: BoardItem[];
  config: { color: string; emoji: string };
  onSelect: (item: BoardItem) => void;
  onOpenUrl: (url: string) => void;
}

export function ColumnGroup({ column, items, config, onSelect, onOpenUrl }: Props) {
  const [open, setOpen] = useState(true);

  return (
    <div className="col-group">
      <div className="col-header" onClick={() => setOpen((v) => !v)}>
        <span className={`col-chevron${open ? ' open' : ''}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </span>
        <span className="col-dot" style={{ background: config.color }} />
        <span className="col-name">{column}</span>
        <span className="col-count">{items.length}</span>
      </div>

      {open && (
        <div className="col-items">
          {items.length === 0 ? (
            <div className="empty-group">No items</div>
          ) : (
            items
              .slice()
              .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
              .map((item) => (
                <ItemCard key={item.id} item={item} onSelect={onSelect} onOpenUrl={onOpenUrl} />
              ))
          )}
        </div>
      )}
    </div>
  );
}
