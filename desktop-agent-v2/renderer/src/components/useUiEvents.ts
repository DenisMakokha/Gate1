import { useEffect } from 'react';
import type { ActivityItem, BannerItem, ToastItem } from './ui';

export type UiDispatch = (action:
  | { type: 'toast:add'; toast: ToastItem }
  | { type: 'toast:remove'; id: string }
  | { type: 'banner:addOrReplace'; banner: BannerItem }
  | { type: 'banner:dismiss'; id: string }
  | { type: 'activity:add'; item: ActivityItem }
) => void;

function now() {
  return Date.now();
}

function id(prefix: string) {
  return `${prefix}-${now()}-${Math.random().toString(16).slice(2)}`;
}

export function useUiEvents(dispatch: UiDispatch) {
  useEffect(() => {
    const api = window.gate1;
    if (!api?.events?.on) return;

    const addActivity = (source: string, kind: ActivityItem['kind'], title: string, details?: any) => {
      dispatch({
        type: 'activity:add',
        item: { id: id('act'), source, kind, title, details, createdAt: now() },
      });
    };

    const toast = (kind: ToastItem['kind'], title: string, message?: string) => {
      const t: ToastItem = { id: id('toast'), kind, title, message, createdAt: now() };
      dispatch({ type: 'toast:add', toast: t });
      window.setTimeout(() => dispatch({ type: 'toast:remove', id: t.id }), 4500);
    };

    const banner = (kind: BannerItem['kind'], title: string, message?: string, sticky = true, actions?: BannerItem['actions']) => {
      dispatch({
        type: 'banner:addOrReplace',
        banner: { id: title, kind, title, message, sticky, actions, createdAt: now() },
      });
    };

    const unsubs: Array<() => void> = [];

    // High-signal events
    unsubs.push(api.events.on('sd:inserted', (d: any) => {
      addActivity('sd', 'info', 'SD inserted', d);
      toast('info', 'SD inserted');
    }));

    unsubs.push(api.events.on('sd:recognized', (d: any) => {
      addActivity('sd', 'success', 'SD recognized', d);
      toast('success', 'SD recognized');
    }));

    unsubs.push(api.events.on('sd:needs-binding', (d: any) => {
      addActivity('sd', 'warning', 'SD needs binding', d);
      toast('warning', 'SD needs binding');
      banner('warning', 'SD needs binding', 'Open Sessions to bind this SD card.', true);
    }));

    unsubs.push(api.events.on('sd:removed', (d: any) => {
      addActivity('sd', 'warning', 'SD removed', d);
      toast('warning', 'SD removed');
    }));

    unsubs.push(api.events.on('sd:removal-check', (d: any) => {
      addActivity('sd', 'warning', 'SD removal check', d);
      banner(
        'warning',
        'SD removal safety check',
        `Copied: ${d?.filesCopied ?? 0}, Pending: ${d?.filesPending ?? 0}`,
        true
      );
    }));

    unsubs.push(api.events.on('snapshot:starting', (d: any) => {
      addActivity('snapshot', 'info', 'Snapshot starting', d);
      toast('info', 'Snapshot starting');
    }));

    unsubs.push(api.events.on('snapshot:progress', (d: any) => {
      // keep these low-noise (no toast)
      addActivity('snapshot', 'info', 'Snapshot progress', d);
    }));

    unsubs.push(api.events.on('snapshot:complete', (d: any) => {
      addActivity('snapshot', 'success', 'Snapshot complete', d);
      toast('success', 'Snapshot complete');
    }));

    unsubs.push(api.events.on('snapshot:error', (d: any) => {
      addActivity('snapshot', 'error', 'Snapshot error', d);
      banner('error', 'Snapshot error', d?.message ?? 'unknown', true);
    }));

    unsubs.push(api.events.on('backup:starting', (d: any) => {
      addActivity('backup', 'info', 'Backup starting', d);
      toast('info', 'Backup starting');
    }));

    unsubs.push(api.events.on('backup:status', (d: any) => {
      addActivity('backup', 'info', 'Backup status', d);
    }));

    unsubs.push(api.events.on('backup:complete', (d: any) => {
      addActivity('backup', 'success', 'Backup complete', d);
      toast('success', 'Backup complete');
    }));

    unsubs.push(api.events.on('backup:file-error', (d: any) => {
      addActivity('backup', 'warning', 'Backup file error', d);
      banner('warning', 'Backup encountered file errors', d?.message ?? d?.relativePath ?? undefined, true);
    }));

    unsubs.push(api.events.on('backup:error', (d: any) => {
      addActivity('backup', 'error', 'Backup error', d);
      banner('error', 'Backup error', d?.message ?? 'unknown', true);
    }));

    unsubs.push(api.events.on('issues:updated', (list: any[]) => {
      const n = Array.isArray(list) ? list.length : 0;
      addActivity('issues', n > 0 ? 'warning' : 'info', `Issues updated (${n})`, list);
      if (n > 0) {
        toast('warning', 'Issues detected', `${n} issue(s) require attention`);
        banner('warning', 'Issues detected', `${n} issue(s) require attention`, true);
      }
    }));

    unsubs.push(api.events.on('session:progress', (d: any) => {
      // low-noise progress reporting (no toast)
      addActivity('session', 'info', 'Session progress reported', d);
    }));

    unsubs.push(api.events.on('attention:required', (d: any) => {
      addActivity('attention', 'warning', `Attention required: ${d?.reason ?? 'unknown'}`, d);
      banner('warning', 'Attention required', d?.reason ?? 'unknown', true);
    }));

    unsubs.push(api.events.on('attention:decision-recorded', (d: any) => {
      addActivity('attention', 'success', 'Attention handled', d);
      toast('success', 'Attention handled', d?.decision ? `Decision: ${d.decision}` : undefined);
      dispatch({ type: 'banner:dismiss', id: 'Attention required' });
    }));

    unsubs.push(api.events.on('sd:removal-decision-recorded', (d: any) => {
      addActivity('sd', 'info', 'SD removal decision', d);
      toast('info', 'SD decision recorded', d?.decision ?? undefined);
      dispatch({ type: 'banner:dismiss', id: 'Attention required' });
    }));

    // Session lifecycle
    unsubs.push(api.events.on('session:started', (d: any) => {
      addActivity('session', 'info', 'Session started', d);
      toast('info', 'Session started');
    }));

    unsubs.push(api.events.on('session:binding', (d: any) => {
      addActivity('session', 'info', 'Session binding updated', d);
    }));

    unsubs.push(api.events.on('session:restored', (d: any) => {
      addActivity('session', 'info', 'Session restored', d);
      toast('info', 'Session restored');
    }));

    unsubs.push(api.events.on('session:resumed', (d: any) => {
      addActivity('session', 'info', 'Session resumed', d);
      toast('info', 'Session resumed');
    }));

    unsubs.push(api.events.on('session:cleared', (d: any) => {
      addActivity('session', 'info', 'Session cleared', d);
    }));

    unsubs.push(api.events.on('session:ended', (d: any) => {
      addActivity('session', 'info', 'Session ended', d);
      toast('info', 'Session ended');
    }));

    // Server-side session status (low-noise)
    unsubs.push(api.events.on('session:server-queued', (d: any) => {
      addActivity('session', 'info', 'Server session queued', d);
    }));

    unsubs.push(api.events.on('session:server-starting', (d: any) => {
      addActivity('session', 'info', 'Server session starting', d);
    }));

    unsubs.push(api.events.on('session:server-started', (d: any) => {
      addActivity('session', 'success', 'Server session started', d);
      toast('success', 'Server session started');
    }));

    unsubs.push(api.events.on('session:ended-server', (d: any) => {
      addActivity('session', 'info', 'Server session ended', d);
    }));

    unsubs.push(api.events.on('copy:file-copied', (d: any) => {
      addActivity('copy', 'info', 'File copied', d);
    }));

    unsubs.push(api.events.on('ui:toast', (d: any) => {
      const kind = (d?.kind as ToastItem['kind']) ?? 'info';
      toast(kind, String(d?.title ?? 'Notification'), d?.message ? String(d.message) : undefined);
    }));

    unsubs.push(api.events.on('rename:tip', (d: any) => {
      addActivity('rename', 'info', 'Rename guidance', d);
    }));

    return () => {
      for (const u of unsubs) {
        try {
          u();
        } catch {
          // ignore
        }
      }
    };
  }, [dispatch]);
}
