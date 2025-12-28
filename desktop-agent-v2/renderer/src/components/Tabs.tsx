import React from 'react';

export type TabId = 'today' | 'sessions' | 'backup' | 'issues' | 'settings' | 'advanced' | 'tools';

type Props = {
  value: TabId;
  onChange: (t: TabId) => void;
};

const primaryTabs: Array<{ id: TabId; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'backup', label: 'Backup' },
  { id: 'issues', label: 'Issues' },
];

const secondaryTabs: Array<{ id: TabId; label: string }> = [
  { id: 'settings', label: 'Settings' },
  { id: 'advanced', label: 'Advanced' },
  ...(import.meta.env.DEV ? [{ id: 'tools' as const, label: 'Tools' }] : []),
];

export function Tabs(props: Props) {
  return (
    <div className="tabs" style={{ justifyContent: 'space-between' }}>
      <div className="row" style={{ gap: 8 }}>
        {primaryTabs.map((t) => (
          <button
            key={t.id}
            className={props.value === t.id ? 'tab tabActive' : 'tab'}
            onClick={() => props.onChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="row" style={{ gap: 8, opacity: 0.75 }}>
        {secondaryTabs.map((t) => (
          <button
            key={t.id}
            className={props.value === t.id ? 'tab tabActive' : 'tab'}
            onClick={() => props.onChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
