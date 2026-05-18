import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { BoardItem, ConflictThreat, ExtensionMessage, GHLabel, LinkedPR, PRFile, RunwayConfig, RunwayData, StandupData, StandupSection, StandupRepoGroup } from '../src/types';
import { ColumnGroup } from './components/ColumnGroup';
import { DetailPanel } from './components/DetailPanel';
import { LaunchpadView } from './components/LaunchpadView';
import { SettingsPanel } from './components/SettingsPanel';

// Acquire vscode API once (must not be called more than once)
declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};
const vscodeApi = acquireVsCodeApi();

type FilterTab = 'dashboard' | 'all' | 'prs' | 'issues' | 'milestones';

// CSS is loaded externally via out/styles.css (see SprintHubPanel._buildHtml)


// Column metadata
const COLUMN_CONFIG: Record<string, { color: string; emoji: string }> = {
  'TODO':                  { color: '#585b70', emoji: '○' },
  'In Progress':           { color: '#89b4fa', emoji: '◑' },
  'Ready For Review':      { color: '#fab387', emoji: '👁' },
  'Ready For QA':          { color: '#f9e2af', emoji: '🔍' },
  'QA Done':               { color: '#a6e3a1', emoji: '✓' },
  'Done':                  { color: '#74c7ec', emoji: '✓✓' },
  'Blocked':               { color: '#f38ba8', emoji: '⊘' },
  'Needs Grooming':        { color: '#cba6f7', emoji: '✂' },
  'Grooming in Progress':  { color: '#b4befe', emoji: '⚙' },
  'Grooming to Review':    { color: '#f5c2e7', emoji: '⬡' },
};

function getColumnConfig(name: string) {
  return COLUMN_CONFIG[name] ?? { color: '#6c7086', emoji: '·' };
}

// ── Standup rich view ──────────────────────────────────────────────────────────

function StandupRepoGroupView({ group, open, onToggle, onOpenUrl }: { group: StandupRepoGroup; open: boolean; onToggle: () => void; onOpenUrl: (url: string) => void }) {
  return (
    <div className="su-repo-group">
      <button className="su-repo-header" aria-expanded={open} onClick={onToggle}>
        <svg
          className={`su-repo-chevron${open ? ' open' : ''}`}
          width="11" height="11" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6"/>
        </svg>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, flexShrink: 0 }}>
          <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
        </svg>
        <span className="su-repo-name">{group.repo}</span>
        <span className="su-repo-count">{group.items.length}</span>
      </button>
      {open && (
        <div className="su-repo-items">
          {group.items.map((item) => (
            <button
              key={item.number}
              className="su-item"
              onClick={() => onOpenUrl(item.url)}
            >
              {item.isPR ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#89b4fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/>
                  <path d="M13 6h3a2 2 0 0 1 2 2v7"/>
                  <line x1="6" y1="9" x2="6" y2="21"/>
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a6e3a1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              )}
              <span className="su-item-num">#{item.number}</span>
              <span className="su-item-title">{item.title}</span>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3, flexShrink: 0 }}>
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StandupSectionView({ section, openMap, onToggle, onOpenUrl }: { section: StandupSection; openMap: Map<string, boolean>; onToggle: (repo: string) => void; onOpenUrl: (url: string) => void }) {
  const total = section.groups.reduce((s, g) => s + g.items.length, 0);
  return (
    <div className="su-section">
      <div className="su-section-header">
        <span className="su-section-icon">{section.icon}</span>
        <span className="su-section-title">{section.title}</span>
        <span className="su-section-count">{total}</span>
      </div>
      {section.groups.map((group) => (
        <StandupRepoGroupView
          key={group.repo}
          group={group}
          open={openMap.get(group.repo) ?? true}
          onToggle={() => onToggle(group.repo)}
          onOpenUrl={onOpenUrl}
        />
      ))}
    </div>
  );
}

function StandupView({ data, onOpenUrl }: { data: StandupData; onOpenUrl: (url: string) => void }) {
  const [openMap, setOpenMap] = useState<Map<string, boolean>>(() => new Map());
  const handleToggle = (repo: string) => {
    setOpenMap((prev) => {
      const next = new Map(prev);
      next.set(repo, !(prev.get(repo) ?? true));
      return next;
    });
  };
  return (
    <div className="standup-rendered">
      <div className="su-date">{data.date}</div>
      {data.error ? (
        <p className="standup-p" style={{ color: '#f38ba8', fontStyle: 'italic' }}>Error: {data.error}</p>
      ) : data.sections.length === 0 ? (
        <p className="standup-p" style={{ color: '#6c7086', fontStyle: 'italic' }}>No activity found in the last 24 hours.</p>
      ) : (
        data.sections.map((section) => (
          <StandupSectionView key={section.key} section={section} openMap={openMap} onToggle={handleToggle} onOpenUrl={onOpenUrl} />
        ))
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function App() {
  const [state, setState] = useState<'loading' | 'error' | 'data'>('loading');
  const [data, setData] = useState<RunwayData | null>(null);
  const [config, setConfig] = useState<RunwayConfig | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 150);
  const [tab, setTab] = useState<FilterTab>('dashboard');
  const [sprintFilter, setSprintFilter] = useState<string | null>(() => {
    const saved = vscodeApi.getState() as { sprintFilter?: string | null } | undefined;
    return saved?.sprintFilter ?? null;
  });
  // Auto-select the first sprint only once, deferred to dataComplete so the full
  // sprint list (all pages) is known before committing. Once the user explicitly
  // sets or clears the filter it must never be overridden by a background refresh.
  const sprintNeedsAutoSelect = React.useRef(
    (vscodeApi.getState() as { sprintFilter?: string | null } | undefined)?.sprintFilter === undefined
  );
  // Always-current reference to data — used in dataComplete to access latest sprints
  // without stale closure issues.
  const dataRef = React.useRef<RunwayData | null>(null);
  const [detailItem, setDetailItem] = useState<BoardItem | null>(null);
  const [linkedPRs, setLinkedPRs] = useState<LinkedPR[] | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsOwners, setSettingsOwners] = useState<Array<{ login: string; ownerType: 'organization' | 'user' }> | null>(null);
  const [settingsProjects, setSettingsProjects] = useState<Array<{ number: number; title: string }> | null>(null);
  // Phase 1: PR file deep linking
  const [prFiles, setPrFiles] = useState<PRFile[] | null>(null);
  // Phase 2: conflict threats
  const [conflictThreats, setConflictThreats] = useState<ConflictThreat[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(true);
  // Phase 3: standup
  const [standupData, setStandupData] = useState<StandupData | null>(null);
  const [standupMarkdown, setStandupMarkdown] = useState<string | null>(null);
  const [standupLoading, setStandupLoading] = useState(false);
  const [standupView, setStandupView] = useState<'view' | 'markdown'>('view');
  // Phase 3: repo labels cache keyed by "owner/repo"
  const [repoLabelsCache, setRepoLabelsCache] = useState<Map<string, GHLabel[]>>(new Map());
  // v2: CODEOWNERS cache keyed by "owner/repo"
  const [codeownersCache, setCodeownersCache] = useState<Map<string, Array<{ pattern: string; owners: string[] }>>>(new Map());
  // Body cache keyed by "itemId:updatedAt" — a changed updatedAt is a cache miss,
  // so board refreshes automatically invalidate stale bodies without a full wipe.
  const itemBodyCache = React.useRef<Map<string, string>>(new Map());
  // Tracks the last fetchBody key sent to avoid duplicate requests when
  // handleSelectItem and the stale-body useEffect both fire for the same item.
  const lastBodyFetchKey = React.useRef<string | null>(null);
  // True while a live refresh is in-flight (between 'refreshing' and 'dataComplete').
  // Suppresses per-page setData() calls so the board never clears mid-refresh.
  const isRefreshingRef = useRef(false);

  // Keyboard navigation
  const searchInputRef = useRef<HTMLInputElement>(null);
  const keyboardFocusedIndex = useRef<number>(-1);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data as ExtensionMessage;
      switch (msg.type) {
        case 'loading':
          isRefreshingRef.current = false;
          setIsLoadingMore(true);
          if (state !== 'data') setState('loading');
          break;
        case 'refreshing':
          isRefreshingRef.current = true;
          setIsLoadingMore(true);
          break;
        case 'dataComplete': {
          isRefreshingRef.current = false;
          setIsLoadingMore(false);
          setIsRefreshing(false);
          setIsProcessing(true);
          // Apply the final assembled data (may have been buffered during refresh).
          const final = dataRef.current;
          if (final) {
            setData(final);
            setState('data');
            setDetailItem((prev) => {
              if (!prev) return prev;
              for (const col of Object.values(final.groups)) {
                const updated = col.find((i) => i.id === prev.id);
                if (updated) {
                  return updated.updatedAt !== prev.updatedAt
                    ? { ...updated }
                    : { ...updated, body: prev.body };
                }
              }
              const linkedPR = (final.linkedIssuePRs ?? []).find((i) => i.id === prev.id);
              if (linkedPR) return { ...linkedPR, body: prev.body };
              return null;
            });
          }
          // Auto-select or validate sprint against the complete dataset.
          if (final?.sprints.length) {
            const { sprints } = final;
            setSprintFilter((prev) => {
              if (sprintNeedsAutoSelect.current) {
                sprintNeedsAutoSelect.current = false;
                return prev !== null && sprints.includes(prev) ? prev : (sprints[0] ?? null);
              }
              if (prev === null) return null;
              return sprints.includes(prev) ? prev : (sprints[0] ?? null);
            });
          }
          break;
        }
        case 'data': {
          dataRef.current = msg.payload;
          // During a live refresh: buffer pages without updating the display.
          // This prevents the board from briefly clearing to 1 page mid-refresh.
          // dataComplete will apply the final complete data atomically.
          if (isRefreshingRef.current) break;
          setData(msg.payload);
          setState('data');
          setSprintFilter((prev) => {
            const { sprints } = msg.payload;
            if (prev === null) return null;
            if (sprints.length === 0) return null;
            return sprints.includes(prev) ? prev : sprints[0];
          });
          setDetailItem((prev) => {
            if (!prev) return prev;
            for (const col of Object.values(msg.payload.groups)) {
              const updated = col.find((i) => i.id === prev.id);
              if (updated) {
                return updated.updatedAt !== prev.updatedAt
                  ? { ...updated }
                  : { ...updated, body: prev.body };
              }
            }
            const linkedPR = (msg.payload.linkedIssuePRs ?? []).find((i) => i.id === prev.id);
            if (linkedPR) return { ...linkedPR, body: prev.body };
            return null;
          });
          break;
        }
        case 'error':
          setErrorMsg(msg.message);
          setState('error');
          setIsRefreshing(false);
          break;
        case 'config':
          setConfig(msg.payload);
          break;
        case 'linkedPRs':
          setLinkedPRs(msg.prs);
          break;
        case 'itemBody':
          // null = transient fetch failure; skip caching so next open retries
          if (msg.body !== null) {
            itemBodyCache.current.set(`${msg.itemId}:${msg.updatedAt}`, msg.body);
          }
          setDetailItem((prev) =>
            prev && prev.id === msg.itemId
              ? { ...prev, body: msg.body ?? undefined }
              : prev
          );
          break;
        // Phase 1: PR files
        case 'prFiles':
          setPrFiles(msg.files);
          break;
        case 'linkedIssuePRs':
          setData((prev) => prev ? { ...prev, linkedIssuePRs: msg.prs } : null);
          setIsProcessing(false);
          break;
        // Phase 2: conflict threats
        case 'conflictThreats':
          setConflictThreats(msg.threats);
          break;
        // Phase 3: standup
        case 'standup':
          setStandupData(msg.data);
          setStandupMarkdown(msg.markdown);
          setStandupLoading(false);
          break;
        // Phase 3: metadata confirmed
        case 'metadataUpdated':
          setDetailItem((prev) =>
            prev && prev.id === msg.itemId
              ? { ...prev, labels: msg.labels, assignees: msg.assignees }
              : prev
          );
          break;
        // Phase 3: repo labels loaded
        case 'repoLabels': {
          const cacheKey = `${msg.owner}/${msg.repo}`;
          labelsInFlight.current.delete(cacheKey);
          setRepoLabelsCache((prev) => new Map(prev).set(cacheKey, msg.labels));
          break;
        }
        // v2: draft converted to ready
        case 'prReadied':
          setDetailItem((prev) => prev && prev.id === msg.itemId ? { ...prev, isDraft: false } : prev);
          break;
        // v2: PR merged
        case 'prMerged':
          setDetailItem((prev) => prev && prev.id === msg.itemId ? { ...prev, state: 'MERGED' } : prev);
          break;
        // v2: CODEOWNERS loaded
        case 'codeowners': {
          const coKey = `${msg.owner}/${msg.repo}`;
          setCodeownersCache((prev) => new Map(prev).set(coKey, msg.entries));
          break;
        }
        // Settings pickers
        case 'settingsOwners':
          setSettingsOwners(msg.owners);
          break;
        case 'settingsProjects':
          setSettingsProjects(msg.projects);
          break;
      }
    };

    window.addEventListener('message', handler);
    // Request current config on mount
    vscodeApi.postMessage({ type: 'getConfig' });
    return () => window.removeEventListener('message', handler);
  }, [state]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    vscodeApi.postMessage({ type: 'refresh' });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const NAVIGABLE = '.item-card, .lp-row';

    function getCards(): HTMLElement[] {
      return Array.from(document.querySelectorAll<HTMLElement>(NAVIGABLE));
    }

    function setFocus(index: number) {
      const cards = getCards();
      if (!cards.length) return;
      const clamped = Math.max(0, Math.min(index, cards.length - 1));
      // Remove highlight from previous
      document.querySelector<HTMLElement>('.keyboard-focused')?.classList.remove('keyboard-focused');
      cards[clamped].classList.add('keyboard-focused');
      cards[clamped].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      keyboardFocusedIndex.current = clamped;
    }

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.tagName === 'BUTTON' ||
        target.isContentEditable;

      // Cmd/Ctrl+K — focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      // Esc — close detail panel (handled first) or blur search
      if (e.key === 'Escape') {
        setDetailItem(null);
        setLinkedPRs(null);
        setPrFiles(null);
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        return;
      }

      // Skip R / arrow / Enter when typing in an input
      if (inInput) return;

      // R — refresh
      if (e.key === 'r' || e.key === 'R') {
        handleRefresh();
        return;
      }

      // ↑/↓ — navigate cards
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const cards = getCards();
        if (!cards.length) return;
        const current = keyboardFocusedIndex.current;
        const next = e.key === 'ArrowDown'
          ? (current < cards.length - 1 ? current + 1 : 0)
          : (current > 0 ? current - 1 : cards.length - 1);
        setFocus(next);
        return;
      }

      // Enter — open focused card
      if (e.key === 'Enter') {
        const idx = keyboardFocusedIndex.current;
        const cards = getCards();
        if (idx >= 0 && idx < cards.length) {
          cards[idx].click();
        }
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleRefresh]);

  const handleOpenUrl = useCallback((url: string) => {
    vscodeApi.postMessage({ type: 'openUrl', url });
  }, []);

  const handleSaveConfig = useCallback((cfg: RunwayConfig) => {
    vscodeApi.postMessage({ type: 'updateConfig', payload: cfg });
    setConfig(cfg);
  }, []);

  // Persist sprint filter so it survives tab switches and panel re-opens
  useEffect(() => {
    const current = (vscodeApi.getState() as Record<string, unknown> | undefined) ?? {};
    vscodeApi.setState({ ...current, sprintFilter });
  }, [sprintFilter]);

  // Apply visual mode classes on both body and #root.
  // body → needed for body-level background/color overrides.
  // #root → needed for position:fixed overlay descendants (detail panel, settings modal).
  useEffect(() => {
    const root = document.getElementById('root');
    if (!root) return;
    const isLight = config?.theme === 'light';
    const isColorBlind = config?.colorBlind ?? false;
    // Liquid Glass is always on — the toggle is removed from the settings UI.
    root.classList.add('liquid-glass');
    root.classList.toggle('light-theme', isLight);
    root.classList.toggle('color-blind', isColorBlind);
    document.body.classList.add('liquid-glass');
    document.body.classList.toggle('light-theme', isLight);
    document.body.classList.toggle('color-blind', isColorBlind);
  }, [config?.theme, config?.colorBlind]);

  const filteredGroups = useMemo((): Record<string, BoardItem[]> => {
    if (!data) return {};
    const q = debouncedSearch.toLowerCase().trim();

    const result: Record<string, BoardItem[]> = {};
    for (const col of data.columns) {
      let items = data.groups[col] ?? [];

      // Tab filter (milestones tab shows all types in its own view)
      if (tab === 'prs') items = items.filter((i) => i.type === 'PULL_REQUEST');
      if (tab === 'issues') items = items.filter((i) => i.type === 'ISSUE');

      // Sprint filter
      if (sprintFilter) items = items.filter((i) => i.sprint === sprintFilter);

      // Search filter
      if (q) {
        items = items.filter(
          (i) =>
            i.title.toLowerCase().includes(q) ||
            String(i.number).includes(q) ||
            i.author.login.toLowerCase().includes(q) ||
            i.labels.some((l) => l.name.toLowerCase().includes(q)) ||
            i.repository.toLowerCase().includes(q) ||
            (i.headRefName ?? '').toLowerCase().includes(q) ||
            (i.sprint ?? '').toLowerCase().includes(q) ||
            (i.milestone?.title ?? '').toLowerCase().includes(q)
        );
      }

      result[col] = items;
    }
    return result;
  }, [data, debouncedSearch, tab, sprintFilter]);

  const milestoneGroups = useMemo((): Record<string, BoardItem[]> => {
    if (!data) return {};
    const allItems = Object.values(data.groups).flat();
    const q = debouncedSearch.toLowerCase().trim();

    let items = allItems;
    if (sprintFilter) items = items.filter((i) => i.sprint === sprintFilter);
    if (q) {
      items = items.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          String(i.number).includes(q) ||
          i.author.login.toLowerCase().includes(q) ||
          i.labels.some((l) => l.name.toLowerCase().includes(q)) ||
          (i.milestone?.title ?? '').toLowerCase().includes(q)
      );
    }

    const groups: Record<string, BoardItem[]> = {};
    for (const item of items) {
      const key = item.milestone?.title ?? '(No Milestone)';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  }, [data, debouncedSearch, sprintFilter]);

  const filteredLinkedIssuePRs = useMemo(() => {
    let linked = data?.linkedIssuePRs ?? [];
    if (sprintFilter) linked = linked.filter((i) => i.sprint === sprintFilter);
    const q = debouncedSearch.toLowerCase().trim();
    if (!q) return linked;
    return linked.filter((i) =>
      i.title.toLowerCase().includes(q) ||
      String(i.number).includes(q) ||
      i.author.login.toLowerCase().includes(q) ||
      i.labels.some((l) => l.name.toLowerCase().includes(q)) ||
      i.repository.toLowerCase().includes(q) ||
      (i.headRefName ?? '').toLowerCase().includes(q)
    );
  }, [data, debouncedSearch, sprintFilter]);

  // Reset keyboard focus whenever the visible card set changes (filter, search, tab, sprint)
  useEffect(() => {
    document.querySelector<HTMLElement>('.keyboard-focused')?.classList.remove('keyboard-focused');
    keyboardFocusedIndex.current = -1;
  }, [filteredGroups, tab]);

  const counts = useMemo(() => {
    if (!data) return { all: 0, prs: 0, issues: 0 };
    let all = Object.values(data.groups).flat();
    if (sprintFilter) all = all.filter((i) => i.sprint === sprintFilter);
    return {
      all: all.length,
      prs: all.filter((i) => i.type === 'PULL_REQUEST').length,
      issues: all.filter((i) => i.type === 'ISSUE').length,
    };
  }, [data, sprintFilter]);

  const handleSelectItem = useCallback((item: BoardItem) => {
    // Cache key includes updatedAt — a board refresh that changes updatedAt
    // is automatically a cache miss, keeping bodies fresh.
    const cacheKey = `${item.id}:${item.updatedAt}`;
    const cachedBody = itemBodyCache.current.get(cacheKey);
    setDetailItem(cachedBody !== undefined ? { ...item, body: cachedBody } : item);
    setLinkedPRs(null);
    setPrFiles(null);

    if (item.body === undefined && cachedBody === undefined) {
      lastBodyFetchKey.current = `${item.id}:${item.updatedAt}`;
      vscodeApi.postMessage({
        type: 'fetchBody',
        itemId: item.id,
        owner: item.repositoryOwner,
        repo: item.repository,
        number: item.number,
        isIssue: item.type === 'ISSUE',
        updatedAt: item.updatedAt,
      });
    }
    if (item.type === 'ISSUE') {
      vscodeApi.postMessage({
        type: 'fetchLinkedPRs',
        itemId: item.id,
        owner: item.repositoryOwner,
        repo: item.repository,
        issueNumber: item.number,
      });
    }
    // Phase 1: fetch changed files for PRs
    if (item.type === 'PULL_REQUEST') {
      const prKey = `${item.repositoryOwner}/${item.repository}#${item.number}`;
      vscodeApi.postMessage({
        type: 'fetchPRFiles',
        prKey,
        owner: item.repositoryOwner,
        repo: item.repository,
        prNumber: item.number,
      });
      // v2: fetch CODEOWNERS if not already cached
      vscodeApi.postMessage({
        type: 'fetchCodeowners',
        owner: item.repositoryOwner,
        repo: item.repository,
      });
    }
  }, []);

  // When a board refresh drops a stale body (updatedAt changed), re-fetch it.
  // Skips if handleSelectItem already issued the same request.
  useEffect(() => {
    if (!detailItem || detailItem.body !== undefined) return;
    const key = `${detailItem.id}:${detailItem.updatedAt}`;
    if (lastBodyFetchKey.current === key) return;
    const cached = itemBodyCache.current.get(key);
    if (cached !== undefined) {
      setDetailItem((prev) =>
        prev?.id === detailItem.id && prev.updatedAt === detailItem.updatedAt
          ? { ...prev, body: cached }
          : prev
      );
      return;
    }
    lastBodyFetchKey.current = key;
    vscodeApi.postMessage({
      type: 'fetchBody',
      itemId: detailItem.id,
      owner: detailItem.repositoryOwner,
      repo: detailItem.repository,
      number: detailItem.number,
      isIssue: detailItem.type === 'ISSUE',
      updatedAt: detailItem.updatedAt,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailItem?.id, detailItem?.updatedAt, detailItem?.body]);

  // Phase 1: open PR file in editor
  const handleOpenPRFile = useCallback((owner: string, repo: string, prNumber: number, filename: string, patch?: string) => {
    vscodeApi.postMessage({ type: 'openPRFile', owner, repo, prNumber, filename, patch });
  }, []);

  // Phase 1: work on this branch
  const handleWorkOnThis = useCallback((branchName: string, owner: string, repo: string) => {
    vscodeApi.postMessage({ type: 'workOnThis', branchName, owner, repo });
  }, []);

  // Phase 3: generate standup
  const handleGenerateStandup = useCallback(() => {
    if (!data?.viewerLogin) return;
    setStandupLoading(true);
    setStandupData(null);
    setStandupMarkdown(null);
    setStandupView('view');
    vscodeApi.postMessage({ type: 'generateStandup', viewerLogin: data.viewerLogin });
  }, [data?.viewerLogin]);

  // Phase 3: metadata update
  const handleUpdateMetadata = useCallback((itemId: string, owner: string, repo: string, issueNumber: number, labels?: string[], assignees?: string[]) => {
    vscodeApi.postMessage({ type: 'updateMetadata', itemId, owner, repo, issueNumber, labels, assignees });
  }, []);

  // Phase 3: fetch repo labels
  const handleFetchRepoLabels = useCallback((owner: string, repo: string) => {
    vscodeApi.postMessage({ type: 'fetchRepoLabels', owner, repo });
  }, []);

  // Tracks in-flight label fetches to avoid duplicate requests when the board
  // refreshes before a pending response lands (cleared when the response arrives).
  const labelsInFlight = React.useRef<Set<string>>(new Set());

  // §1.8: Preload labels for all repos visible on the board after each data load.
  // Fires in parallel for repos not yet in the cache so the label editor opens instantly.
  useEffect(() => {
    if (!data) return;
    const allItems = [...Object.values(data.groups).flat(), ...(data.linkedIssuePRs ?? [])];
    const seen = new Set<string>();
    for (const item of allItems) {
      if (!item.repositoryOwner || !item.repository) continue;
      const key = `${item.repositoryOwner}/${item.repository}`;
      if (seen.has(key) || repoLabelsCache.has(key) || labelsInFlight.current.has(key)) continue;
      seen.add(key);
      labelsInFlight.current.add(key);
      vscodeApi.postMessage({ type: 'fetchRepoLabels', owner: item.repositoryOwner, repo: item.repository });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // v2: convert draft to ready
  const handleConvertDraftToReady = useCallback((itemId: string, owner: string, repo: string, prNumber: number) => {
    vscodeApi.postMessage({ type: 'convertDraftToReady', itemId, owner, repo, prNumber });
  }, []);

  // v2: merge PR
  const handleMergePR = useCallback((itemId: string, owner: string, repo: string, prNumber: number, mergeMethod: 'merge' | 'squash' | 'rebase') => {
    vscodeApi.postMessage({ type: 'mergePR', itemId, owner, repo, prNumber, mergeMethod });
  }, []);

  const formatLastUpdated = (iso: string) => {
    const d = new Date(iso);
    return `Last refreshed at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <>
      {/* SVG glass refraction filter — referenced via CSS filter: url(#glass-distort) */}
      <svg className="glass-filter-svg" aria-hidden="true">
        <defs>
          {/*
            Very-low-frequency fractal noise creates a smooth, organic lens distortion.
            scale=4 means ≤4px displacement — wave colours behind glass appear refracted,
            text at 12-13px is imperceptibly shifted (<1px typical).
          */}
          <filter id="glass-distort" x="-8%" y="-8%" width="116%" height="116%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.003 0.002" numOctaves="2" seed="42" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="18" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      {/* macOS-style smooth wave background */}
      {config?.liquidGlass && (
        <svg
          className="wave-bg-svg"
          aria-hidden="true"
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <filter id="wave-blur" x="-10%" y="-50%" width="120%" height="200%">
              <feGaussianBlur stdDeviation="22"/>
            </filter>
            <linearGradient id="wg-blue" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="#89b4fa" stopOpacity="0"/>
              <stop offset="18%"  stopColor="#89b4fa" stopOpacity="0.55"/>
              <stop offset="55%"  stopColor="#74a8ff" stopOpacity="0.50"/>
              <stop offset="82%"  stopColor="#89b4fa" stopOpacity="0.45"/>
              <stop offset="100%" stopColor="#89b4fa" stopOpacity="0"/>
            </linearGradient>
            <linearGradient id="wg-purple" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="#cba6f7" stopOpacity="0"/>
              <stop offset="22%"  stopColor="#cba6f7" stopOpacity="0.48"/>
              <stop offset="60%"  stopColor="#b48ef4" stopOpacity="0.42"/>
              <stop offset="85%"  stopColor="#cba6f7" stopOpacity="0.38"/>
              <stop offset="100%" stopColor="#cba6f7" stopOpacity="0"/>
            </linearGradient>
            <linearGradient id="wg-teal" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="#74c7ec" stopOpacity="0"/>
              <stop offset="28%"  stopColor="#74c7ec" stopOpacity="0.42"/>
              <stop offset="65%"  stopColor="#67d3f5" stopOpacity="0.36"/>
              <stop offset="100%" stopColor="#74c7ec" stopOpacity="0"/>
            </linearGradient>
          </defs>
          {/* Wave 1 — blue, sweeps from lower-left to upper-right */}
          <path
            className="wave-p1"
            d="M -100,650 C 260,490 540,310 860,278 C 1180,246 1390,368 1600,298 L 1600,520 C 1390,578 1180,456 860,488 C 540,520 260,678 -100,838 Z"
            fill="url(#wg-blue)"
            filter="url(#wave-blur)"
          />
          {/* Wave 2 — purple, upper sweep */}
          <path
            className="wave-p2"
            d="M -100,55 C 310,15 620,128 950,88 C 1280,48 1440,158 1600,108 L 1600,308 C 1440,358 1280,248 950,288 C 620,328 310,215 -100,255 Z"
            fill="url(#wg-purple)"
            filter="url(#wave-blur)"
          />
          {/* Wave 3 — teal, lower sweep */}
          <path
            className="wave-p3"
            d="M -100,788 C 360,748 660,685 988,725 C 1316,765 1480,832 1600,800 L 1600,920 C 1480,948 1316,898 988,868 C 660,838 360,900 -100,940 Z"
            fill="url(#wg-teal)"
            filter="url(#wave-blur)"
          />
        </svg>
      )}

      {/* Header */}
      <div className="header">
        <div className="header-left">
          {/* Rocket icon */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: '#89b4fa' }}>
            <path d="M12 2C12 2 7 6 7 12C7 14.76 8.12 17.27 10 19L12 22L14 19C15.88 17.27 17 14.76 17 12C17 6 12 2 12 2Z" fill="currentColor" opacity="0.9"/>
            <circle cx="12" cy="12" r="2" fill="#13131c"/>
            <path d="M9 19L7 21L5 19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M15 19L17 21L19 19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span className="header-title">
            SprintHub
            {data?.projectTitle && (
              <span className="project-name">· {data.projectTitle}</span>
            )}
          </span>
        </div>
        <div className="header-right">
          {data && <span className="total-badge">{data.totalCount} items</span>}
          {/* Phase 3: Standup Generator */}
          {data && (
            <button
              className={`btn${standupLoading ? ' loading' : ''}`}
              onClick={handleGenerateStandup}
              disabled={standupLoading}
              title="Generate daily standup"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
              Standup
            </button>
          )}
          {/* Settings button */}
          <button className="btn" onClick={() => setSettingsOpen(true)} title="Project settings">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
          <button className={`btn${isRefreshing ? ' loading' : ''}`} onClick={handleRefresh}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Toolbar / tabs */}
      <div className="toolbar">
        {(['dashboard', 'all', 'prs', 'issues', 'milestones'] as FilterTab[]).map((t) => {
          const labels: Record<FilterTab, string> = { dashboard: '🚀 Dashboard', all: 'Main Board', prs: 'Pull Requests', issues: 'Issues', milestones: 'Milestones' };
          const tabCounts: Record<FilterTab, number> = {
            dashboard: counts.prs,
            all: counts.all,
            prs: counts.prs,
            issues: counts.issues,
            milestones: data ? Object.keys(milestoneGroups).length : 0,
          };
          return (
            <button
              key={t}
              className={`tab-btn${tab === t ? ' active' : ''}`}
              onClick={() => setTab(t)}
            >
              {labels[t]}
              {t !== 'dashboard' && <span className="tab-count">{tabCounts[t]}</span>}
            </button>
          );
        })}
      </div>

      {/* Phase 2: Conflict Threats Banner */}
      {conflictThreats.length > 0 && (
        <div className="conflict-banner">
          <svg className="conflict-banner-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <div className="conflict-banner-body">
            <div className="conflict-banner-title">
              {conflictThreats.length} file conflict{conflictThreats.length > 1 ? 's' : ''} detected with open PRs
            </div>
            <div className="conflict-banner-items">
              {conflictThreats.slice(0, 3).map((t, i) => (
                <div key={i} className="conflict-banner-item">
                  <strong>{t.filename}</strong> — also modified in PR #{t.prNumber} by {t.prAuthor}
                </div>
              ))}
              {conflictThreats.length > 3 && (
                <div className="conflict-banner-item">…and {conflictThreats.length - 3} more</div>
              )}
            </div>
          </div>
          <button className="conflict-banner-dismiss" onClick={() => setConflictThreats([])} title="Dismiss">×</button>
        </div>
      )}

      {/* Sprint filter dropdown */}
      {data && data.sprints.length > 0 && (
        <div className="sprint-bar">
          <span className="sprint-label">Sprint</span>
          <select
            className="sprint-select"
            value={sprintFilter ?? ''}
            onChange={(e) => setSprintFilter(e.target.value || null)}
          >
            <option value="">All sprints</option>
            {data.sprints.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {sprintFilter && (
            <span className="sprint-active-badge">
              {sprintFilter}
              <button className="sprint-clear-btn" onClick={() => setSprintFilter(null)} title="Clear sprint filter">✕</button>
            </span>
          )}
        </div>
      )}

      {/* Search */}
      <div className="search-wrap">
        <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          ref={searchInputRef}
          className="search-input"
          placeholder={tab === 'milestones' ? 'Search milestones and items…' : 'Search by title, number, author, label, branch, sprint…'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Content */}
      <div className="content">
        {state === 'loading' && (
          <div className="skeleton-board">
            <div className="skeleton-group">
              <div className="skeleton-col-header" />
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton-row" style={{ opacity: 1 - i * 0.12 }}>
                  <div className="skeleton-pulse sk-age" style={{ animationDelay: `${i * 0.08}s` }} />
                  <div className="skeleton-pulse sk-dots" style={{ animationDelay: `${i * 0.08 + 0.1}s` }} />
                  <div className="skeleton-pulse sk-title" style={{ width: `${55 + (i * 17) % 35}%`, animationDelay: `${i * 0.08 + 0.2}s` }} />
                  <div className="skeleton-pulse sk-diff" style={{ animationDelay: `${i * 0.08 + 0.3}s` }} />
                  <div className="skeleton-pulse sk-avatar" style={{ animationDelay: `${i * 0.08 + 0.4}s` }} />
                  <div className="skeleton-pulse sk-avatar2" style={{ animationDelay: `${i * 0.08 + 0.5}s` }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {state === 'error' && (
          <div className="center-state">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f38ba8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span className="state-title state-err">Failed to load</span>
            <span className="state-sub">{errorMsg}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={() => setSettingsOpen(true)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
                Open Settings
              </button>
              <button className="btn" onClick={handleRefresh}>Try again</button>
            </div>
          </div>
        )}

        {state === 'data' && data && (
          <>
            {tab === 'dashboard' ? (
              /* Dashboard view — PRs grouped by action needed */
              <LaunchpadView
                items={data.columns.flatMap((c) => filteredGroups[c] ?? [])}
                linkedIssuePRs={filteredLinkedIssuePRs}
                viewerLogin={data.viewerLogin ?? ''}
                onSelect={handleSelectItem}
                onOpenUrl={handleOpenUrl}
              />
            ) : (
              /* Main Board / PRs / Issues / Milestones — uniform layout matching Dashboard */
              <div className="lp-wrap">
                <div className="lp-toolbar">
                  <span className="lp-count">
                    {tab === 'milestones'
                      ? `${Object.keys(milestoneGroups).length} milestone${Object.keys(milestoneGroups).length !== 1 ? 's' : ''}`
                      : tab === 'prs'
                      ? `${counts.prs} pull request${counts.prs !== 1 ? 's' : ''}`
                      : tab === 'issues'
                      ? `${counts.issues} issue${counts.issues !== 1 ? 's' : ''}`
                      : `${counts.all} item${counts.all !== 1 ? 's' : ''}`}
                  </span>
                </div>
                <div className="lp-header-row">
                  <span className="lp-col-age">Age</span>
                  <span className="lp-col-status">Status</span>
                  <span className="lp-col-title">Item</span>
                  <span className="lp-col-diff">Diff</span>
                  <span className="lp-col-author">Auth</span>
                  <span className="lp-col-collabs">Collaborators</span>
                  <span className="lp-col-branch">Repo / Branch</span>
                </div>
                {tab === 'milestones' ? (
                  Object.keys(milestoneGroups).length === 0 ? (
                    <div className="milestone-empty">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#45475a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 4l3 3-3 3"/><path d="M3 7h18"/>
                        <path d="M6 20l-3-3 3-3"/><path d="M21 17H3"/>
                      </svg>
                      No milestones found
                    </div>
                  ) : (
                    Object.entries(milestoneGroups)
                      .sort(([a], [b]) => {
                        if (a === '(No Milestone)') return -1;
                        if (b === '(No Milestone)') return 1;
                        const parts = (s: string) => s.split('.').map((n) => parseInt(n, 10) || 0);
                        const ap = parts(a), bp = parts(b);
                        for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
                          const diff = (bp[i] ?? 0) - (ap[i] ?? 0);
                          if (diff !== 0) return diff;
                        }
                        return 0;
                      })
                      .map(([milestone, items]) => (
                        <ColumnGroup
                          key={milestone}
                          column={milestone}
                          items={items}
                          config={{ color: '#cba6f7', emoji: '⬡' }}
                          onSelect={handleSelectItem}
                          onOpenUrl={handleOpenUrl}
                        />
                      ))
                  )
                ) : (
                  data.columns.map((col) => {
                    const items = filteredGroups[col] ?? [];
                    return (
                      <ColumnGroup
                        key={col}
                        column={col}
                        items={items}
                        config={getColumnConfig(col)}
                        onSelect={handleSelectItem}
                        onOpenUrl={handleOpenUrl}
                      />
                    );
                  })
                )}
              </div>
            )}
            {isLoadingMore && (
              <div className="skeleton-loading-more">
                {[0, 1].map((gi) => (
                  <div key={gi} className="skeleton-group">
                    <div className="skeleton-col-header" />
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="skeleton-row" style={{ opacity: 1 - (gi * 3 + i) * 0.09 }}>
                        <div className="skeleton-pulse sk-age"     style={{ animationDelay: `${(gi * 3 + i) * 0.09}s` }} />
                        <div className="skeleton-pulse sk-dots"    style={{ animationDelay: `${(gi * 3 + i) * 0.09 + 0.10}s` }} />
                        <div className="skeleton-pulse sk-title"   style={{ width: `${[68, 55, 78, 62, 72, 50][gi * 3 + i]}%`, animationDelay: `${(gi * 3 + i) * 0.09 + 0.20}s` }} />
                        <div className="skeleton-pulse sk-diff"    style={{ animationDelay: `${(gi * 3 + i) * 0.09 + 0.30}s` }} />
                        <div className="skeleton-pulse sk-avatar"  style={{ animationDelay: `${(gi * 3 + i) * 0.09 + 0.40}s` }} />
                        <div className="skeleton-pulse sk-avatar2" style={{ animationDelay: `${(gi * 3 + i) * 0.09 + 0.50}s` }} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      {data && (
        <div className="footer">
          {formatLastUpdated(data.lastUpdated)}
          {isLoadingMore && <span className="footer-updating">· updating</span>}
          {!isLoadingMore && isProcessing && <span className="footer-updating">· processing</span>}
          {sprintFilter && <span style={{ marginLeft: 8, color: '#89b4fa' }}>· Sprint: {sprintFilter}</span>}
          {data.rateLimit && (() => {
            const { remaining, limit, resetAt } = data.rateLimit;
            const color = remaining < 5 ? '#f38ba8' : remaining < 20 ? '#f9e2af' : '#6c7086';
            const resetTime = new Date(resetAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return (
              <span
                className="rate-limit-badge"
                style={{ color }}
                title={`GitHub API quota — resets at ${resetTime}`}
              >
                · API {remaining}/{limit}
              </span>
            );
          })()}
        </div>
      )}

      {/* Detail panel */}
      {detailItem && (
        <DetailPanel
          item={detailItem}
          linkedPRs={linkedPRs}
          prFiles={prFiles}
          repoLabels={repoLabelsCache.get(`${detailItem.repositoryOwner}/${detailItem.repository}`) ?? []}
          codeownersEntries={codeownersCache.get(`${detailItem.repositoryOwner}/${detailItem.repository}`) ?? []}
          onClose={() => { setDetailItem(null); setLinkedPRs(null); setPrFiles(null); }}
          actions={{
            onOpenUrl: handleOpenUrl,
            onWorkOnThis: handleWorkOnThis,
            onOpenPRFile: handleOpenPRFile,
            onUpdateMetadata: handleUpdateMetadata,
            onFetchRepoLabels: handleFetchRepoLabels,
            onConvertDraftToReady: handleConvertDraftToReady,
            onMergePR: handleMergePR,
          }}
        />
      )}

      {/* Phase 3: Standup modal */}
      {(standupLoading || standupData !== null || standupMarkdown !== null) && (
        <div className="standup-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setStandupData(null); setStandupMarkdown(null); setStandupLoading(false); } }}>
          <div className="standup-modal">
            <div className="standup-header">
              <span className="standup-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                Daily Standup
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* View toggle — only shown when content is ready */}
                {standupData && (
                  <div className="standup-view-toggle">
                    <button
                      className={`standup-view-btn${standupView === 'view' ? ' active' : ''}`}
                      onClick={() => setStandupView('view')}
                    >
                      View
                    </button>
                    <button
                      className={`standup-view-btn${standupView === 'markdown' ? ' active' : ''}`}
                      onClick={() => setStandupView('markdown')}
                    >
                      Markdown
                    </button>
                  </div>
                )}
                <button className="detail-close-btn" onClick={() => { setStandupData(null); setStandupMarkdown(null); setStandupLoading(false); }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>
            <div className="standup-body">
              {standupLoading && !standupMarkdown && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6c7086', fontSize: 12 }}>
                  <div style={{ width: 12, height: 12, border: '2px solid #45475a', borderTopColor: '#89b4fa', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
                  Fetching your GitHub activity…
                </div>
              )}
              {standupData && standupView === 'view' && <StandupView data={standupData} onOpenUrl={handleOpenUrl} />}
              {standupMarkdown && standupView === 'markdown' && <pre className="standup-md">{standupMarkdown}</pre>}
            </div>
            {standupData && (
              <div className="standup-footer">
                <button className="btn" onClick={() => { setStandupData(null); setStandupMarkdown(null); setStandupLoading(false); }}>Close</button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    navigator.clipboard?.writeText(standupMarkdown!).catch(() => undefined);
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  Copy Markdown
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Settings panel */}
      {settingsOpen && (
        <SettingsPanel
          config={config ?? { owner: '', projectNumber: 0, ownerType: 'organization', statusFieldName: 'Status', refreshInterval: 5, liquidGlass: true, theme: 'dark', colorBlind: false }}
          onSave={handleSaveConfig}
          onClose={() => { setSettingsOpen(false); setSettingsOwners(null); setSettingsProjects(null); }}
          owners={settingsOwners}
          projects={settingsProjects}
          onFetchOwners={() => vscodeApi.postMessage({ type: 'fetchSettingsOwners' })}
          onFetchProjects={(owner, ownerType) => { setSettingsProjects(null); vscodeApi.postMessage({ type: 'fetchSettingsProjects', owner, ownerType }); }}
        />
      )}
    </>
  );
}
