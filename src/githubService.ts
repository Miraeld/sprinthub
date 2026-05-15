import * as vscode from 'vscode';
import { BoardItem, CheckRun, CIState, GHLabel, GHUser, LinkedPR, PRFile, RateLimit, RunwayData, ReviewInfo, StandupData, StandupRepoGroup, StandupSection } from './types';

const GH_GRAPHQL = 'https://api.github.com/graphql';

// The ordered column list
const COLUMN_ORDER = [
  'Needs Grooming',
  'Grooming in Progress',
  'Grooming to Review',
  'TODO',
  'In Progress',
  'Ready For Review',
  'Ready For QA',
  'QA Done',
  'Done',
  'Blocked',
];

async function getToken(): Promise<string> {
  const session = await vscode.authentication.getSession(
    'github',
    ['repo', 'read:org', 'read:user', 'project'],
    { createIfNone: true }
  );
  return session.accessToken;
}

async function graphql<T>(token: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const resp = await fetch(GH_GRAPHQL, {
    method: 'POST',
    headers: {
      Authorization: `bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!resp.ok) {
    throw new Error(`GitHub API HTTP ${resp.status}: ${resp.statusText}`);
  }

  const json = (await resp.json()) as { data?: T; errors?: { message: string }[] };

  if (json.errors?.length) {
    throw new Error(`GitHub GraphQL: ${json.errors.map((e) => e.message).join(', ')}`);
  }

  if (!json.data) {
    throw new Error('GitHub GraphQL: no data returned');
  }

  return json.data;
}

// Query to fetch open PRs from a repo, with their closing issue references
// Used to find PRs that fix board issues but aren't directly tracked on the board
const REPO_OPEN_PRS_QUERY = `
query GetRepoOpenPRs($owner: String!, $repo: String!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    pullRequests(states: OPEN, first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number title url state isDraft createdAt updatedAt
        additions deletions headRefName
        author { login avatarUrl }
        assignees(first: 10) { nodes { login avatarUrl } }
        repository { name owner { login } }
        commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
        reviews(last: 5) { nodes { state author { login avatarUrl } } }
        reviewRequests(first: 10) { nodes { requestedReviewer { ... on User { login avatarUrl } } } }
        closingIssuesReferences(first: 20) { nodes { number } }
      }
    }
  }
}
`;

// The big GraphQL query - works for both org and user
// Note: body is NOT fetched here (too large) — loaded on demand via fetchItemBody
const PROJECT_ITEMS_QUERY = `
query GetProjectItems($login: String!, $number: Int!, $isOrg: Boolean!, $cursor: String) {
  rateLimit { remaining limit resetAt }
  viewer { login }
  org: organization(login: $login) @include(if: $isOrg) {
    projectV2(number: $number) {
      title
      items(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          type
          fieldValues(first: 20) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field { ... on ProjectV2SingleSelectField { name } }
              }
              ... on ProjectV2ItemFieldIterationValue {
                title
                field { ... on ProjectV2IterationField { name } }
              }
            }
          }
          content {
            ... on Issue {
              __typename
              number title url state createdAt updatedAt
              author { login avatarUrl }
              assignees(first: 10) { nodes { login avatarUrl } }
              labels(first: 10) { nodes { name color } }
              milestone { title number dueOn }
              repository { name owner { login } }
            }
            ... on PullRequest {
              __typename
              number title url state isDraft createdAt updatedAt
              additions deletions headRefName
              author { login avatarUrl }
              assignees(first: 10) { nodes { login avatarUrl } }
              labels(first: 10) { nodes { name color } }
              milestone { title number dueOn }
              repository { name owner { login } }
              commits(last: 1) {
                nodes { commit { statusCheckRollup { state } } }
              }
              reviews(last: 5) {
                nodes { state author { login avatarUrl } }
              }
              reviewRequests(first: 10) {
                nodes { requestedReviewer { ... on User { login avatarUrl } } }
              }
              closingIssuesReferences(first: 10) {
                nodes { number }
              }
            }
          }
        }
      }
    }
  }
  user: user(login: $login) @skip(if: $isOrg) {
    projectV2(number: $number) {
      title
      items(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          type
          fieldValues(first: 20) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field { ... on ProjectV2SingleSelectField { name } }
              }
              ... on ProjectV2ItemFieldIterationValue {
                title
                field { ... on ProjectV2IterationField { name } }
              }
            }
          }
          content {
            ... on Issue {
              __typename
              number title url state createdAt updatedAt
              author { login avatarUrl }
              assignees(first: 10) { nodes { login avatarUrl } }
              labels(first: 10) { nodes { name color } }
              milestone { title number dueOn }
              repository { name owner { login } }
            }
            ... on PullRequest {
              __typename
              number title url state isDraft createdAt updatedAt
              additions deletions headRefName
              author { login avatarUrl }
              assignees(first: 10) { nodes { login avatarUrl } }
              labels(first: 10) { nodes { name color } }
              milestone { title number dueOn }
              repository { name owner { login } }
              commits(last: 1) {
                nodes { commit { statusCheckRollup { state } } }
              }
              reviews(last: 5) {
                nodes { state author { login avatarUrl } }
              }
              reviewRequests(first: 10) {
                nodes { requestedReviewer { ... on User { login avatarUrl } } }
              }
              closingIssuesReferences(first: 10) {
                nodes { number }
              }
            }
          }
        }
      }
    }
  }
}
`;

interface RawFieldValueNode {
  // Single select
  name?: string;
  field?: { name?: string };
  // Iteration
  title?: string;
}

interface RawProjectNode {
  id: string;
  type: string;
  fieldValues: {
    nodes: Array<RawFieldValueNode>;
  };
  content: RawIssue | RawPR | { __typename: string } | null;
}

interface RawMilestone {
  title: string;
  number: number;
  dueOn: string | null;
}

interface RawIssue {
  __typename: 'Issue';
  number: number;
  title: string;
  url: string;
  state: string;
  body: string | null;
  createdAt: string;
  updatedAt: string;
  author: GHUser | null;
  assignees: { nodes: GHUser[] } | null;
  labels: { nodes: GHLabel[] } | null;
  milestone: RawMilestone | null;
  repository: { name: string; owner: { login: string } } | null;
}

interface RawPR {
  __typename: 'PullRequest';
  number: number;
  title: string;
  url: string;
  state: string;
  isDraft: boolean;
  body: string | null;
  createdAt: string;
  updatedAt: string;
  additions: number;
  deletions: number;
  headRefName: string;
  author: GHUser | null;
  assignees: { nodes: GHUser[] } | null;
  labels: { nodes: GHLabel[] } | null;
  milestone: RawMilestone | null;
  repository: { name: string; owner: { login: string } } | null;
  commits: { nodes: Array<{ commit: { statusCheckRollup: { state: string } | null } }> } | null;
  reviews: { nodes: Array<{ state: string; author: GHUser }> } | null;
  reviewRequests: { nodes: Array<{ requestedReviewer: GHUser | null }> } | null;
  closingIssuesReferences: { nodes: Array<{ number: number }> } | null;
}

interface ProjectData {
  title: string;
  items: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: RawProjectNode[];
  };
}

function extractColumn(node: RawProjectNode, statusFieldName: string): string {
  const nodes = node.fieldValues?.nodes ?? [];
  for (const fv of nodes) {
    if (fv.field?.name === statusFieldName && fv.name) {
      return fv.name;
    }
  }
  return 'Uncategorized';
}

function extractSprint(node: RawProjectNode): { sprint: string; sprintField: string } | undefined {
  for (const fv of node.fieldValues?.nodes ?? []) {
    if (fv.title !== undefined && fv.field?.name) {
      return { sprint: fv.title, sprintField: fv.field.name };
    }
  }
  return undefined;
}

function extractLatestReviews(rawReviews: { nodes: Array<{ state: string; author: GHUser }> } | null | undefined): ReviewInfo[] {
  const byReviewer = new Map<string, ReviewInfo>();
  for (const r of rawReviews?.nodes ?? []) {
    if (r?.author) {
      byReviewer.set(r.author.login, { state: r.state as ReviewInfo['state'], author: r.author });
    }
  }
  return Array.from(byReviewer.values());
}

function parseItem(node: RawProjectNode, column: string): BoardItem | null {
  // Skip null content and Draft Issues (type: DraftIssue) — they lack standard fields
  if (!node.content || !('__typename' in node.content) || (node.content.__typename !== 'Issue' && node.content.__typename !== 'PullRequest')) {
    return null;
  }
  const c = node.content as RawIssue | RawPR;

  const base = {
    id: node.id,
    column,
    author: c.author ?? { login: 'unknown', avatarUrl: '' },
    assignees: c.assignees?.nodes ?? [],
    labels: c.labels?.nodes ?? [],
    repository: c.repository?.name ?? '',
    repositoryOwner: c.repository?.owner?.login ?? '',
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    body: undefined, // loaded on demand via fetchBody
    milestone: c.milestone
      ? { title: c.milestone.title, number: c.milestone.number, dueOn: c.milestone.dueOn }
      : undefined,
    ...(() => {
      const s = extractSprint(node);
      return s ? { sprint: s.sprint, sprintField: s.sprintField } : {};
    })(),
  };

  if (c.__typename === 'Issue') {
    return {
      ...base,
      number: c.number,
      title: c.title,
      type: 'ISSUE',
      url: c.url,
      state: c.state,
    };
  }

  if (c.__typename === 'PullRequest') {
    const pr = c as RawPR;
    const ciRaw = pr.commits?.nodes?.[0]?.commit?.statusCheckRollup?.state ?? 'none';
    return {
      ...base,
      number: pr.number,
      title: pr.title,
      type: 'PULL_REQUEST',
      url: pr.url,
      state: pr.state,
      isDraft: pr.isDraft,
      additions: pr.additions,
      deletions: pr.deletions,
      headRefName: pr.headRefName,
      ciState: ciRaw as CIState,
      reviews: extractLatestReviews(pr.reviews),
      reviewRequests: (pr.reviewRequests?.nodes ?? [])
        .map((r) => r.requestedReviewer)
        .filter((r): r is GHUser => r !== null),
      closingIssueNumbers: (pr.closingIssuesReferences?.nodes ?? []).map((n) => n.number),
    };
  }

  return null;
}

interface RawRepoPR {
  number: number;
  title: string;
  url: string;
  state: string;
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
  additions: number;
  deletions: number;
  headRefName: string;
  author: GHUser | null;
  assignees: { nodes: GHUser[] } | null;
  repository: { name: string; owner: { login: string } } | null;
  commits: { nodes: Array<{ commit: { statusCheckRollup: { state: string } | null } }> } | null;
  reviews: { nodes: Array<{ state: string; author: GHUser }> } | null;
  reviewRequests: { nodes: Array<{ requestedReviewer: GHUser | null }> } | null;
  closingIssuesReferences: { nodes: Array<{ number: number }> } | null;
}

/**
 * For each repo that has board issues, fetch all open PRs and return those
 * that close (via `Fixes #N`, `Closes #N`, etc.) a board issue.
 * The linked PR inherits the parent issue's column and sprint.
 */
async function fetchLinkedPRsFromRepos(
  token: string,
  issueByRepo: Map<string, Map<number, BoardItem>>,
  groups: Record<string, BoardItem[]>
): Promise<BoardItem[]> {
  const linkedPRMap = new Map<string, BoardItem>(); // `owner/repo#number` → BoardItem
  // Track PR numbers already on the board to avoid duplicates
  const boardPRKeys = new Set<string>();
  for (const items of Object.values(groups)) {
    for (const item of items) {
      if (item.type === 'PULL_REQUEST') {
        boardPRKeys.add(`${item.repositoryOwner}/${item.repository}#${item.number}`);
      }
    }
  }

  await Promise.all(
    Array.from(issueByRepo.entries()).map(async ([repoKey, issueMap]) => {
      const [repoOwner, repoName] = repoKey.split('/');
      let prCursor: string | null = null;

      do {
        let repoData: { repository: { pullRequests: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: RawRepoPR[] } } } | null = null;
        try {
          repoData = await graphql<{ repository: { pullRequests: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: RawRepoPR[] } } }>(
            token,
            REPO_OPEN_PRS_QUERY,
            { owner: repoOwner, repo: repoName, cursor: prCursor }
          );
        } catch {
          break; // skip repos we can't access
        }

        const prs = repoData?.repository?.pullRequests?.nodes ?? [];
        for (const rawPR of prs) {
          const prKey = `${repoOwner}/${repoName}#${rawPR.number}`;
          if (boardPRKeys.has(prKey) || linkedPRMap.has(prKey)) continue;

          // Check if this PR closes any of our board issues
          const closingNums = rawPR.closingIssuesReferences?.nodes?.map((n) => n.number) ?? [];
          const parentIssue = closingNums.map((n) => issueMap.get(n)).find((i) => i !== undefined);
          if (!parentIssue) continue;

          const ciRaw = rawPR.commits?.nodes?.[0]?.commit?.statusCheckRollup?.state ?? 'none';
          linkedPRMap.set(prKey, {
            id: `linked-${prKey}`,
            number: rawPR.number,
            title: rawPR.title,
            type: 'PULL_REQUEST',
            url: rawPR.url,
            column: parentIssue.column,
            state: rawPR.state,
            author: rawPR.author ?? { login: 'unknown', avatarUrl: '' },
            assignees: rawPR.assignees?.nodes ?? [],
            labels: parentIssue.labels,
            repository: repoName,
            repositoryOwner: repoOwner,
            createdAt: rawPR.createdAt,
            updatedAt: rawPR.updatedAt,
            isDraft: rawPR.isDraft,
            additions: rawPR.additions,
            deletions: rawPR.deletions,
            headRefName: rawPR.headRefName,
            ciState: ciRaw as CIState,
            reviews: extractLatestReviews(rawPR.reviews),
            reviewRequests: (rawPR.reviewRequests?.nodes ?? [])
              .map((r) => r.requestedReviewer)
              .filter((r): r is GHUser => r !== null),
            sprint: parentIssue.sprint,
            sprintField: parentIssue.sprintField,
          });
        }

        if (repoData?.repository?.pullRequests?.pageInfo?.hasNextPage) {
          prCursor = repoData.repository.pullRequests.pageInfo.endCursor;
        } else {
          prCursor = null;
        }
      } while (prCursor !== null);
    })
  );

  return Array.from(linkedPRMap.values());
}

export async function fetchProjectData(
  owner: string,
  projectNumber: number,
  isOrg: boolean,
  statusFieldName: string
): Promise<RunwayData> {
  const token = await getToken();
  const allNodes: RawProjectNode[] = [];
  let projectTitle = '';
  let viewerLogin = '';
  let cursor: string | null = null;

  type ProjectResponse = {
    rateLimit?: RateLimit;
    viewer: { login: string };
    org?: { projectV2: ProjectData };
    user?: { projectV2: ProjectData };
  };
  let lastRateLimit: RateLimit | undefined;

  do {
    const data: ProjectResponse = await graphql<ProjectResponse>(
      token,
      PROJECT_ITEMS_QUERY,
      { login: owner, number: projectNumber, isOrg, cursor }
    );

    if (data.rateLimit) lastRateLimit = data.rateLimit;
    if (!viewerLogin) viewerLogin = data.viewer?.login ?? '';

    const project: ProjectData | undefined = isOrg ? data.org?.projectV2 : data.user?.projectV2;
    if (!project) {
      throw new Error(`Project #${projectNumber} not found for ${owner}`);
    }

    projectTitle = project.title;
    allNodes.push(...project.items.nodes);

    if (project.items.pageInfo.hasNextPage) {
      cursor = project.items.pageInfo.endCursor;
    } else {
      cursor = null;
    }
  } while (cursor !== null);

  // Group items by column
  const groups: Record<string, BoardItem[]> = {};
  const sprintsSet = new Set<string>();

  for (const node of allNodes) {
    const column = extractColumn(node, statusFieldName);
    const item = parseItem(node, column);
    if (!item) continue;

    if (!groups[column]) {
      groups[column] = [];
    }
    groups[column].push(item);
    if (item.sprint) sprintsSet.add(item.sprint);
  }

  // Build ordered column list — case-insensitive so "Ready for review" matches "Ready For Review"
  const colOrderLower = COLUMN_ORDER.map((c) => c.toLowerCase());
  const knownPresent = Object.keys(groups)
    .filter((c) => colOrderLower.includes(c.toLowerCase()))
    .sort((a, b) => colOrderLower.indexOf(a.toLowerCase()) - colOrderLower.indexOf(b.toLowerCase()));
  const extras = Object.keys(groups).filter((c) => !colOrderLower.includes(c.toLowerCase()));
  const columns = [...knownPresent, ...extras];

  const totalCount = Object.values(groups).reduce((sum, items) => sum + items.length, 0);
  // Natural sort descending (Sprint 21 first, Sprint 1 last)
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  const sprints = Array.from(sprintsSet).sort((a, b) => collator.compare(b, a));

  // linkedIssuePRs are fetched separately via fetchLinkedPRsForBoard to avoid
  // blocking the initial board render
  return {
    projectTitle,
    columns,
    groups,
    sprints,
    lastUpdated: new Date().toISOString(),
    totalCount,
    viewerLogin,
    linkedIssuePRs: [],
    rateLimit: lastRateLimit,
  };
}

/**
 * Fetches linked PRs for a board after the initial data is already rendered.
 * Re-derives the issueByRepo index from the groups returned by fetchProjectData.
 */
export async function fetchLinkedPRsForBoard(groups: Record<string, BoardItem[]>): Promise<BoardItem[]> {
  const token = await getToken();
  const issueByRepo = new Map<string, Map<number, BoardItem>>();
  for (const items of Object.values(groups)) {
    for (const item of items) {
      if (item.type === 'ISSUE' && item.repositoryOwner && item.repository) {
        const repoKey = `${item.repositoryOwner}/${item.repository}`;
        if (!issueByRepo.has(repoKey)) issueByRepo.set(repoKey, new Map());
        issueByRepo.get(repoKey)!.set(item.number, item);
      }
    }
  }
  if (!issueByRepo.size) return [];
  return fetchLinkedPRsFromRepos(token, issueByRepo, groups);
}

// Step 1: get linked PRs via closing references + timeline cross-references
const LINKED_PRS_QUERY = `
query GetLinkedPRs($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $number) {
      closingPullRequests(first: 10) {
        nodes {
          number title url state isDraft headRefName
          commits(last: 1) { nodes { commit { oid } } }
        }
      }
      timelineItems(first: 25, itemTypes: [CROSS_REFERENCED_EVENT]) {
        nodes {
          ... on CrossReferencedEvent {
            source {
              ... on PullRequest {
                number title url state isDraft headRefName
                commits(last: 1) { nodes { commit { oid } } }
              }
            }
          }
        }
      }
    }
  }
}
`;

interface RawLinkedPR {
  number: number;
  title: string;
  url: string;
  state: string;
  isDraft: boolean;
  headRefName: string;
  commits: { nodes: Array<{ commit: { oid: string } }> } | null;
}

interface RawCheckRunResponse {
  check_runs: Array<{
    name: string;
    status: string;
    conclusion: string | null;
    details_url: string | null;
    html_url: string;
  }>;
  total_count: number;
}

async function fetchCheckRunsForCommit(token: string, owner: string, repo: string, sha: string): Promise<CheckRun[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits/${sha}/check-runs?per_page=50`;
  const resp = await fetch(url, {
    headers: {
      Authorization: `bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!resp.ok) return [];
  const json = (await resp.json()) as RawCheckRunResponse;
  return (json.check_runs ?? []).map((r) => ({
    name: r.name,
    status: r.status.toUpperCase(),
    conclusion: r.conclusion ? r.conclusion.toUpperCase() : null,
    detailsUrl: r.details_url ?? r.html_url,
  }));
}

export async function fetchLinkedPRChecks(
  owner: string,
  repo: string,
  issueNumber: number
): Promise<LinkedPR[]> {
  const token = await getToken();
  const data = await graphql<{
    repository: {
      issue: {
        closingPullRequests: { nodes: RawLinkedPR[] };
        timelineItems: { nodes: Array<{ source?: RawLinkedPR }> };
      } | null;
    } | null;
  }>(token, LINKED_PRS_QUERY, { owner, repo, number: issueNumber });

  // Merge closing PRs + timeline cross-references, deduplicate by number
  const closing = data.repository?.issue?.closingPullRequests?.nodes ?? [];
  const crossRefs = (data.repository?.issue?.timelineItems?.nodes ?? [])
    .map((n) => n.source)
    .filter((s): s is RawLinkedPR => !!s && 'number' in s);

  const seen = new Set<number>();
  const merged: RawLinkedPR[] = [];
  for (const pr of [...closing, ...crossRefs]) {
    if (!seen.has(pr.number)) {
      seen.add(pr.number);
      merged.push(pr);
    }
  }

  if (!merged.length) return [];

  // Fetch check runs for each PR in parallel
  const results = await Promise.all(
    merged.map(async (pr): Promise<LinkedPR> => {
      const sha = pr.commits?.nodes?.[0]?.commit?.oid;
      const checkRuns = sha ? await fetchCheckRunsForCommit(token, owner, repo, sha) : [];

      // Derive overall CI state from check runs
      let ciState: CIState = 'none';
      if (checkRuns.length) {
        if (checkRuns.some((r) => r.status !== 'COMPLETED')) ciState = 'PENDING';
        else if (checkRuns.some((r) => r.conclusion === 'FAILURE' || r.conclusion === 'TIMED_OUT')) ciState = 'FAILURE';
        else if (checkRuns.every((r) => r.conclusion === 'SUCCESS' || r.conclusion === 'SKIPPED' || r.conclusion === 'NEUTRAL')) ciState = 'SUCCESS';
        else ciState = 'PENDING';
      }

      return {
        number: pr.number,
        title: pr.title,
        url: pr.url,
        state: pr.state,
        isDraft: pr.isDraft,
        headRefName: pr.headRefName,
        ciState,
        checkRuns,
      };
    })
  );

  return results;
}

// Fetch the body of a single issue or PR on demand (not loaded in bulk query)
const ITEM_BODY_QUERY = `
query GetItemBody($owner: String!, $repo: String!, $number: Int!, $isIssue: Boolean!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $number) @include(if: $isIssue) { body }
    pullRequest(number: $number) @skip(if: $isIssue) { body }
  }
}
`;

// ─── Phase 1: File-Level Deep Linking ────────────────────────────────────────

interface RawPRFile {
  filename: string;
  patch?: string;
  additions: number;
  deletions: number;
  status: string;
}

export async function fetchPRFiles(owner: string, repo: string, prNumber: number): Promise<PRFile[]> {
  const token = await getToken();
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100`;
  const resp = await fetch(url, {
    headers: { Authorization: `bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (!resp.ok) return [];
  const files = (await resp.json()) as RawPRFile[];
  return files.map((f) => ({
    filename: f.filename,
    patch: f.patch,
    additions: f.additions,
    deletions: f.deletions,
    status: f.status,
  }));
}

// ─── Phase 2: Hotspot Monitor — open PR file lists ───────────────────────────

export async function fetchAllOpenPRFiles(
  prs: Array<{ owner: string; repo: string; number: number }>
): Promise<Map<string, PRFile[]>> {
  const token = await getToken();
  const result = new Map<string, PRFile[]>();
  await Promise.all(
    prs.slice(0, 15).map(async ({ owner, repo, number }) => {
      const key = `${owner}/${repo}#${number}`;
      try {
        const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${number}/files?per_page=100`;
        const resp = await fetch(url, {
          headers: { Authorization: `bearer ${token}`, Accept: 'application/vnd.github+json' },
        });
        if (!resp.ok) return;
        const files = (await resp.json()) as RawPRFile[];
        result.set(key, files.map((f) => ({ filename: f.filename, additions: f.additions, deletions: f.deletions, status: f.status })));
      } catch {
        // skip inaccessible repos
      }
    })
  );
  return result;
}

// ─── Phase 3: Standup Generator ──────────────────────────────────────────────

interface RawSearchIssue {
  number: number;
  title: string;
  html_url: string;
  pull_request?: { merged_at: string | null };
  repository_url: string;
}

interface RawGitHubEvent {
  type: string;
  created_at: string;
  repo: { name: string };
  payload: {
    action?: string;
    issue?: {
      number: number;
      title: string;
      html_url: string;
      pull_request?: unknown;
    };
    pull_request?: {
      number: number;
      title: string;
      html_url: string;
    };
  };
}

export async function generateStandupData(viewerLogin: string): Promise<{ data: StandupData; markdown: string }> {
  const token = await getToken();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const repoFromUrl = (url: string) => url.replace('https://api.github.com/repos/', '');

  async function search(q: string): Promise<RawSearchIssue[]> {
    const resp = await fetch(`https://api.github.com/search/issues?q=${encodeURIComponent(q)}&per_page=30`, {
      headers: { Authorization: `bearer ${token}`, Accept: 'application/vnd.github+json' },
    });
    if (!resp.ok) return [];
    const json = (await resp.json()) as { items: RawSearchIssue[] };
    return json.items ?? [];
  }

  async function fetchCommentedItems(): Promise<RawSearchIssue[]> {
    const resp = await fetch(
      `https://api.github.com/users/${viewerLogin}/events?per_page=100`,
      { headers: { Authorization: `bearer ${token}`, Accept: 'application/vnd.github+json' } }
    );
    if (!resp.ok) return [];
    const events = (await resp.json()) as RawGitHubEvent[];

    const seenUrls = new Set<string>();
    const items: RawSearchIssue[] = [];

    for (const event of events) {
      // Events are newest-first — stop once we're past the 24h window
      if (event.created_at < yesterday) break;

      const isMyComment =
        (event.type === 'IssueCommentEvent' && event.payload.action === 'created') ||
        (event.type === 'PullRequestReviewCommentEvent' && event.payload.action === 'created') ||
        event.type === 'PullRequestReviewEvent';
      if (!isMyComment) continue;

      const target = event.payload.issue ?? event.payload.pull_request;
      if (!target || seenUrls.has(target.html_url)) continue;
      seenUrls.add(target.html_url);

      items.push({
        number: target.number,
        title: target.title,
        html_url: target.html_url,
        repository_url: `https://api.github.com/repos/${event.repo.name}`,
        pull_request: (event.payload.pull_request ?? event.payload.issue?.pull_request) ? { merged_at: null } : undefined,
      });
    }
    return items;
  }

  const [mergedPRs, openPRs, commentedItems] = await Promise.all([
    search(`is:pr is:merged author:${viewerLogin} merged:>${yesterday}`),
    search(`is:pr is:open author:${viewerLogin} updated:>${yesterday}`),
    fetchCommentedItems(),
  ]);

  // Remove items already listed in merged/open from the commented section
  const listedUrls = new Set([...mergedPRs, ...openPRs].map((i) => i.html_url));
  const uniqueCommented = commentedItems.filter((i) => !listedUrls.has(i.html_url));

  function toRepoGroups(items: RawSearchIssue[]): StandupRepoGroup[] {
    const map = new Map<string, StandupRepoGroup['items']>();
    for (const item of items) {
      const repo = repoFromUrl(item.repository_url);
      if (!map.has(repo)) map.set(repo, []);
      map.get(repo)!.push({ number: item.number, title: item.title, url: item.html_url, isPR: !!item.pull_request });
    }
    return Array.from(map.entries()).map(([repo, its]) => ({ repo, items: its }));
  }

  const rawSections: Array<{ key: string; icon: string; title: string; items: RawSearchIssue[] }> = [
    { key: 'merged',    icon: '✅', title: 'Merged PRs',    items: mergedPRs },
    { key: 'open',      icon: '🔄', title: 'Open PRs',      items: openPRs },
    { key: 'commented', icon: '💬', title: 'Commented on',  items: uniqueCommented },
  ];

  const sections: StandupSection[] = rawSections
    .filter((s) => s.items.length > 0)
    .map((s) => ({ key: s.key, icon: s.icon, title: s.title, groups: toRepoGroups(s.items) }));

  const data: StandupData = { date: today, sections };

  // Generate markdown from structured data (used for the copy-as-markdown button)
  const lines: string[] = [`## Daily Standup — ${today}`, ''];
  if (sections.length === 0) {
    lines.push('*No activity found in the last 24 hours.*', '');
  } else {
    for (const section of sections) {
      lines.push(`### ${section.icon} ${section.title}`);
      for (const group of section.groups) {
        lines.push(`**${group.repo}**`);
        for (const item of group.items) {
          lines.push(`- [#${item.number} ${item.title}](${item.url})`);
        }
      }
      lines.push('');
    }
  }
  lines.push('*Generated by SprintHub*');

  return { data, markdown: lines.join('\n') };
}

// ─── Phase 3: Metadata Sync (Labels / Assignees) ─────────────────────────────

interface RawIssueUpdateResponse {
  labels: Array<{ name: string; color: string }>;
  assignees: Array<{ login: string; avatar_url: string }>;
}

export async function updateIssueMetadata(
  owner: string,
  repo: string,
  issueNumber: number,
  labels?: string[],
  assignees?: string[]
): Promise<{ labels: GHLabel[]; assignees: GHUser[] }> {
  const token = await getToken();
  const body: Record<string, unknown> = {};
  if (labels !== undefined) body.labels = labels;
  if (assignees !== undefined) body.assignees = assignees;

  const resp = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`, {
    method: 'PATCH',
    headers: {
      Authorization: `bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    throw new Error(`GitHub PATCH issue failed: ${resp.status} ${resp.statusText}`);
  }

  const json = (await resp.json()) as RawIssueUpdateResponse;
  return {
    labels: (json.labels ?? []).map((l) => ({ name: l.name, color: l.color })),
    assignees: (json.assignees ?? []).map((a) => ({ login: a.login, avatarUrl: a.avatar_url })),
  };
}

export async function fetchRepoLabels(owner: string, repo: string): Promise<GHLabel[]> {
  const token = await getToken();
  const resp = await fetch(`https://api.github.com/repos/${owner}/${repo}/labels?per_page=100`, {
    headers: { Authorization: `bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (!resp.ok) return [];
  const json = (await resp.json()) as Array<{ name: string; color: string }>;
  return json.map((l) => ({ name: l.name, color: l.color }));
}

// ─── v2 extras ───────────────────────────────────────────────────────────────

export async function convertDraftToReady(owner: string, repo: string, prNumber: number): Promise<void> {
  const token = await getToken();
  const resp = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, {
    method: 'PATCH',
    headers: {
      Authorization: `bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ draft: false }),
  });
  if (!resp.ok) throw new Error(`GitHub PATCH pull failed: ${resp.status} ${resp.statusText}`);
}

export async function mergePR(
  owner: string,
  repo: string,
  prNumber: number,
  mergeMethod: 'merge' | 'squash' | 'rebase'
): Promise<void> {
  const token = await getToken();
  const resp = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/merge`, {
    method: 'PUT',
    headers: {
      Authorization: `bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ merge_method: mergeMethod }),
  });
  if (!resp.ok) {
    const json = await resp.json().catch(() => ({})) as { message?: string };
    throw new Error(json.message ?? `Merge failed: ${resp.status} ${resp.statusText}`);
  }
}

export async function fetchCodeowners(
  owner: string,
  repo: string
): Promise<Array<{ pattern: string; owners: string[] }>> {
  const token = await getToken();

  async function tryPath(path: string): Promise<string | null> {
    const resp = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
      headers: { Authorization: `bearer ${token}`, Accept: 'application/vnd.github+json' },
    });
    if (!resp.ok) return null;
    const json = (await resp.json()) as { content?: string; encoding?: string };
    if (json.encoding === 'base64' && json.content) {
      return atob(json.content.replace(/\n/g, ''));
    }
    return null;
  }

  const [a, b, c] = await Promise.all([
    tryPath('.github/CODEOWNERS'),
    tryPath('CODEOWNERS'),
    tryPath('docs/CODEOWNERS'),
  ]);
  const content = a ?? b ?? c;

  if (!content) return [];

  const entries: Array<{ pattern: string; owners: string[] }> = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) continue;
    entries.push({ pattern: parts[0], owners: parts.slice(1) });
  }
  return entries;
}

// ─────────────────────────────────────────────────────────────────────────────

export async function fetchItemBody(
  owner: string,
  repo: string,
  number: number,
  isIssue: boolean
): Promise<string> {
  const token = await getToken();
  const data = await graphql<{
    repository: {
      issue?: { body: string } | null;
      pullRequest?: { body: string } | null;
    };
  }>(token, ITEM_BODY_QUERY, { owner, repo, number, isIssue });

  return (isIssue ? data.repository.issue?.body : data.repository.pullRequest?.body) ?? '';
}

// ─── Settings Pickers ─────────────────────────────────────────────────────────

export async function fetchSettingsOwners(): Promise<Array<{ login: string; ownerType: 'organization' | 'user' }>> {
  const token = await getToken();
  const data = await graphql<{
    viewer: { login: string; organizations: { nodes: Array<{ login: string }> } };
  }>(
    token,
    `query {
      viewer {
        login
        organizations(first: 100) { nodes { login } }
      }
    }`,
    {}
  );
  return [
    { login: data.viewer.login, ownerType: 'user' },
    ...data.viewer.organizations.nodes.map((o) => ({ login: o.login, ownerType: 'organization' as const })),
  ];
}

export async function fetchSettingsProjects(
  owner: string,
  ownerType: 'organization' | 'user'
): Promise<Array<{ number: number; title: string }>> {
  const token = await getToken();
  const isOrg = ownerType === 'organization';
  const data = await graphql<{
    org?: { projectsV2: { nodes: Array<{ number: number; title: string }> } } | null;
    user?: { projectsV2: { nodes: Array<{ number: number; title: string }> } } | null;
  }>(
    token,
    `query($login: String!, $isOrg: Boolean!) {
      org: organization(login: $login) @include(if: $isOrg) {
        projectsV2(first: 50, orderBy: { field: UPDATED_AT, direction: DESC }) {
          nodes { number title }
        }
      }
      user: user(login: $login) @skip(if: $isOrg) {
        projectsV2(first: 50, orderBy: { field: UPDATED_AT, direction: DESC }) {
          nodes { number title }
        }
      }
    }`,
    { login: owner, isOrg }
  );
  return (isOrg ? data.org?.projectsV2.nodes : data.user?.projectsV2.nodes) ?? [];
}
