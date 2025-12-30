import React, { useState, useEffect } from 'react';

export type BackupDrivePayload = {
  drivePath: string;
  driveLabel: string;
  freeSpaceBytes?: number;
  totalSpaceBytes?: number;
};

type Props = {
  open: boolean;
  payload: BackupDrivePayload | null;
  onClose: () => void;
  onBound?: () => void;
};

function fmtBytes(n: number | null | undefined) {
  const x = Number(n ?? 0);
  if (!Number.isFinite(x) || x <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = x;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function BackupDriveBindingModal(props: Props) {
  const { open, payload, onClose, onBound } = props;
  const api = window.gate1;

  const [driveLabel, setDriveLabel] = useState('');
  const [binding, setBinding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && payload) {
      setDriveLabel(payload.driveLabel || '');
      setError(null);
    }
  }, [open, payload]);

  if (!open || !payload) return null;

  const canBind = driveLabel.trim().length > 0;

  const handleBind = async () => {
    if (!canBind || !api?.backup?.bindDrive) return;

    setBinding(true);
    setError(null);

    try {
      const result = await api.backup.bindDrive({
        drivePath: payload.drivePath,
        driveLabel: driveLabel.trim(),
      });

      if (result?.ok) {
        await api?.ui?.toast?.({
          kind: 'success',
          title: 'Backup drive bound',
          message: `${driveLabel.trim()} is now configured for backups`,
        });
        onBound?.();
        onClose();
      } else {
        setError(result?.reason || 'Failed to bind drive');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to bind drive');
    } finally {
      setBinding(false);
    }
  };

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="cardHeader">
          <strong>Bind Backup Drive</strong>
          <button className="btn" onClick={onClose}>×</button>
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="muted">Configure this drive for backups:</div>
          <div style={{ marginTop: 8, padding: 12, background: 'rgba(0,0,0,0.04)', borderRadius: 8 }}>
            <div><strong>Path:</strong> {payload.drivePath}</div>
            {payload.freeSpaceBytes !== undefined && (
              <div className="muted" style={{ marginTop: 4 }}>
                Free: {fmtBytes(payload.freeSpaceBytes)} / {fmtBytes(payload.totalSpaceBytes)}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>
            Drive Label
          </label>
          <input
            type="text"
            value={driveLabel}
            onChange={(e) => setDriveLabel(e.target.value)}
            placeholder="e.g., Backup Drive 1, External SSD"
            style={{ width: '100%' }}
            autoFocus
          />
          <div className="muted" style={{ marginTop: 4, fontSize: 11 }}>
            A friendly name to identify this backup drive.
          </div>
        </div>

        {error && (
          <div className="bannerInline" style={{ marginTop: 12, background: 'rgba(239,68,68,0.1)', color: '#dc2626' }}>
            {error}
          </div>
        )}

        <div className="row" style={{ marginTop: 20, justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose} disabled={binding}>
            Cancel
          </button>
          <button
            className="btn"
            onClick={handleBind}
            disabled={!canBind || binding}
            style={{ background: canBind ? '#2563eb' : undefined, color: canBind ? '#fff' : undefined }}
          >
            {binding ? 'Binding…' : 'Bind Drive'}
          </button>
        </div>
      </div>
    </div>
  );
}
