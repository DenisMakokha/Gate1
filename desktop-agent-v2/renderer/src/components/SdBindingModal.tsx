import React, { useState } from 'react';

export type SdBindingPayload = {
  hardwareId: string;
  mountPath: string;
  driveLetter: string;
  sessionId?: string;
};

type Props = {
  open: boolean;
  payload: SdBindingPayload | null;
  onClose: () => void;
  onBound?: () => void;
};

export function SdBindingModal(props: Props) {
  const api = window.gate1;
  const p = props.payload;

  const [cameraNumber, setCameraNumber] = useState<string>('');
  const [sdLabel, setSdLabel] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>('');

  if (!props.open || !p) return null;

  const canBind = !!api?.sd?.bind;

  const handleBind = async () => {
    if (!canBind) return;

    const camNum = parseInt(cameraNumber, 10);
    const label = sdLabel.trim().toUpperCase();

    if (!Number.isFinite(camNum) || camNum < 1) {
      setError('Enter a valid camera number (1, 2, 3, etc.)');
      return;
    }

    if (!label || label.length < 1) {
      setError('Enter an SD label (e.g., A, B, C)');
      return;
    }

    setBusy(true);
    setError('');

    try {
      await api.sd!.bind({
        hardwareId: p.hardwareId,
        cameraNumber: camNum,
        sdLabel: label,
      });

      await api?.ui?.toast?.({ kind: 'success', title: 'SD card bound', message: `Camera ${camNum} • SD ${label}` });
      props.onBound?.();
      props.onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Binding failed');
      await api?.ui?.toast?.({ kind: 'error', title: 'Binding failed', message: e?.message ?? 'unknown' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modalHeader">
          <div className="modalTitle">Bind SD Card</div>
          <button className="btn" onClick={props.onClose} disabled={busy}>Close</button>
        </div>

        <div className="modalBody">
          <div className="bannerInline" style={{ marginBottom: 12 }}>
            This SD card is not yet registered. Bind it to a camera to start tracking.
          </div>

          <div className="muted">SD Card Details</div>
          <div style={{ marginTop: 4 }}>
            <strong>Drive:</strong> {p.driveLetter || p.mountPath}
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: '#666' }}>
            Hardware ID: {p.hardwareId}
          </div>

          <div className="sectionTitle" style={{ marginTop: 16 }}>Camera Number</div>
          <div className="muted">Which camera is this SD card from? (1, 2, 3, etc.)</div>
          <input
            type="number"
            min="1"
            value={cameraNumber}
            onChange={(e) => setCameraNumber(e.target.value)}
            placeholder="e.g., 1"
            style={{ marginTop: 8, width: 120 }}
            disabled={busy}
          />

          <div className="sectionTitle" style={{ marginTop: 16 }}>SD Label</div>
          <div className="muted">Label for this SD card (A, B, C, etc.)</div>
          <input
            type="text"
            maxLength={4}
            value={sdLabel}
            onChange={(e) => setSdLabel(e.target.value.toUpperCase())}
            placeholder="e.g., A"
            style={{ marginTop: 8, width: 120, textTransform: 'uppercase' }}
            disabled={busy}
          />

          {error ? (
            <div className="bannerInline" style={{ marginTop: 12, background: 'rgba(239,68,68,0.1)', color: '#dc2626' }}>
              {error}
            </div>
          ) : null}
        </div>

        <div className="modalFooter">
          <button
            className="btn"
            onClick={handleBind}
            disabled={busy || !canBind}
            style={{ background: '#22c55e', color: '#fff' }}
          >
            {busy ? 'Binding…' : 'Bind SD Card'}
          </button>
          <button className="btn" onClick={props.onClose} disabled={busy}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
