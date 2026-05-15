import React from 'react';
import { BoardItem, CIState, ReviewInfo } from '../../src/types';
import { STALE_THRESHOLD_DAYS } from '../constants';

interface Props {
  item: BoardItem;
  onSelect: (item: BoardItem) => void;
  onOpenUrl: (url: string) => void;
}

// ── Helpers ───────────────────────────────────────────────

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
    state === 'SUCCESS' ? 'CI passing' :
    state === 'FAILURE' ? 'CI failing' :
    state === 'ERROR' ? 'CI error' : 'CI pending';
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

// ── Main component ────────────────────────────────────────

export function ItemCard({ item, onSelect, onOpenUrl }: Props) {
  const isPR = item.type === 'PULL_REQUEST';
  const age = timeAgo(item.updatedAt);
  const daysSinceUpdate = (Date.now() - new Date(item.updatedAt).getTime()) / 86_400_000;
  const isStale = daysSinceUpdate > STALE_THRESHOLD_DAYS;

  return (
    <div className="item-card" onClick={() => onSelect(item)}>

      {/* Age */}
      <span className="lp-age" style={isStale ? { color: '#f9e2af' } : undefined} title={isStale ? `No activity for ${Math.floor(daysSinceUpdate)}d` : undefined}>
        {age}
      </span>

      {/* Status: branch+CI+review for PRs, issue icon for issues */}
      <span className="lp-status-icons">
        {isPR ? (
          <>
            <svg className="lp-branch-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="6" y1="3" x2="6" y2="15"/>
              <circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
              <path d="M18 9a9 9 0 0 1-9 9"/>
            </svg>
            <CIDot state={item.ciState} />
            <ReviewDot reviews={item.reviews} />
          </>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={item.state === 'CLOSED' ? '#f38ba8' : '#a6e3a1'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        )}
      </span>

      {/* Title + number + labels */}
      <span className="lp-title-wrap">
        {isPR && item.isDraft && <span className="lp-draft-badge">Draft</span>}
        <span className="lp-title">{item.title}</span>
        <button
          className="lp-num"
          onClick={(e) => { e.stopPropagation(); onOpenUrl(item.url); }}
          title="View on GitHub"
        >
          #{item.number}
        </button>
        {item.labels.slice(0, 3).map((label) => {
          const bg = `#${label.color}`;
          return (
            <span
              key={label.name}
              className="label"
              style={{ background: bg + '33', color: bg, border: `1px solid ${bg}55`, flexShrink: 0 }}
            >
              {label.name}
            </span>
          );
        })}
      </span>

      {/* Diff stats */}
      <span className="lp-diff">
        {isPR && item.additions !== undefined && (
          <>
            <span className="lp-add">+{item.additions}</span>
            <span className="lp-del">-{item.deletions ?? 0}</span>
          </>
        )}
      </span>

      {/* Author */}
      <span className="lp-avatars">
        {item.author.avatarUrl ? (
          <img src={item.author.avatarUrl} alt={item.author.login} className="lp-avatar" title={item.author.login} />
        ) : (
          <span className="lp-avatar lp-avatar-placeholder" title={item.author.login}>{item.author.login[0]?.toUpperCase()}</span>
        )}
      </span>

      {/* Assignees */}
      <span className="lp-avatars">
        {item.assignees.slice(0, 3).map((a) =>
          a.avatarUrl ? (
            <img key={a.login} src={a.avatarUrl} alt={a.login} className="lp-avatar" title={a.login} />
          ) : (
            <span key={a.login} className="lp-avatar lp-avatar-placeholder" title={a.login}>{a.login[0]?.toUpperCase()}</span>
          )
        )}
      </span>

      {/* Repo / branch */}
      <span className="lp-branch">
        <span className="lp-repo">{item.repository}</span>
        {isPR && item.headRefName && <span className="lp-branch-name">{item.headRefName}</span>}
      </span>

    </div>
  );
}
