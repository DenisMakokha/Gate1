import React from 'react';

export type TabId = 'today' | 'sessions' | 'backup' | 'issues' | 'settings';

type Props = {
  value: TabId;
  onChange: (t: TabId) => void;
};

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'backup', label: 'Backup' },
  { id: 'issues', label: 'Issues' },
  { id: 'settings', label: 'Settings' },
];

export function Tabs(props: Props) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button
          key={t.id}
          className={props.value === t.id ? 'tab tabActive' : 'tab'}
          onClick={() => props.onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
