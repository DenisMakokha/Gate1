import React from 'react';

export type AttentionPayload = {
  reason: string;
  data?: any;
};

type Props = {
  open: boolean;
  payload: AttentionPayload | null;
  onClose: () => void;
};

function titleFor(reason: string): string {
  if (reason === 'SD_REMOVAL_PENDING') return 'SD removed early';
  if (reason === 'WRONG_DESTINATION') return 'Wrong destination detected';
  if (reason === 'DUPLICATE_FILE') return 'Potential duplicate detected';
  if (reason === 'FILENAME_MAJOR') return 'Filename needs attention';
  if (reason === 'SD_SESSION_OVERLAP') return 'SD session overlap';
  return 'Attention required';
}

export function AttentionModal(props: Props) {
  const api = window.gate1;
  const p = props.payload;

  if (!props.open || !p) return null;

  const reason = p.reason;
  const title = titleFor(reason);

  const sendDecision = async (decision: string, details?: any) => {
    if (!api?.attention?.decision) return;
    await api.attention.decision({ reason, decision, details });
  };

  const sdRemovalButtons = reason === 'SD_REMOVAL_PENDING' && api?.sd?.removalDecision;

  const dismiss = async () => {
    try {
      await api?.attention?.dismiss?.();
    } finally {
      props.onClose();
    }
  };

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modalHeader">
          <div className="modalTitle">{title}</div>
          <button className="btn" onClick={dismiss}>Close</button>
        </div>

        <div className="modalBody">
          <div className="muted">Reason</div>
          <div style={{ fontWeight: 700, marginTop: 4 }}>{reason}</div>

          <div className="muted" style={{ marginTop: 10 }}>Details</div>
          <pre style={{ maxHeight: 220 }}>{JSON.stringify(p.data ?? null, null, 2)}</pre>

          {sdRemovalButtons ? (
            <div className="bannerInline">
              SD removal requires a decision.
            </div>
          ) : null}
        </div>

        <div className="modalFooter">
          {sdRemovalButtons ? (
            <>
              <button
                className="btn"
                onClick={async () => {
                  await api!.sd!.removalDecision({ decision: 'reinsert' });
                  await sendDecision('reinsert');
                  props.onClose();
                }}
              >
                Reinsert SD (recommended)
              </button>
              <button
                className="btn"
                onClick={async () => {
                  await api!.sd!.removalDecision({ decision: 'confirm_early_removal' });
                  await sendDecision('confirm_early_removal');
                  props.onClose();
                }}
              >
                Confirm early removal
              </button>
            </>
          ) : (
            <>
              <button
                className="btn"
                onClick={async () => {
                  await sendDecision('acknowledged');
                  props.onClose();
                }}
              >
                Acknowledge
              </button>
              <button
                className="btn"
                onClick={async () => {
                  await sendDecision('dismissed');
                  props.onClose();
                }}
              >
                Dismiss
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
