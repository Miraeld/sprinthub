import React from 'react';
import { BoardItem, CIState, ReviewInfo } from '../../src/types';

interface Props {
  items: BoardItem[];
  linkedIssuePRs?: BoardItem[];
  viewerLogin: string;
  onSelect: (item: BoardItem) => void;
  onOpenUrl: (url: string) => void;
}

// ─── Group logic ────────────────────────────────────────────────────────────

type LaunchpadGroup =
  | 'Ready to Merge'
  | 'Changes Requested'
  | 'CI Failing'
  | 'Ready for Review'
  | 'Needs Review'
  | 'In Progress'
  | 'Draft';

const GROUP_ORDER: LaunchpadGroup[] = [
  'Ready to Merge',
  'Changes Requested',
  'CI Failing',
  'Ready for Review',
  'Needs Review',
  'In Progress',
  'Draft',
];

const GROUP_META: Record<LaunchpadGroup, { color: string; icon: string; desc: string }> = {
  'Ready to Merge':    { color: '#a6e3a1', icon: '🚀', desc: 'Approved and all checks passed' },
  'Changes Requested': { color: '#f38ba8', icon: '✗',  desc: 'Review requested changes' },
  'CI Failing':        { color: '#f38ba8', icon: '✕',  desc: 'Checks are failing' },
  'Ready for Review':  { color: '#f9e2af', icon: '👁',  desc: 'In the Ready for Review column — awaiting review' },
  'Needs Review':      { color: '#cba6f7', icon: '❓',  desc: 'No reviewer assigned yet' },
  'In Progress':       { color: '#89b4fa', icon: '◑',  desc: 'Work in progress' },
  'Draft':             { color: '#585b70', icon: '✎',  desc: 'Draft pull requests' },
};

function getPRGroup(item: BoardItem): LaunchpadGroup {
  if (item.isDraft) return 'Draft';

  const hasChangesRequested = item.reviews?.some((r) => r.state === 'CHANGES_REQUESTED');
  if (hasChangesRequested) return 'Changes Requested';

  if (item.ciState === 'FAILURE' || item.ciState === 'ERROR') return 'CI Failing';

  const isApproved = item.reviews?.some((r) => r.state === 'APPROVED');
  const ciOk = !item.ciState || item.ciState === 'SUCCESS' || item.ciState === 'none' || item.ciState === 'EXPECTED';
  if (isApproved && ciOk) return 'Ready to Merge';

  // Board column "Ready for review" (case-insensitive) takes priority over generic grouping
  if (item.column?.toLowerCase() === 'ready for review') return 'Ready for Review';

  // No reviewer assigned at all → clearly needs someone to pick it up
  const hasAnyReview = item.reviews?.some(
    (r) => r.state === 'APPROVED' || r.state === 'COMMENTED' || r.state === 'CHANGES_REQUESTED'
  );
  if (!hasAnyReview && !item.reviewRequests?.length) return 'Needs Review';

  return 'In Progress';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

function CIDot({ state }: { state: CIState | undefined }) {
  if (!state || state === 'none' || state === 'EXPECTED') {
    return <span className="lp-ci-dot lp-ci-neutral" title="No CI" />;
  }
  const cls =
    state === 'SUCCESS' ? 'lp-ci-dot lp-ci-success' :
    state === 'FAILURE' || state === 'ERROR' ? 'lp-ci-dot lp-ci-fail' :
    'lp-ci-dot lp-ci-pending';
  const label =
    state === 'SUCCESS' ? 'All checks passed' :
    state === 'FAILURE' ? 'Checks failing' :
    state === 'ERROR' ? 'Check error' :
    'Checks pending';
  return <span className={cls} title={label} />;
}

function ReviewDot({ reviews }: { reviews: ReviewInfo[] | undefined }) {
  if (!reviews?.length) return <span className="lp-review-dot lp-review-none" title="No reviews" />;
  if (reviews.some((r) => r.state === 'CHANGES_REQUESTED'))
    return <span className="lp-review-dot lp-review-changes" title="Changes requested" />;
  if (reviews.some((r) => r.state === 'APPROVED'))
    return <span className="lp-review-dot lp-review-approved" title="Approved" />;
  return <span className="lp-review-dot lp-review-commented" title="Reviewed" />;
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function LaunchpadRow({ item, viewerLogin, onSelect, onOpenUrl }: { item: BoardItem; viewerLogin: string; onSelect: (i: BoardItem) => void; onOpenUrl: (url: string) => void }) {
  const age = timeAgo(item.updatedAt);
  const collaborators = [
    ...item.assignees,
    ...(item.reviewRequests ?? []),
  ].filter((u, i, arr) => arr.findIndex((x) => x.login === u.login) === i).slice(0, 4);

  const daysSinceUpdate = (Date.now() - new Date(item.updatedAt).getTime()) / 86_400_000;
  const isStale = daysSinceUpdate > 7;
  const waitingOnMe = viewerLogin ? item.reviewRequests?.some((r) => r.login === viewerLogin) ?? false : false;

  return (
    <div
      className="lp-row"
      onClick={() => onSelect(item)}
      style={waitingOnMe ? { background: 'rgba(203, 166, 247, 0.06)', borderLeft: '2px solid #cba6f7' } : undefined}
    >
      {/* Age */}
      <span className="lp-age" style={isStale ? { color: '#f9e2af' } : undefined}>
        {age}
        {isStale && (
          <span style={{ marginLeft: 3, fontSize: 9, fontWeight: 700, color: '#f9e2af', verticalAlign: 'middle' }} title={`Stale — no activity for ${Math.floor(daysSinceUpdate)}d`}>●</span>
        )}
      </span>

      {/* Status icons */}
      <span className="lp-status-icons">
        <svg className="lp-branch-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="6" y1="3" x2="6" y2="15"/>
          <circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
          <path d="M18 9a9 9 0 0 1-9 9"/>
        </svg>
        <CIDot state={item.ciState} />
        <ReviewDot reviews={item.reviews} />
      </span>

      {/* Title + number */}
      <span className="lp-title-wrap">
        {item.isDraft && <span className="lp-draft-badge">Draft</span>}
        <span className="lp-title">{item.title}</span>
        <button
          className="lp-num"
          onClick={(e) => { e.stopPropagation(); onOpenUrl(item.url); }}
          title="Open on GitHub"
        >
          #{item.number}
        </button>
      </span>

      {/* Diff stats */}
      {item.additions !== undefined && (
        <span className="lp-diff">
          <span className="lp-add">+{item.additions}</span>
          <span className="lp-del">-{item.deletions ?? 0}</span>
        </span>
      )}

      {/* Author */}
      <span className="lp-avatars">
        {item.author.avatarUrl && (
          <img src={item.author.avatarUrl} alt={item.author.login} className="lp-avatar" title={item.author.login} />
        )}
      </span>

      {/* Collaborators */}
      <span className="lp-avatars">
        {collaborators.map((u) =>
          u.avatarUrl ? (
            <img key={u.login} src={u.avatarUrl} alt={u.login} className="lp-avatar" title={u.login} />
          ) : null
        )}
      </span>

      {/* Repo / branch */}
      <span className="lp-branch">
        <span className="lp-repo">{item.repository}</span>
        {item.headRefName && <span className="lp-branch-name">{item.headRefName}</span>}
      </span>
    </div>
  );
}

// ─── Main view ───────────────────────────────────────────────────────────────

export function LaunchpadView({ items, linkedIssuePRs = [], viewerLogin, onSelect, onOpenUrl }: Props) {
  const [assignedToMe, setAssignedToMe] = React.useState(false);

  const prs = React.useMemo(() => {
    // Merge direct board PRs + issue-linked PRs, dedup by repo#number
    const directPRs = items.filter((i) => i.type === 'PULL_REQUEST' && i.state === 'OPEN');
    const seen = new Set(directPRs.map((p) => `${p.repository}#${p.number}`));
    const extraPRs = linkedIssuePRs.filter(
      (p) => p.state === 'OPEN' && !seen.has(`${p.repository}#${p.number}`)
    );
    let list = [...directPRs, ...extraPRs];

    if (assignedToMe && viewerLogin) {
      list = list.filter((i) =>
        i.author?.login === viewerLogin ||
        i.assignees.some((a) => a.login === viewerLogin) ||
        i.reviewRequests?.some((r) => r.login === viewerLogin) ||
        i.reviews?.some((r) => r.author.login === viewerLogin)
      );
    }
    return list;
  }, [items, linkedIssuePRs, assignedToMe, viewerLogin]);

  const grouped = React.useMemo(() => {
    const map: Record<LaunchpadGroup, BoardItem[]> = {
      'Ready to Merge': [],
      'Changes Requested': [],
      'CI Failing': [],
      'Ready for Review': [],
      'Needs Review': [],
      'In Progress': [],
      'Draft': [],
    };
    for (const item of prs) {
      map[getPRGroup(item)].push(item);
    }
    for (const g of GROUP_ORDER) {
      map[g].sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
    }
    return map;
  }, [prs]);

  const totalCount = prs.length;

  return (
    <div className="lp-wrap">
      {/* Dashboard toolbar */}
      <div className="lp-toolbar">
        <span className="lp-count">{totalCount} pull request{totalCount !== 1 ? 's' : ''}</span>
        {viewerLogin && (
          <button
            className={`lp-filter-btn${assignedToMe ? ' active' : ''}`}
            onClick={() => setAssignedToMe((v) => !v)}
            title={assignedToMe ? 'Showing PRs assigned to or reviewed by you' : 'Filter to PRs assigned to or where you are a reviewer'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
            Assigned to me
          </button>
        )}
      </div>

      {/* Column header */}
      <div className="lp-header-row">
        <span className="lp-col-age">Age</span>
        <span className="lp-col-status">Status</span>
        <span className="lp-col-title">Item</span>
        <span className="lp-col-diff">Diff</span>
        <span className="lp-col-author">Author</span>
        <span className="lp-col-collabs">Collaborators</span>
        <span className="lp-col-branch">Repo / Branch</span>
      </div>

      {!prs.length ? (
        <div className="lp-empty" style={{ marginTop: 40 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#45475a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/>
            <path d="M13 6h3a2 2 0 0 1 2 2v7"/>
            <line x1="6" y1="9" x2="6" y2="21"/>
          </svg>
          {assignedToMe
            ? 'No open PRs assigned to or reviewed by you.'
            : 'No open pull requests found.'}
        </div>
      ) : (
        GROUP_ORDER.map((group) => {
          const groupItems = grouped[group];
          if (!groupItems.length) return null;
          const meta = GROUP_META[group];
          return (
            <LaunchpadGroup
              key={group}
              group={group}
              meta={meta}
              items={groupItems}
              viewerLogin={viewerLogin}
              onSelect={onSelect}
              onOpenUrl={onOpenUrl}
            />
          );
        })
      )}
    </div>
  );
}

function LaunchpadGroup({
  group, meta, items, viewerLogin, onSelect, onOpenUrl,
}: {
  group: string;
  meta: { color: string; icon: string; desc: string };
  items: BoardItem[];
  viewerLogin: string;
  onSelect: (i: BoardItem) => void;
  onOpenUrl: (url: string) => void;
}) {
  const [open, setOpen] = React.useState(true);
  return (
    <div className="lp-group">
      <div className="lp-group-header" onClick={() => setOpen((v) => !v)}>
        <span className={`col-chevron${open ? ' open' : ''}`}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </span>
        <span className="lp-group-icon" style={{ color: meta.color }}>{meta.icon}</span>
        <span className="lp-group-name" style={{ color: meta.color }}>{group}</span>
        <span className="col-count">{items.length}</span>
      </div>
      {open && (
        <div className="lp-group-rows">
          {items.map((item) => (
            <LaunchpadRow key={item.id} item={item} viewerLogin={viewerLogin} onSelect={onSelect} onOpenUrl={onOpenUrl} />
          ))}
        </div>
      )}
    </div>
  );
}

// React.useMemo is used directly via React.useMemo in this file
