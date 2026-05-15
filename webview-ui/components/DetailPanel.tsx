import React, { useState, useEffect, useRef } from 'react';
import { BoardItem, CIState, CheckRun, GHLabel, LinkedPR, PRFile, ReviewInfo } from '../../src/types';
import { LARGE_PR_THRESHOLD } from '../constants';

// ─── Codeowners helper ────────────────────────────────────────────────────────

function matchesCodeownersPattern(filename: string, pattern: string): boolean {
  const p = pattern.startsWith('/') ? pattern.slice(1) : pattern;
  if (p.endsWith('/')) return filename.startsWith(p);
  if (p.startsWith('*.')) return filename.endsWith(p.slice(1));
  if (p.includes('*')) {
    const re = new RegExp('^' + p.replace(/\./g, '\\.').replace(/\*/g, '[^/]*') + '$');
    return re.test(filename) || re.test(filename.split('/').pop() ?? '');
  }
  return filename === p || filename.startsWith(p + '/');
}

export function resolveCodeowners(
  filename: string,
  entries: Array<{ pattern: string; owners: string[] }>
): string[] {
  let matched: string[] = [];
  for (const entry of entries) {
    if (matchesCodeownersPattern(filename, entry.pattern)) {
      matched = entry.owners;
    }
  }
  return matched;
}

// ─── PR quality score ─────────────────────────────────────────────────────────

interface QualityFlag {
  label: string;
  color: string;
}

function computeQualityFlags(item: BoardItem, files: PRFile[] | null): QualityFlag[] {
  const flags: QualityFlag[] = [];
  const daysOpen = (Date.now() - new Date(item.createdAt).getTime()) / 86_400_000;
  const totalLines = (item.additions ?? 0) + (item.deletions ?? 0);

  if (daysOpen > 7) flags.push({ label: `Stale · ${Math.floor(daysOpen)}d open`, color: '#f9e2af' });
  if (totalLines > LARGE_PR_THRESHOLD) flags.push({ label: `Large · ${totalLines} lines`, color: '#f38ba8' });
  if (!item.body?.trim()) flags.push({ label: 'No description', color: '#fab387' });
  if (!item.reviewRequests?.length && !item.reviews?.length) {
    flags.push({ label: 'No reviewers', color: '#fab387' });
  }
  if (files && files.length > 0 && !files.some((f) => /test|spec/i.test(f.filename))) {
    flags.push({ label: 'No tests changed', color: '#a6adc8' });
  }
  return flags;
}

// ─── Small utilities ──────────────────────────────────────────────────────────

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

function ciColor(conclusion: string | null, status: string): string {
  if (status === 'IN_PROGRESS' || status === 'QUEUED') return '#f9e2af';
  if (conclusion === 'SUCCESS') return '#a6e3a1';
  if (conclusion === 'FAILURE' || conclusion === 'TIMED_OUT') return '#f38ba8';
  if (conclusion === 'CANCELLED') return '#6c7086';
  return '#585b70';
}

function ciLabel(conclusion: string | null, status: string): string {
  if (status === 'IN_PROGRESS') return 'running';
  if (['QUEUED', 'REQUESTED', 'WAITING', 'PENDING'].includes(status)) return 'queued';
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

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function ReviewSummary({ reviews, requests }: { reviews?: ReviewInfo[]; requests?: { login: string }[] }) {
  if (!reviews?.length && !requests?.length) return null;
  const approved = reviews?.filter((r) => r.state === 'APPROVED').length ?? 0;
  const changes = reviews?.filter((r) => r.state === 'CHANGES_REQUESTED').length ?? 0;
  const pending = requests?.length ?? 0;
  return (
    <div className="detail-reviews">
      {approved > 0 && <span className="detail-review-chip review-approved-chip">✓ {approved} approved</span>}
      {changes > 0 && <span className="detail-review-chip review-changes-chip">✗ {changes} changes requested</span>}
      {pending > 0 && <span className="detail-review-chip review-pending-chip">⏳ {pending} awaiting review</span>}
    </div>
  );
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
          <Tag key={i} className="check-run-row"
            {...(run.detailsUrl ? { href: '#', onClick: (e: React.MouseEvent) => { e.preventDefault(); onOpenUrl(run.detailsUrl!); } } : {})}>
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
  if (!prs.length) return <span style={{ fontSize: 11, color: '#45475a', fontStyle: 'italic' }}>No linked pull requests found</span>;
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

// ─── PR Files Section (with search + CODEOWNERS) ──────────────────────────────

const PR_FILES_COLLAPSE_AT = 6;

function PRFilesSection({
  files, item, codeownersEntries, onOpenPRFile,
}: {
  files: PRFile[] | null;
  item: BoardItem;
  codeownersEntries: Array<{ pattern: string; owners: string[] }>;
  onOpenPRFile: (owner: string, repo: string, prNumber: number, filename: string, patch?: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');

  if (files === null) {
    return (
      <div style={{ fontSize: 11, color: '#45475a', display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 10, height: 10, border: '2px solid #45475a', borderTopColor: '#89b4fa', borderRadius: '50%', animation: 'spin 0.75s linear infinite', flexShrink: 0 }} />
        Loading changed files…
      </div>
    );
  }
  if (!files.length) return <span style={{ fontSize: 11, color: '#45475a', fontStyle: 'italic' }}>No files changed</span>;

  const statusColor = (s: string) =>
    s === 'added' ? '#a6e3a1' : s === 'removed' ? '#f38ba8' : s === 'renamed' ? '#cba6f7' : '#89b4fa';
  const statusLabel = (s: string) =>
    s === 'added' ? 'A' : s === 'removed' ? 'D' : s === 'renamed' ? 'R' : 'M';

  const filtered = query ? files.filter((f) => f.filename.toLowerCase().includes(query.toLowerCase())) : files;
  const shouldCollapse = !query && filtered.length > PR_FILES_COLLAPSE_AT;
  const visible = shouldCollapse && !expanded ? filtered.slice(0, PR_FILES_COLLAPSE_AT) : filtered;
  const hiddenCount = filtered.length - PR_FILES_COLLAPSE_AT;

  return (
    <div className="pr-files-list">
      {/* Search */}
      {files.length > 4 && (
        <div style={{ position: 'relative', marginBottom: 4 }}>
          <svg style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#45475a', pointerEvents: 'none' }}
            width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="pr-files-search"
            placeholder="Filter files…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setExpanded(true); }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#585b70', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
          )}
        </div>
      )}

      <div style={{ position: 'relative' }}>
        {visible.map((file, i) => {
          const owners = resolveCodeowners(file.filename, codeownersEntries);
          return (
            <div key={i} className="pr-file-row"
              onClick={() => onOpenPRFile(item.repositoryOwner, item.repository, item.number, file.filename, file.patch)}
              title={`Open ${file.filename} in editor`}>
              <span className="pr-file-status" style={{ color: statusColor(file.status) }}>{statusLabel(file.status)}</span>
              <span className="pr-file-name">{file.filename}</span>
              {owners.length > 0 && (
                <span className="pr-file-owner" title={`CODEOWNERS: ${owners.join(', ')}`}>
                  {owners[0].replace(/^@/, '')}
                </span>
              )}
              <span className="pr-file-diff">
                {file.additions > 0 && <span style={{ color: '#a6e3a1' }}>+{file.additions}</span>}
                {file.deletions > 0 && <span style={{ color: '#f38ba8' }}>−{file.deletions}</span>}
              </span>
            </div>
          );
        })}
        {shouldCollapse && !expanded && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 40, background: 'linear-gradient(to bottom, transparent, #16162a)', pointerEvents: 'none' }} />
        )}
      </div>

      {query && filtered.length === 0 && (
        <span style={{ fontSize: 11, color: '#45475a', fontStyle: 'italic', padding: '4px 8px', display: 'block' }}>No files match &ldquo;{query}&rdquo;</span>
      )}

      {shouldCollapse && (
        <button className="pr-files-toggle" onClick={() => setExpanded((v) => !v)}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
          {expanded ? 'Show less' : `See ${hiddenCount} more file${hiddenCount > 1 ? 's' : ''}…`}
        </button>
      )}
    </div>
  );
}

// ─── Merge button ─────────────────────────────────────────────────────────────

function MergeButton({ item, onMerge }: { item: BoardItem; onMerge: (method: 'merge' | 'squash' | 'rebase') => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const isReady =
    item.ciState === 'SUCCESS' &&
    item.reviews?.some((r) => r.state === 'APPROVED') &&
    !item.reviews?.some((r) => r.state === 'CHANGES_REQUESTED');

  if (!isReady) return null;

  const options: Array<{ method: 'merge' | 'squash' | 'rebase'; label: string; desc: string }> = [
    { method: 'squash', label: 'Squash and merge', desc: 'Combine all commits into one' },
    { method: 'merge', label: 'Create a merge commit', desc: 'Preserve all commits with a merge commit' },
    { method: 'rebase', label: 'Rebase and merge', desc: 'Rebase commits onto the base branch' },
  ];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="detail-merge-btn" onClick={() => setOpen((v) => !v)}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/>
          <path d="M6 21V9a9 9 0 0 0 9 9"/>
        </svg>
        Merge
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div className="merge-dropdown">
          {options.map((opt) => (
            <button key={opt.method} className="merge-dropdown-item"
              onClick={() => { setOpen(false); onMerge(opt.method); }}>
              <span className="merge-dropdown-label">{opt.label}</span>
              <span className="merge-dropdown-desc">{opt.desc}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Metadata editor ──────────────────────────────────────────────────────────

function MetadataEditor({
  item, repoLabels, onUpdateMetadata, onFetchRepoLabels,
}: {
  item: BoardItem;
  repoLabels: GHLabel[];
  onUpdateMetadata: (itemId: string, owner: string, repo: string, issueNumber: number, labels?: string[]) => void;
  onFetchRepoLabels: (owner: string, repo: string) => void;
}) {
  const [localLabels, setLocalLabels] = useState<GHLabel[]>(item.labels);
  const [labelDropOpen, setLabelDropOpen] = useState(false);

  useEffect(() => { setLocalLabels(item.labels); }, [item.id, item.labels]);

  const removeLabel = (name: string) => {
    const next = localLabels.filter((l) => l.name !== name);
    setLocalLabels(next);
    onUpdateMetadata(item.id, item.repositoryOwner, item.repository, item.number, next.map((l) => l.name));
  };

  const addLabel = (label: GHLabel) => {
    if (localLabels.some((l) => l.name === label.name)) return;
    const next = [...localLabels, label];
    setLocalLabels(next);
    setLabelDropOpen(false);
    onUpdateMetadata(item.id, item.repositoryOwner, item.repository, item.number, next.map((l) => l.name));
  };

  const toggleDrop = () => {
    if (!labelDropOpen && !repoLabels.length) onFetchRepoLabels(item.repositoryOwner, item.repository);
    setLabelDropOpen((v) => !v);
  };

  const available = repoLabels.filter((l) => !localLabels.some((ll) => ll.name === l.name));

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
                <button className="metadata-tag-remove" onClick={() => removeLabel(label.name)}>×</button>
              </span>
            );
          })}
          <div style={{ position: 'relative' }}>
            <button className="metadata-add-btn" onClick={toggleDrop}>+</button>
            {labelDropOpen && (
              <div className="metadata-dropdown">
                {!repoLabels.length && <div style={{ padding: '6px 10px', fontSize: 11, color: '#45475a' }}>Loading…</div>}
                {!available.length && repoLabels.length > 0 && <div style={{ padding: '6px 10px', fontSize: 11, color: '#45475a' }}>All labels applied</div>}
                {available.map((label) => {
                  const bg = `#${label.color}`;
                  return (
                    <button key={label.name} className="metadata-dropdown-item" onClick={() => addLabel(label)}>
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

// ─── Props interface ──────────────────────────────────────────────────────────

export interface DetailPanelActions {
  onOpenUrl: (url: string) => void;
  onWorkOnThis: (branchName: string, owner: string, repo: string) => void;
  onOpenPRFile: (owner: string, repo: string, prNumber: number, filename: string, patch?: string) => void;
  onUpdateMetadata: (itemId: string, owner: string, repo: string, issueNumber: number, labels?: string[]) => void;
  onFetchRepoLabels: (owner: string, repo: string) => void;
  onConvertDraftToReady: (itemId: string, owner: string, repo: string, prNumber: number) => void;
  onMergePR: (itemId: string, owner: string, repo: string, prNumber: number, method: 'merge' | 'squash' | 'rebase') => void;
}

interface Props {
  item: BoardItem;
  linkedPRs: LinkedPR[] | null;
  prFiles: PRFile[] | null;
  repoLabels: GHLabel[];
  codeownersEntries: Array<{ pattern: string; owners: string[] }>;
  onClose: () => void;
  actions: DetailPanelActions;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DetailPanel({ item, linkedPRs, prFiles, repoLabels, codeownersEntries, onClose, actions }: Props) {
  const [copied, setCopied] = useState(false);
  const isPR = item.type === 'PULL_REQUEST';
  const stateColor = item.state === 'OPEN' ? '#a6e3a1' : item.state === 'MERGED' ? '#cba6f7' : '#f38ba8';
  const qualityFlags = isPR ? computeQualityFlags(item, prFiles) : [];

  const copyBranch = () => {
    if (!item.headRefName) return;
    navigator.clipboard?.writeText(item.headRefName).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

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
            {isPR && item.isDraft && item.state === 'OPEN' && (
              <button className="detail-gh-btn" onClick={() => actions.onConvertDraftToReady(item.id, item.repositoryOwner, item.repository, item.number)}>
                Ready for review
              </button>
            )}
            {isPR && !item.isDraft && <MergeButton item={item} onMerge={(m) => actions.onMergePR(item.id, item.repositoryOwner, item.repository, item.number, m)} />}
            {isPR && item.headRefName && (
              <button className="detail-work-btn" onClick={() => actions.onWorkOnThis(item.headRefName!, item.repositoryOwner, item.repository)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 11 12 14 22 4"/>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
                Work on This
              </button>
            )}
            <button className="detail-gh-btn" onClick={() => actions.onOpenUrl(item.url)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              GitHub
            </button>
            <button className="detail-close-btn" onClick={onClose}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="detail-scroll">
          <h2 className="detail-title">{item.title}</h2>

          {/* Badges */}
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
                  <path d="M18 4l3 3-3 3"/><path d="M3 7h18"/><path d="M6 20l-3-3 3-3"/><path d="M21 17H3"/>
                </svg>
                {item.milestone.title}
                {item.milestone.dueOn && <span style={{ opacity: 0.6, marginLeft: 4 }}>due {new Date(item.milestone.dueOn).toLocaleDateString()}</span>}
              </span>
            )}
          </div>

          {/* Labels */}
          {item.labels.length > 0 && (
            <div className="detail-labels">
              {item.labels.map((label) => {
                const bg = `#${label.color}`;
                return <span key={label.name} className="label" style={{ background: bg + '33', color: bg, border: `1px solid ${bg}55` }}>{label.name}</span>;
              })}
            </div>
          )}

          {/* PR row: diff stats, CI, branch + copy */}
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
                <span className="detail-branch" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
                    <path d="M18 9a9 9 0 0 1-9 9"/>
                  </svg>
                  {item.headRefName}
                  <button className="branch-copy-btn" onClick={copyBranch} title="Copy branch name">
                    {copied
                      ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a6e3a1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                    }
                  </button>
                </span>
              )}
            </div>
          )}

          {isPR && <ReviewSummary reviews={item.reviews} requests={item.reviewRequests} />}

          {/* Quality score flags */}
          {isPR && qualityFlags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
              {qualityFlags.map((f) => (
                <span key={f.label} style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 8, background: f.color + '22', color: f.color, border: `1px solid ${f.color}44` }}>
                  {f.label}
                </span>
              ))}
            </div>
          )}

          <div className="detail-divider" />

          {/* Changed files (PRs) */}
          {isPR && (
            <>
              <div className="detail-section">
                <span className="detail-section-label">Changed Files</span>
                <PRFilesSection files={prFiles} item={item} codeownersEntries={codeownersEntries} onOpenPRFile={actions.onOpenPRFile} />
              </div>
              <div className="detail-divider" />
            </>
          )}

          {/* Description */}
          <div className="detail-section">
            <span className="detail-section-label">Description</span>
            {item.body ? <pre className="detail-body-text">{item.body}</pre> : <span className="detail-body-empty">No description provided.</span>}
          </div>

          {/* Linked PRs (issues) */}
          {!isPR && (
            <>
              <div className="detail-divider" />
              <div className="detail-section">
                <span className="detail-section-label">Linked Pull Requests & CI</span>
                <LinkedPRSection prs={linkedPRs} onOpenUrl={actions.onOpenUrl} />
              </div>
            </>
          )}

          <div className="detail-divider" />

          {/* Metadata editor (issues) */}
          {!isPR && (
            <>
              <div className="detail-section">
                <span className="detail-section-label">Edit Metadata</span>
                <MetadataEditor item={item} repoLabels={repoLabels} onUpdateMetadata={actions.onUpdateMetadata} onFetchRepoLabels={actions.onFetchRepoLabels} />
              </div>
              <div className="detail-divider" />
            </>
          )}

          {/* Meta grid */}
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
