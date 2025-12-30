import React, { useEffect, useState } from 'react';

type SnapshotFile = {
  relativePath: string;
  name: string;
  sizeBytes: number;
  quickHash: string;
};

type Props = {
  snapshot: {
    sessionId: string;
    fileCount: number;
    totalSizeBytes: number;
    files: SnapshotFile[];
  } | null;
  binding: {
    cameraNumber: number;
    sdLabel: string;
  } | null;
  copyProgress: {
    filesCopied?: number;
    filesPending?: number;
    filename?: string;
  } | null;
  copiedFiles: Set<string>;
  renamedFiles: Map<string, string>; // originalName -> newName
  onCopyToFolder?: () => void;
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

export function CopyAssistant(props: Props) {
  const { snapshot, binding, copyProgress, copiedFiles, renamedFiles } = props;
  const api = window.gate1;

  const [targetFolder, setTargetFolder] = useState<string>('');
  const [showAll, setShowAll] = useState(false);

  // Derive target folder name from binding (e.g., "SD 10A")
  const suggestedFolderName = binding
    ? `SD ${binding.cameraNumber}${binding.sdLabel}`
    : null;

  useEffect(() => {
    // Auto-suggest target folder based on watched folders + binding
    const loadTarget = async () => {
      if (!api?.core?.getStatus) return;
      const st = await api.core.getStatus();
      const watched = st?.watchedFolders ?? [];
      if (watched.length > 0 && suggestedFolderName) {
        // Suggest first watched folder + SD folder name
        setTargetFolder(`${watched[0]}\\${suggestedFolderName}`);
      }
    };
    void loadTarget();
  }, [binding, suggestedFolderName]);

  if (!snapshot || snapshot.files.length === 0) {
    return (
      <div className="card" style={{ marginTop: 12 }}>
        <div className="cardHeader">
          <strong>Copy Assistant</strong>
          <span className="muted">waiting for snapshot</span>
        </div>
        <div className="muted" style={{ marginTop: 8 }}>
          Insert an SD card to scan clips.
        </div>
      </div>
    );
  }

  const totalFiles = snapshot.files.length;
  const copiedCount = copiedFiles.size;
  const renamedCount = renamedFiles.size;
  const pendingCopy = totalFiles - copiedCount;
  const pendingRename = copiedCount - renamedCount;

  // Categorize files
  const notCopied = snapshot.files.filter(f => !copiedFiles.has(f.name));
  const copiedNotRenamed = snapshot.files.filter(f => copiedFiles.has(f.name) && !renamedFiles.has(f.name));
  const renamed = snapshot.files.filter(f => renamedFiles.has(f.name));

  const displayFiles = showAll ? notCopied : notCopied.slice(0, 10);

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div className="cardHeader">
        <strong>Copy Assistant</strong>
        <span className="muted">{totalFiles} clips detected</span>
      </div>

      {/* Progress Summary */}
      <div className="grid2" style={{ marginTop: 12 }}>
        <div className="kpi">
          <div className="kpiLabel">Copied</div>
          <div className="kpiValue">{copiedCount}/{totalFiles}</div>
        </div>
        <div className="kpi">
          <div className="kpiLabel">Renamed</div>
          <div className="kpiValue">{renamedCount}/{copiedCount || 0}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ marginTop: 12, height: 8, background: 'rgba(0,0,0,0.08)', borderRadius: 999, overflow: 'hidden' }}>
        <div
          style={{
            width: `${Math.round((copiedCount / totalFiles) * 100)}%`,
            height: '100%',
            background: copiedCount === totalFiles ? 'rgba(34,197,94,0.85)' : 'rgba(59,130,246,0.75)',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* Target folder */}
      {suggestedFolderName && (
        <div style={{ marginTop: 12 }}>
          <div className="muted">Target folder:</div>
          <div style={{ marginTop: 4, fontWeight: 600, color: '#2563eb' }}>
            {targetFolder || `[Watched Folder]\\${suggestedFolderName}`}
          </div>
          <div className="muted" style={{ marginTop: 4, fontSize: 11 }}>
            Copy clips to this folder. The agent will verify each copy.
          </div>
        </div>
      )}

      {/* Clips to copy */}
      {notCopied.length > 0 && (
        <>
          <div className="sectionTitle" style={{ marginTop: 16 }}>
            Clips to Copy ({notCopied.length})
          </div>
          <div className="list" style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto' }}>
            {displayFiles.map((f) => (
              <div key={f.relativePath} className="listRow" style={{ padding: '6px 8px' }}>
                <div className="listMain">
                  <strong style={{ fontSize: 13 }}>{f.name}</strong>
                  <div className="muted" style={{ fontSize: 11 }}>{fmtBytes(f.sizeBytes)}</div>
                </div>
                <span className="pill pillWarn" style={{ fontSize: 10 }}>pending</span>
              </div>
            ))}
            {notCopied.length > 10 && !showAll && (
              <button className="btn" onClick={() => setShowAll(true)} style={{ marginTop: 8 }}>
                Show all {notCopied.length} clips
              </button>
            )}
          </div>
        </>
      )}

      {/* Copied but not renamed */}
      {copiedNotRenamed.length > 0 && (
        <>
          <div className="sectionTitle" style={{ marginTop: 16 }}>
            Copied - Awaiting Rename ({copiedNotRenamed.length})
          </div>
          <div className="muted" style={{ marginTop: 4, fontSize: 11 }}>
            Review and rename these clips. Report any issues before renaming.
          </div>
          <div className="list" style={{ marginTop: 8, maxHeight: 150, overflowY: 'auto' }}>
            {copiedNotRenamed.slice(0, 5).map((f) => (
              <div key={f.relativePath} className="listRow" style={{ padding: '6px 8px' }}>
                <div className="listMain">
                  <strong style={{ fontSize: 13 }}>{f.name}</strong>
                </div>
                <span className="pill pillBlue" style={{ fontSize: 10 }}>copied</span>
              </div>
            ))}
            {copiedNotRenamed.length > 5 && (
              <div className="muted" style={{ padding: 8 }}>
                +{copiedNotRenamed.length - 5} more
              </div>
            )}
          </div>
        </>
      )}

      {/* Renamed - ready for backup */}
      {renamed.length > 0 && (
        <>
          <div className="sectionTitle" style={{ marginTop: 16 }}>
            Renamed - Ready for Backup ({renamed.length})
          </div>
          <div className="list" style={{ marginTop: 8, maxHeight: 150, overflowY: 'auto' }}>
            {renamed.slice(0, 5).map((f) => (
              <div key={f.relativePath} className="listRow" style={{ padding: '6px 8px' }}>
                <div className="listMain">
                  <strong style={{ fontSize: 13 }}>{renamedFiles.get(f.name) || f.name}</strong>
                  <div className="muted" style={{ fontSize: 11 }}>was: {f.name}</div>
                </div>
                <span className="pill pillOk" style={{ fontSize: 10 }}>renamed</span>
              </div>
            ))}
            {renamed.length > 5 && (
              <div className="muted" style={{ padding: 8 }}>
                +{renamed.length - 5} more
              </div>
            )}
          </div>
        </>
      )}

      {/* Current copy activity */}
      {copyProgress?.filename && (
        <div className="bannerInline" style={{ marginTop: 12, background: 'rgba(59,130,246,0.1)' }}>
          <strong>Copying:</strong> {copyProgress.filename}
        </div>
      )}
    </div>
  );
}
