import React from 'react';
import type { ActivityItem } from './ui';

type Props = {
  items: ActivityItem[];
};

function fmt(ts: number) {
  const d = new Date(ts);
  return new Intl.DateTimeFormat('en-KE', {
    timeZone: 'Africa/Nairobi',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

export function ActivityFeed(props: Props) {
  const items = props.items.slice(0, 30);
  return (
    <div className="card">
      <div className="cardHeader">
        <strong>Activity</strong>
        <span className="muted">last {items.length}</span>
      </div>
      <div className="feed">
        {items.length === 0 ? <div className="muted">No activity yet</div> : null}
        {items.map((a) => (
          <div key={a.id} className="feedRow">
            <div className="feedTime">{fmt(a.createdAt)}</div>
            <div className="feedBody">
              <div className="feedTitle">{a.title}</div>
              <div className="feedMeta">{a.source}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
