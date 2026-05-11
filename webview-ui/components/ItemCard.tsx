import React from 'react';
import { BoardItem, CIState, ReviewInfo } from '../../src/types';

interface Props {
  item: BoardItem;
  onSelect: (item: BoardItem) => void;
  onOpenUrl: (url: string) => void;
}

// ── Icons ────────────────────────────────────────────────

function IssueIcon({ state }: { state: string }) {
  const color = state === 'CLOSED' ? '#f38ba8' : '#a6e3a1';
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
}

function PRIcon({ state, isDraft }: { state: string; isDraft?: boolean }) {
  if (isDraft) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#585b70" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/>
        <path d="M13 6h3a2 2 0 0 1 2 2v7"/>
        <line x1="6" y1="9" x2="6" y2="21"/>
      </svg>
    );
  }
  const color = state === 'MERGED' ? '#cba6f7' : state === 'CLOSED' ? '#f38ba8' : '#89b4fa';
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/>
      <path d="M13 6h3a2 2 0 0 1 2 2v7"/>
      <line x1="6" y1="9" x2="6" y2="21"/>
    </svg>
  );
}

function CIIcon({ state }: { state: CIState | undefined }) {
  if (!state || state === 'none' || state === 'EXPECTED') return null;
  if (state === 'SUCCESS') return (
    <span className="ci-icon ci-success" title="CI passing">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
    </span>
  );
  if (state === 'FAILURE' || state === 'ERROR') return (
    <span className="ci-icon ci-failure" title="CI failing">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
    </span>
  );
  return (
    <span className="ci-icon ci-pending" title="CI pending">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    </span>
  );
}

function ReviewIcons({ reviews, requests }: { reviews?: ReviewInfo[]; requests?: { login: string; avatarUrl: string }[] }) {
  if (!reviews?.length && !requests?.length) return null;

  const approved = reviews?.filter((r) => r.state === 'APPROVED').length ?? 0;
  const changes = reviews?.filter((r) => r.state === 'CHANGES_REQUESTED').length ?? 0;
  const pending = requests?.length ?? 0;

  return (
    <span className="review-icons">
      {approved > 0 && (
        <span className="review-approved" title={`${approved} approved`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
            <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
          </svg>
        </span>
      )}
      {changes > 0 && (
        <span className="review-changes" title={`${changes} changes requested`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/>
            <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
          </svg>
        </span>
      )}
      {pending > 0 && (
        <span className="review-pending" title={`${pending} review requested`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/>
          </svg>
        </span>
      )}
    </span>
  );
}

function Avatar({ user }: { user: { login: string; avatarUrl: string } }) {
  return (
    <span className="avatar" title={user.login}>
      {user.avatarUrl ? (
        <img src={user.avatarUrl} alt={user.login} />
      ) : (
        <span className="avatar-placeholder">{user.login[0]?.toUpperCase()}</span>
      )}
    </span>
  );
}

function RepoIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
    </svg>
  );
}

function BranchIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="3" x2="6" y2="15"/>
      <circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
      <path d="M18 9a9 9 0 0 1-9 9"/>
    </svg>
  );
}

// ── Main component ────────────────────────────────────────

export function ItemCard({ item, onSelect, onOpenUrl }: Props) {
  const isPR = item.type === 'PULL_REQUEST';

  return (
    <div className="item-card" onClick={() => onSelect(item)}>
      {/* Top row: icon + title + number + github link */}
      <div className="item-top">
        <span className="item-type">
          {isPR ? (
            <PRIcon state={item.state} isDraft={item.isDraft} />
          ) : (
            <IssueIcon state={item.state} />
          )}
        </span>

        <div className="item-body">
          <div className="item-title-row">
            <span className="item-title">{item.title}</span>
            <span className="item-num">#{item.number}</span>
            <button
              className="card-gh-link"
              onClick={(e) => { e.stopPropagation(); onOpenUrl(item.url); }}
              title="View on GitHub"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </button>
          </div>

          {/* Bottom row: labels + meta */}
          <div className="item-bottom">
            {/* Draft badge */}
            {isPR && item.isDraft && <span className="draft-badge">Draft</span>}

            {/* Labels */}
            {item.labels.map((label) => {
              const bg = `#${label.color}`;
              const r = parseInt(label.color.substring(0, 2), 16);
              const g = parseInt(label.color.substring(2, 4), 16);
              const b = parseInt(label.color.substring(4, 6), 16);
              const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
              // lum is calculated but used only for potential future text color logic
              void lum;
              return (
                <span
                  key={label.name}
                  className="label"
                  style={{ background: bg + '33', color: bg, border: `1px solid ${bg}55` }}
                >
                  {label.name}
                </span>
              );
            })}

            {/* Meta: right side */}
            <span className="item-meta">
              {/* Diff stats (PR only) */}
              {isPR && item.additions !== undefined && (
                <span className="diff-stats">
                  <span className="diff-add">+{item.additions}</span>
                  <span className="diff-del">-{item.deletions ?? 0}</span>
                </span>
              )}

              {/* CI status */}
              {isPR && <CIIcon state={item.ciState} />}

              {/* Review status */}
              {isPR && (
                <ReviewIcons reviews={item.reviews} requests={item.reviewRequests} />
              )}

              {/* Branch */}
              {isPR && item.headRefName && (
                <span className="branch-tag" title={item.headRefName}>
                  <BranchIcon />
                  {item.headRefName}
                </span>
              )}

              {/* Repo */}
              <span className="repo-tag">
                <RepoIcon />
                {item.repository}
              </span>

              {/* Assignees */}
              {item.assignees.length > 0 && (
                <span className="avatar-group">
                  {item.assignees.slice(0, 3).map((a) => (
                    <Avatar key={a.login} user={a} />
                  ))}
                  {item.assignees.length > 3 && (
                    <span className="avatar" title={`+${item.assignees.length - 3} more`}>
                      <span className="avatar-placeholder">+{item.assignees.length - 3}</span>
                    </span>
                  )}
                </span>
              )}

              {/* Author */}
              <Avatar user={item.author} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
