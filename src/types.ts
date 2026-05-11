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

// Messages: extension → webview
export type ExtensionMessage =
  | { type: 'loading' }
  | { type: 'data'; payload: RunwayData }
  | { type: 'error'; message: string }
  | { type: 'config'; payload: RunwayConfig }
  | { type: 'linkedPRs'; itemId: string; prs: LinkedPR[] }
  | { type: 'itemBody'; itemId: string; body: string };

// Messages: webview → extension
export type WebviewMessage =
  | { type: 'refresh' }
  | { type: 'openUrl'; url: string }
  | { type: 'getConfig' }
  | { type: 'updateConfig'; payload: RunwayConfig }
  | { type: 'fetchLinkedPRs'; itemId: string; owner: string; repo: string; issueNumber: number }
  | { type: 'fetchBody'; itemId: string; owner: string; repo: string; number: number; isIssue: boolean };
