import React, { useState, useEffect } from 'react';
import { BoardItem, CIState, CheckRun, GHLabel, GHUser, LinkedPR, PRFile, ReviewInfo } from '../../src/types';

interface Props {
  item: BoardItem;
  linkedPRs: LinkedPR[] | null;
  prFiles: PRFile[] | null;
  repoLabels: GHLabel[];
  onClose: () => void;
  onOpenUrl: (url: string) => void;
  onWorkOnThis: (branchName: string, owner: string, repo: string) => void;
  onOpenPRFile: (owner: string, repo: string, prNumber: number, filename: string, patch?: string) => void;
  onUpdateMetadata: (itemId: string, owner: string, repo: string, issueNumber: number, labels?: string[], assignees?: string[]) => void;
  onFetchRepoLabels: (owner: string, repo: string) => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function CIBadge({ state }: { state: CIState | undefined }) {
  if (!state || state === 'none' || state === 'EXPECTED') return null;
  const map: Record<string, { label: string; color: string }> = {
    SUCCESS: { label: 'CI passing', color: '#a6e3a1' },
    FAILURE: { label: 'CI failing', color: '#f38ba8' },
    ERROR: { label: 'CI error', color: '#f38ba8' },
    PENDING: { label: 'CI pending', color: '#f9e2af' },
  };
  const info = map[state] ?? { label: state, color: '#585b70' };
  return (
    <span className="detail-ci-badge" style={{ color: info.color, borderColor: info.color + '44' }}>
      {info.label}
    </span>
  );
}

function ReviewSummary({ reviews, requests }: { reviews?: ReviewInfo[]; requests?: { login: string; avatarUrl: string }[] }) {
  if (!reviews?.length && !requests?.length) return null;
  const approved = reviews?.filter((r) => r.state === 'APPROVED') ?? [];
  const changes = reviews?.filter((r) => r.state === 'CHANGES_REQUESTED') ?? [];
  const pending = requests ?? [];

  return (
    <div className="detail-reviews">
      {approved.length > 0 && (
        <span className="detail-review-chip review-approved-chip">
          ✓ {approved.length} approved
        </span>
      )}
      {changes.length > 0 && (
        <span className="detail-review-chip review-changes-chip">
          ✗ {changes.length} changes requested
        </span>
      )}
      {pending.length > 0 && (
        <span className="detail-review-chip review-pending-chip">
          ⏳ {pending.length} awaiting review
        </span>
      )}
    </div>
  );
}

function ciColor(conclusion: string | null, status: string): string {
  if (status === 'IN_PROGRESS' || status === 'QUEUED') return '#f9e2af';
  if (conclusion === 'SUCCESS') return '#a6e3a1';
  if (conclusion === 'FAILURE' || conclusion === 'TIMED_OUT') return '#f38ba8';
  if (conclusion === 'CANCELLED') return '#6c7086';
  if (conclusion === 'SKIPPED' || conclusion === 'NEUTRAL') return '#585b70';
  return '#585b70';
}

function ciLabel(conclusion: string | null, status: string): string {
  if (status === 'IN_PROGRESS') return 'running';
  if (status === 'QUEUED' || status === 'REQUESTED' || status === 'WAITING' || status === 'PENDING') return 'queued';
  if (conclusion === 'SUCCESS') return 'pass';
  if (conclusion === 'FAILURE') return 'fail';
  if (conclusion === 'TIMED_OUT') return 'timeout';
  if (conclusion === 'CANCELLED') return 'cancelled';
  if (conclusion === 'SKIPPED') return 'skipped';
  if (conclusion === 'NEUTRAL') return 'neutral';
  return status.toLowerCase();
}

function ciIconClass(state: CIState | undefined): string {
  if (state === 'SUCCESS') return 'ci-icon ci-icon-success';
  if (state === 'FAILURE' || state === 'ERROR') return 'ci-icon ci-icon-failure';
  if (state === 'PENDING') return 'ci-icon ci-icon-pending';
  return 'ci-icon ci-icon-neutral';
}

function CheckRunsList({ runs, onOpenUrl }: { runs: CheckRun[]; onOpenUrl: (url: string) => void }) {
  if (!runs.length) return <span style={{ fontSize: 11, color: '#45475a', fontStyle: 'italic' }}>No check runs found</span>;
  return (
    <div className="check-runs-list">
      {runs.map((run, i) => {
        const color = ciColor(run.conclusion, run.status);
        const label = ciLabel(run.conclusion, run.status);
        const Tag = run.detailsUrl ? 'a' : 'div';
        return (
          <Tag
            key={i}
            className="check-run-row"
            {...(run.detailsUrl ? { href: '#', onClick: (e: React.MouseEvent) => { e.preventDefault(); onOpenUrl(run.detailsUrl!); } } : {})}
          >
            <span className="check-run-dot" style={{ background: color }} />
            <span className="check-run-name">{run.name}</span>
            <span className="check-run-status" style={{ color }}>{label}</span>
            {run.detailsUrl && (
              <svg className="check-run-link-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            )}
          </Tag>
        );
      })}
    </div>
  );
}

function LinkedPRSection({ prs, onOpenUrl }: { prs: LinkedPR[] | null; onOpenUrl: (url: string) => void }) {
  if (prs === null) {
    return (
      <div style={{ fontSize: 11, color: '#45475a', display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 10, height: 10, border: '2px solid #45475a', borderTopColor: '#89b4fa', borderRadius: '50%', animation: 'spin 0.75s linear infinite', flexShrink: 0 }} />
        Fetching linked PRs…
      </div>
    );
  }
  if (!prs.length) {
    return <span style={{ fontSize: 11, color: '#45475a', fontStyle: 'italic' }}>No linked pull requests found</span>;
  }
  return (
    <div className="detail-linked-prs">
      {prs.map((pr) => (
        <div key={pr.number} className="linked-pr-card">
          <div className="linked-pr-header" onClick={() => onOpenUrl(pr.url)}>
            <span className={ciIconClass(pr.ciState)} />
            <span className="linked-pr-num">#{pr.number}</span>
            <span className="linked-pr-title">{pr.title}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#45475a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </div>
          <CheckRunsList runs={pr.checkRuns} onOpenUrl={onOpenUrl} />
        </div>
      ))}
    </div>
  );
}

// Phase 1: PR Files Section
function PRFilesSection({
  files,
  item,
  onOpenPRFile,
}: {
  files: PRFile[] | null;
  item: BoardItem;
  onOpenPRFile: (owner: string, repo: string, prNumber: number, filename: string, patch?: string) => void;
}) {
  if (files === null) {
    return (
      <div style={{ fontSize: 11, color: '#45475a', display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 10, height: 10, border: '2px solid #45475a', borderTopColor: '#89b4fa', borderRadius: '50%', animation: 'spin 0.75s linear infinite', flexShrink: 0 }} />
        Loading changed files…
      </div>
    );
  }
  if (!files.length) {
    return <span style={{ fontSize: 11, color: '#45475a', fontStyle: 'italic' }}>No files changed</span>;
  }

  const statusColor = (s: string) => {
    if (s === 'added') return '#a6e3a1';
    if (s === 'removed') return '#f38ba8';
    if (s === 'renamed') return '#cba6f7';
    return '#89b4fa';
  };
  const statusLabel = (s: string) => {
    if (s === 'added') return 'A';
    if (s === 'removed') return 'D';
    if (s === 'renamed') return 'R';
    return 'M';
  };

  return (
    <div className="pr-files-list">
      {files.map((file, i) => (
        <div
          key={i}
          className="pr-file-row"
          onClick={() => onOpenPRFile(item.repositoryOwner, item.repository, item.number, file.filename, file.patch)}
          title={`Open ${file.filename} in editor`}
        >
          <span className="pr-file-status" style={{ color: statusColor(file.status) }}>
            {statusLabel(file.status)}
          </span>
          <span className="pr-file-name">{file.filename}</span>
          <span className="pr-file-diff">
            {file.additions > 0 && <span style={{ color: '#a6e3a1' }}>+{file.additions}</span>}
            {file.deletions > 0 && <span style={{ color: '#f38ba8' }}>−{file.deletions}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

// Phase 3: Label/Assignee editor
function MetadataEditor({
  item,
  repoLabels,
  onUpdateMetadata,
  onFetchRepoLabels,
}: {
  item: BoardItem;
  repoLabels: GHLabel[];
  onUpdateMetadata: (itemId: string, owner: string, repo: string, issueNumber: number, labels?: string[], assignees?: string[]) => void;
  onFetchRepoLabels: (owner: string, repo: string) => void;
}) {
  const [localLabels, setLocalLabels] = useState<GHLabel[]>(item.labels);
  const [labelDropOpen, setLabelDropOpen] = useState(false);

  useEffect(() => { setLocalLabels(item.labels); }, [item.id]);

  const removeLabel = (name: string) => {
    const next = localLabels.filter((l) => l.name !== name);
    setLocalLabels(next);
    onUpdateMetadata(item.id, item.repositoryOwner, item.repository, item.number, next.map((l) => l.name), undefined);
  };

  const addLabel = (label: GHLabel) => {
    if (localLabels.some((l) => l.name === label.name)) return;
    const next = [...localLabels, label];
    setLocalLabels(next);
    setLabelDropOpen(false);
    onUpdateMetadata(item.id, item.repositoryOwner, item.repository, item.number, next.map((l) => l.name), undefined);
  };

  const toggleLabelDrop = () => {
    if (!labelDropOpen && !repoLabels.length) {
      onFetchRepoLabels(item.repositoryOwner, item.repository);
    }
    setLabelDropOpen((v) => !v);
  };

  const availableLabels = repoLabels.filter((l) => !localLabels.some((ll) => ll.name === l.name));

  return (
    <div className="metadata-editor">
      <div className="metadata-editor-row">
        <span className="metadata-editor-label">Labels</span>
        <div className="metadata-editor-tags">
          {localLabels.map((label) => {
            const bg = `#${label.color}`;
            return (
              <span key={label.name} className="label metadata-tag" style={{ background: bg + '33', color: bg, border: `1px solid ${bg}55` }}>
                {label.name}
                <button
                  className="metadata-tag-remove"
                  onClick={() => removeLabel(label.name)}
                  title={`Remove ${label.name}`}
                >×</button>
              </span>
            );
          })}
          <div style={{ position: 'relative' }}>
            <button className="metadata-add-btn" onClick={toggleLabelDrop} title="Add label">+</button>
            {labelDropOpen && (
              <div className="metadata-dropdown">
                {!repoLabels.length && (
                  <div style={{ padding: '6px 10px', fontSize: 11, color: '#45475a' }}>Loading labels…</div>
                )}
                {availableLabels.length === 0 && repoLabels.length > 0 && (
                  <div style={{ padding: '6px 10px', fontSize: 11, color: '#45475a' }}>All labels applied</div>
                )}
                {availableLabels.map((label) => {
                  const bg = `#${label.color}`;
                  return (
                    <button
                      key={label.name}
                      className="metadata-dropdown-item"
                      onClick={() => addLabel(label)}
                    >
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: bg, display: 'inline-block', flexShrink: 0 }} />
                      {label.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DetailPanel({ item, linkedPRs, prFiles, repoLabels, onClose, onOpenUrl, onWorkOnThis, onOpenPRFile, onUpdateMetadata, onFetchRepoLabels }: Props) {
  const isPR = item.type === 'PULL_REQUEST';

  const stateColor =
    item.state === 'OPEN' ? '#a6e3a1'
    : item.state === 'MERGED' ? '#cba6f7'
    : '#f38ba8';

  return (
    <div className="detail-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="detail-panel">
        {/* Header */}
        <div className="detail-header">
          <div className="detail-header-meta">
            <span className="detail-type-badge" style={{ color: stateColor, borderColor: stateColor + '55' }}>
              {isPR ? 'PR' : 'Issue'} · {item.state}
            </span>
            <span className="detail-num">#{item.number}</span>
          </div>
          <div className="detail-header-actions">
            {/* Phase 1: Work-On-This button for PRs with a branch */}
            {isPR && item.headRefName && (
              <button
                className="detail-work-btn"
                onClick={() => onWorkOnThis(item.headRefName!, item.repositoryOwner, item.repository)}
                title={`Checkout ${item.headRefName}`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 11 12 14 22 4"/>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
                Work on This
              </button>
            )}
            <button className="detail-gh-btn" onClick={() => onOpenUrl(item.url)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              View on GitHub
            </button>
            <button className="detail-close-btn" onClick={onClose} title="Close">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="detail-scroll">
          {/* Title */}
          <h2 className="detail-title">{item.title}</h2>

          {/* Badges row */}
          <div className="detail-badges">
            {isPR && item.isDraft && <span className="badge-draft">Draft</span>}
            {item.sprint && (
              <span className="badge-sprint">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                {item.sprint}
              </span>
            )}
            {item.milestone && (
              <span className="badge-milestone">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 4l3 3-3 3"/><path d="M3 7h18"/>
                  <path d="M6 20l-3-3 3-3"/><path d="M21 17H3"/>
                </svg>
                {item.milestone.title}
                {item.milestone.dueOn && (
                  <span style={{ opacity: 0.6, marginLeft: 4 }}>
                    due {new Date(item.milestone.dueOn).toLocaleDateString()}
                  </span>
                )}
              </span>
            )}
          </div>

          {/* Labels */}
          {item.labels.length > 0 && (
            <div className="detail-labels">
              {item.labels.map((label) => {
                const bg = `#${label.color}`;
                return (
                  <span key={label.name} className="label" style={{ background: bg + '33', color: bg, border: `1px solid ${bg}55` }}>
                    {label.name}
                  </span>
                );
              })}
            </div>
          )}

          {/* PR extras */}
          {isPR && (
            <div className="detail-pr-row">
              {item.additions !== undefined && (
                <span className="diff-stats">
                  <span className="diff-add">+{item.additions}</span>
                  <span className="diff-del">-{item.deletions ?? 0}</span>
                </span>
              )}
              <CIBadge state={item.ciState} />
              {item.headRefName && (
                <span className="detail-branch">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="6" y1="3" x2="6" y2="15"/>
                    <circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
                    <path d="M18 9a9 9 0 0 1-9 9"/>
                  </svg>
                  {item.headRefName}
                </span>
              )}
            </div>
          )}

          {isPR && <ReviewSummary reviews={item.reviews} requests={item.reviewRequests} />}

          <div className="detail-divider" />

          {/* Phase 1: Changed Files (PRs only) */}
          {isPR && (
            <>
              <div className="detail-section">
                <span className="detail-section-label">Changed Files</span>
                <PRFilesSection files={prFiles} item={item} onOpenPRFile={onOpenPRFile} />
              </div>
              <div className="detail-divider" />
            </>
          )}

          {/* Description */}
          <div className="detail-section">
            <span className="detail-section-label">Description</span>
            {item.body ? (
              <pre className="detail-body-text">{item.body}</pre>
            ) : (
              <span className="detail-body-empty">No description provided.</span>
            )}
          </div>

          {/* Linked PRs & CI (issues only) */}
          {!isPR && (
            <>
              <div className="detail-divider" />
              <div className="detail-section">
                <span className="detail-section-label">Linked Pull Requests & CI</span>
                <LinkedPRSection prs={linkedPRs} onOpenUrl={onOpenUrl} />
              </div>
            </>
          )}

          <div className="detail-divider" />

          {/* Phase 3: Metadata Editor (issues only) */}
          {!isPR && (
            <>
              <div className="detail-section">
                <span className="detail-section-label">Edit Metadata</span>
                <MetadataEditor
                  item={item}
                  repoLabels={repoLabels}
                  onUpdateMetadata={onUpdateMetadata}
                  onFetchRepoLabels={onFetchRepoLabels}
                />
              </div>
              <div className="detail-divider" />
            </>
          )}

          {/* Meta */}
          <div className="detail-meta-grid">
            <div className="detail-meta-row">
              <span className="detail-meta-label">Author</span>
              <span className="detail-meta-value detail-meta-user">
                {item.author.avatarUrl && <img src={item.author.avatarUrl} alt={item.author.login} className="detail-avatar" />}
                {item.author.login}
              </span>
            </div>

            {item.assignees.length > 0 && (
              <div className="detail-meta-row">
                <span className="detail-meta-label">Assignees</span>
                <span className="detail-meta-value">
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {item.assignees.map((a) => (
                      <span key={a.login} className="detail-meta-user">
                        {a.avatarUrl && <img src={a.avatarUrl} alt={a.login} className="detail-avatar" />}
                        {a.login}
                      </span>
                    ))}
                  </span>
                </span>
              </div>
            )}

            <div className="detail-meta-row">
              <span className="detail-meta-label">Repository</span>
              <span className="detail-meta-value">{item.repositoryOwner}/{item.repository}</span>
            </div>

            <div className="detail-meta-row">
              <span className="detail-meta-label">Column</span>
              <span className="detail-meta-value">{item.column}</span>
            </div>

            <div className="detail-meta-row">
              <span className="detail-meta-label">Created</span>
              <span className="detail-meta-value">{timeAgo(item.createdAt)}</span>
            </div>

            <div className="detail-meta-row">
              <span className="detail-meta-label">Updated</span>
              <span className="detail-meta-value">{timeAgo(item.updatedAt)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
