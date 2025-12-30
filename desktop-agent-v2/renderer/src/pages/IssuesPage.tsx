import React, { useEffect, useMemo, useState } from 'react';

type Issue = {
  id: string;
  createdAtIso: string;
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  data?: any;
  acknowledged: boolean;
  acknowledgedAtIso?: string;
};

type Props = {
  coreStatus?: any;
  uiState?: any;
};

const issueOptions = [
  { code: 'VIDEO_CORRUPT', label: "Video corrupt / won't play" },
  { code: 'AUDIO_MISSING', label: 'No audio / bad audio' },
  { code: 'FOCUS_EXPOSURE', label: 'Focus / exposure issue' },
  { code: 'SHAKY', label: 'Shaky / unusable' },
  { code: 'WRONG_CLIP', label: 'Wrong clip / wrong card' },
  { code: 'OTHER', label: 'Other...' },
];

function fmtEat(iso: string | undefined) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${new Intl.DateTimeFormat('en-KE', {
    timeZone: 'Africa/Nairobi',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)} EAT`;
}

export function IssuesPage(props: Props) {
  const api = window.gate1;
  const [issues, setIssues] = useState<Issue[]>([]);
  
  // Report form state
  const [clipName, setClipName] = useState('');
  const [issueType, setIssueType] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Get current clip from context if available
  const ctx = props.uiState?.context ?? null;
  const activeClip = ctx?.issuePrompt?.clipName || ctx?.currentClip || '';
  const activeClipPath = ctx?.issuePrompt?.clipPath || ctx?.currentClipPath || '';

  // Auto-fill clip name from context
  useEffect(() => {
    if (activeClip && !clipName) {
      setClipName(activeClip);
    }
  }, [activeClip]);

  const refresh = async () => {
    if (!api?.issues) return;
    setIssues(await api.issues.list());
  };

  useEffect(() => {
    void refresh();
    if (!api?.issues) return;
    const u = api.issues.onUpdated((list: any[]) => setIssues(list as any));
    return () => {
      try { u(); } catch { /* ignore */ }
    };
  }, []);

  const submitIssue = async () => {
    if (!issueType) {
      await api?.ui?.toast?.({ kind: 'warning', title: 'Select issue type' });
      return;
    }
    if (issueType === 'OTHER' && !notes.trim()) {
      await api?.ui?.toast?.({ kind: 'warning', title: 'Please describe the issue' });
      return;
    }

    setSubmitting(true);
    try {
      const picked = issueOptions.find((x) => x.code === issueType);
      const clipLabel = clipName ? ` [Clip: ${clipName}]` : '';
      const notesLabel = notes.trim() ? ` — ${notes.trim()}` : '';
      const message = `${picked?.label ?? issueType}${clipLabel}${notesLabel}`;

      await api?.issues?.report?.({
        severity: 'warning',
        code: issueType,
        message,
        data: {
          clipName: clipName || undefined,
          clipPath: activeClipPath || undefined,
          notes: notes.trim() || undefined,
        },
      });

      await api?.ui?.toast?.({ kind: 'success', title: 'Issue reported', message: 'Saved for QA review.' });
      
      // Reset form
      setClipName('');
      setIssueType('');
      setNotes('');
      
      // Refresh list
      await refresh();
    } catch (err: any) {
      await api?.ui?.toast?.({ kind: 'error', title: 'Failed to report', message: err?.message ?? 'unknown' });
    } finally {
      setSubmitting(false);
    }
  };

  const canReport = !!api?.issues?.report;
  const hasActiveClip = !!activeClip;

  return (
    <div className="page">
      {/* Report Issue Section */}
      <div className="card">
        <div className="cardHeader">
          <strong>Report an Issue</strong>
          {hasActiveClip && <span className="pill pillBlue">Clip detected</span>}
        </div>

        {canReport ? (
          <>
            {/* Clip Input */}
            <div style={{ marginTop: 12 }}>
              <div className="muted" style={{ marginBottom: 4, fontSize: 11 }}>Clip name</div>
              <input
                value={clipName}
                onChange={(e) => setClipName(e.target.value)}
                placeholder="e.g. A001_C003_0101AB"
                style={{ width: '100%' }}
                className={hasActiveClip && clipName === activeClip ? 'inputHighlight' : ''}
              />
              {hasActiveClip && clipName === activeClip && (
                <div className="muted" style={{ fontSize: 10, marginTop: 2, color: '#3b82f6' }}>
                  Auto-detected from current playback
                </div>
              )}
            </div>

            {/* Issue Type */}
            <div style={{ marginTop: 10 }}>
              <div className="muted" style={{ marginBottom: 4, fontSize: 11 }}>Issue type</div>
              <div className="issueGrid">
                {issueOptions.map((opt) => (
                  <button
                    key={opt.code}
                    className={`issueBtn ${issueType === opt.code ? 'issueBtnActive' : ''}`}
                    onClick={() => setIssueType(opt.code)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginTop: 10 }}>
              <div className="muted" style={{ marginBottom: 4, fontSize: 11 }}>
                Notes {issueType === 'OTHER' ? '(required)' : '(optional)'}
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional details about the issue..."
                rows={2}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>

            {/* Submit */}
            <div style={{ marginTop: 12 }}>
              <button 
                className="btn btnPrimary" 
                onClick={submitIssue}
                disabled={submitting || !issueType}
                style={{ width: '100%' }}
              >
                {submitting ? 'Submitting…' : 'Submit Issue'}
              </button>
            </div>
          </>
        ) : (
          <div className="emptyState" style={{ padding: '16px' }}>
            <div className="emptyStateMsg">Issue reporting not available</div>
          </div>
        )}
      </div>

      {/* Issues List */}
      <div className="card">
        <div className="cardHeader">
          <strong>Reported Issues</strong>
          <div className="row" style={{ gap: 8 }}>
            <span className="pill pillNeutral">{issues.length}</span>
            <button className="btn" onClick={refresh}>Refresh</button>
          </div>
        </div>

        <div className="list" style={{ marginTop: 8 }}>
          {issues.length === 0 ? (
            <div className="emptyState" style={{ padding: '16px' }}>
              <div className="emptyStateMsg">No issues reported yet</div>
            </div>
          ) : null}
          {issues.map((it) => {
            const isHighlighted = it.data?.clipName && clipName && it.data.clipName === clipName;
            return (
              <div 
                key={it.id} 
                className={`listRow ${isHighlighted ? 'listRowHighlight' : ''}`}
                style={isHighlighted ? { background: '#eff6ff', borderLeft: '3px solid #3b82f6' } : {}}
              >
                <div className="listMain">
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span className={`pill ${it.severity === 'error' ? 'pillRed' : it.severity === 'warning' ? 'pillWarn' : 'pillNeutral'}`} style={{ marginRight: 6 }}>
                        {it.code}
                      </span>
                      {it.data?.clipName && (
                        <span className="pill pillBlue" style={{ fontSize: 10 }}>{it.data.clipName}</span>
                      )}
                    </div>
                    <span className="muted" style={{ fontSize: 10 }}>{fmtEat(it.createdAtIso)}</span>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12 }}>{it.message}</div>
                  {it.data?.notes && (
                    <div className="muted" style={{ marginTop: 4, fontSize: 11, fontStyle: 'italic' }}>
                      "{it.data.notes}"
                    </div>
                  )}
                  <div style={{ marginTop: 6 }}>
                    <span className={`pill ${it.acknowledged ? 'pillOk' : 'pillWarn'}`} style={{ fontSize: 10 }}>
                      {it.acknowledged ? `Reviewed ${fmtEat(it.acknowledgedAtIso)}` : 'Open'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
