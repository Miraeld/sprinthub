export interface GHUser {
  login: string;
  avatarUrl: string;
}

export interface GHLabel {
  name: string;
  color: string; // hex without #
}

export interface GHMilestone {
  title: string;
  number: number;
  dueOn?: string | null;
}

export type CIState = 'SUCCESS' | 'FAILURE' | 'PENDING' | 'ERROR' | 'EXPECTED' | 'none';
export type ReviewState = 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING';

export interface CheckRun {
  name: string;
  status: string; // QUEUED | IN_PROGRESS | COMPLETED | WAITING | REQUESTED | PENDING
  conclusion: string | null; // SUCCESS | FAILURE | NEUTRAL | CANCELLED | SKIPPED | TIMED_OUT | ACTION_REQUIRED
  detailsUrl?: string;
}

export interface LinkedPR {
  number: number;
  title: string;
  url: string;
  state: string;
  isDraft: boolean;
  headRefName: string;
  ciState: CIState;
  checkRuns: CheckRun[];
}

export interface ReviewInfo {
  state: ReviewState;
  author: GHUser;
}

export interface BoardItem {
  id: string;
  number: number;
  title: string;
  body?: string;
  type: 'ISSUE' | 'PULL_REQUEST';
  url: string;
  column: string;
  state: string; // OPEN, CLOSED, MERGED
  author: GHUser;
  assignees: GHUser[];
  labels: GHLabel[];
  repository: string;
  repositoryOwner: string;
  createdAt: string;
  updatedAt: string;
  milestone?: GHMilestone;
  sprint?: string;
  sprintField?: string; // which iteration field the sprint came from
  // PR-only
  isDraft?: boolean;
  additions?: number;
  deletions?: number;
  headRefName?: string;
  ciState?: CIState;
  reviews?: ReviewInfo[];
  reviewRequests?: GHUser[];
  closingIssueNumbers?: number[]; // issue numbers this PR closes
}

export interface RateLimit {
  remaining: number;
  limit: number;
  resetAt: string; // ISO timestamp
}

export interface RunwayData {
  projectTitle: string;
  columns: string[];
  groups: Record<string, BoardItem[]>;
  sprints: string[];
  lastUpdated: string;
  totalCount: number;
  viewerLogin: string;
  /** Open PRs linked to board issues via closingPullRequests (Closes #N syntax) */
  linkedIssuePRs: BoardItem[];
  rateLimit?: RateLimit;
}

export interface RunwayConfig {
  owner: string;
  projectNumber: number;
  ownerType: 'organization' | 'user';
  statusFieldName: string;
  refreshInterval: number;
  liquidGlass: boolean;
  theme: 'dark' | 'light';
  colorBlind: boolean;
}

// Phase 1 — File-level deep linking
export interface PRFile {
  filename: string;
  patch?: string;
  additions: number;
  deletions: number;
  status: string; // added | modified | removed | renamed | copied
}

// Phase 2 — Hotspot conflict detection
export interface ConflictThreat {
  filename: string;
  prNumber: number;
  prTitle: string;
  prAuthor: string;
  prUrl: string;
}

// Phase 3 — Available repo labels for metadata editor
export interface RepoLabel {
  name: string;
  color: string;
}

// Phase 3 — Structured standup data
export interface StandupItem {
  number: number;
  title: string;
  url: string;
  isPR: boolean;
}

export interface StandupRepoGroup {
  repo: string; // "owner/repo"
  items: StandupItem[];
}

export interface StandupSection {
  key: string;
  icon: string;
  title: string;
  groups: StandupRepoGroup[];
}

export interface StandupData {
  date: string;
  sections: StandupSection[];
  error?: string;
}

// Messages: extension → webview
export type ExtensionMessage =
  | { type: 'loading' }
  | { type: 'refreshing' }
  | { type: 'dataComplete' }
  | { type: 'data'; payload: RunwayData }
  | { type: 'error'; message: string }
  | { type: 'config'; payload: RunwayConfig }
  | { type: 'linkedPRs'; itemId: string; prs: LinkedPR[] }
  | { type: 'itemBody'; itemId: string; body: string | null; updatedAt: string }
  // Phase 1
  | { type: 'prFiles'; prKey: string; files: PRFile[] }
  // Phase 2
  | { type: 'conflictThreats'; threats: ConflictThreat[] }
  | { type: 'linkedIssuePRs'; prs: BoardItem[] }
  // Phase 3
  | { type: 'standup'; data: StandupData; markdown: string }
  | { type: 'metadataUpdated'; itemId: string; labels: GHLabel[]; assignees: GHUser[] }
  | { type: 'repoLabels'; owner: string; repo: string; labels: GHLabel[] }
  // v2 extras
  | { type: 'prReadied'; itemId: string }
  | { type: 'prMerged'; itemId: string }
  | { type: 'codeowners'; owner: string; repo: string; entries: Array<{ pattern: string; owners: string[] }> }
  // Settings pickers
  | { type: 'settingsOwners'; owners: Array<{ login: string; ownerType: 'organization' | 'user' }> }
  | { type: 'settingsProjects'; projects: Array<{ number: number; title: string }> };

// Messages: webview → extension
export type WebviewMessage =
  | { type: 'refresh' }
  | { type: 'openUrl'; url: string }
  | { type: 'getConfig' }
  | { type: 'updateConfig'; payload: RunwayConfig }
  | { type: 'fetchLinkedPRs'; itemId: string; owner: string; repo: string; issueNumber: number }
  | { type: 'fetchBody'; itemId: string; owner: string; repo: string; number: number; isIssue: boolean; updatedAt: string }
  // Phase 1
  | { type: 'workOnThis'; branchName: string; owner: string; repo: string }
  | { type: 'fetchPRFiles'; prKey: string; owner: string; repo: string; prNumber: number }
  | { type: 'openPRFile'; owner: string; repo: string; prNumber: number; filename: string; patch?: string }
  // Phase 3
  | { type: 'generateStandup'; viewerLogin: string }
  | { type: 'updateMetadata'; itemId: string; owner: string; repo: string; issueNumber: number; labels?: string[]; assignees?: string[] }
  | { type: 'fetchRepoLabels'; owner: string; repo: string }
  // v2 extras
  | { type: 'convertDraftToReady'; itemId: string; owner: string; repo: string; prNumber: number }
  | { type: 'mergePR'; itemId: string; owner: string; repo: string; prNumber: number; mergeMethod: 'merge' | 'squash' | 'rebase' }
  | { type: 'fetchCodeowners'; owner: string; repo: string }
  // Settings pickers
  | { type: 'fetchSettingsOwners' }
  | { type: 'fetchSettingsProjects'; owner: string; ownerType: 'organization' | 'user' };
