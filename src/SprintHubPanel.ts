import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as util from 'util';
import {
  fetchProjectData,
  fetchLinkedPRsForBoard,
  fetchLinkedPRChecks,
  fetchItemBody,
  fetchPRFiles,
  fetchAllOpenPRFiles,
  generateStandupData,
  updateIssueMetadata,
  fetchRepoLabels,
  convertDraftToReady,
  mergePR,
  fetchCodeowners,
  fetchSettingsOwners,
  fetchSettingsProjects,
} from './githubService';
import { BoardItem, ConflictThreat, ExtensionMessage, LinkedPR, RunwayConfig, RunwayData, ThemePreset, WebviewMessage } from './types';

const exec = util.promisify(cp.exec);

export function cacheKeyFor(owner: string, projectNumber: number, ownerType: string, statusFieldName: string): string {
  return `sprinthub.cache.${owner}.${projectNumber}.${ownerType}.${statusFieldName}`;
}

export function applyStatusBarData(item: vscode.StatusBarItem, data: RunwayData): void {
  const allItems: BoardItem[] = [...Object.values(data.groups).flat(), ...(data.linkedIssuePRs ?? [])];
  const openPRs = allItems.filter((i) => i.type === 'PULL_REQUEST' && i.state === 'OPEN');
  const ciFailures = openPRs.filter((i) => i.ciState === 'FAILURE' || i.ciState === 'ERROR');
  const changesRequested = openPRs.filter((i) =>
    i.reviews?.some((r) => r.state === 'CHANGES_REQUESTED')
  );
  const total = ciFailures.length + changesRequested.length;
  if (total === 0) {
    item.text = '$(check) SprintHub';
    item.backgroundColor = undefined;
  } else {
    const parts: string[] = [];
    if (ciFailures.length) parts.push(`${ciFailures.length} CI fail${ciFailures.length > 1 ? 's' : ''}`);
    if (changesRequested.length) parts.push(`${changesRequested.length} changes req`);
    item.text = `$(warning) ${parts.join(' · ')}`;
    item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  }
  item.show();
}

function getNonce() {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}

export class SprintHubPanel {
  public static currentPanel: SprintHubPanel | undefined;
  private static readonly viewType = 'sprinthub';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _context: vscode.ExtensionContext;
  private readonly _disposables: vscode.Disposable[] = [];
  private _refreshTimer: ReturnType<typeof setInterval> | undefined;
  private _statusBarItem: vscode.StatusBarItem;
  // Reverse lookup built after background linked-PR fetch: issueNumber → linked PRs.
  // Used as a fallback in _fetchLinkedPRs when fetchLinkedPRChecks returns empty.
  private _linkedByIssue = new Map<number, BoardItem[]>();

  private static _cacheKey(owner: string, projectNumber: number, ownerType: string, statusFieldName: string): string {
    return cacheKeyFor(owner, projectNumber, ownerType, statusFieldName);
  }

  public static createOrShow(extensionUri: vscode.Uri, context: vscode.ExtensionContext, statusBarItem: vscode.StatusBarItem) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (SprintHubPanel.currentPanel) {
      SprintHubPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      SprintHubPanel.viewType,
      'SprintHub',
      column ?? vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'out')],
      }
    );

    SprintHubPanel.currentPanel = new SprintHubPanel(panel, extensionUri, context, statusBarItem);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, context: vscode.ExtensionContext, statusBarItem: vscode.StatusBarItem) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._context = context;

    // Phase 2: Status bar blocker watchdog — item is owned by extension.ts, not disposed here
    this._statusBarItem = statusBarItem;

    this._panel.webview.html = this._buildHtml(this._panel.webview);

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      (message: WebviewMessage) => {
        switch (message.type) {
          case 'refresh':
            this._loadData();
            break;
          case 'openUrl':
            vscode.env.openExternal(vscode.Uri.parse(message.url));
            break;
          case 'getConfig':
            this._sendConfig();
            break;
          case 'updateConfig':
            void this._updateConfig(message.payload);
            break;
          case 'fetchLinkedPRs':
            void this._fetchLinkedPRs(message.itemId, message.owner, message.repo, message.issueNumber);
            break;
          case 'fetchBody':
            void this._fetchBody(message.itemId, message.owner, message.repo, message.number, message.isIssue, message.updatedAt);
            break;
          // Phase 1: Work-On-This Engine
          case 'workOnThis':
            void this._workOnThis(message.branchName, message.owner, message.repo);
            break;
          // Phase 1: File-Level Deep Linking
          case 'fetchPRFiles':
            void this._fetchPRFiles(message.prKey, message.owner, message.repo, message.prNumber);
            break;
          case 'openPRFile':
            void this._openPRFile(message.owner, message.repo, message.prNumber, message.filename, message.patch);
            break;
          // Phase 3: Standup Generator
          case 'generateStandup':
            void this._generateStandup(message.viewerLogin);
            break;
          // Phase 3: Metadata Sync
          case 'updateMetadata':
            void this._updateMetadata(message.itemId, message.owner, message.repo, message.issueNumber, message.labels, message.assignees);
            break;
          case 'fetchRepoLabels':
            void this._fetchRepoLabels(message.owner, message.repo);
            break;
          case 'convertDraftToReady':
            void this._convertDraftToReady(message.itemId, message.owner, message.repo, message.prNumber);
            break;
          case 'mergePR':
            void this._mergePR(message.itemId, message.owner, message.repo, message.prNumber, message.mergeMethod);
            break;
          case 'fetchCodeowners':
            void this._fetchCodeowners(message.owner, message.repo);
            break;
          case 'fetchSettingsOwners':
            void this._fetchSettingsOwners();
            break;
          case 'fetchSettingsProjects':
            void this._fetchSettingsProjects(message.owner, message.ownerType);
            break;
        }
      },
      null,
      this._disposables
    );

    vscode.workspace.onDidChangeConfiguration(
      (e) => {
        if (e.affectsConfiguration('sprinthub')) {
          this._sendConfig();
          // Only reload data when a field that affects the API query changes.
          // Cosmetic fields (liquidGlass, theme, preset, colorBlind) and refreshInterval
          // must not trigger a full board re-fetch.
          const dataFields = ['owner', 'projectNumber', 'ownerType', 'statusFieldName'];
          if (dataFields.some((f) => e.affectsConfiguration(`sprinthub.${f}`))) {
            this._loadData();
          }
          this._scheduleRefresh();
        }
      },
      null,
      this._disposables
    );

    this._loadData();
    this._sendConfig();
    this._scheduleRefresh();
  }

  private _sendConfig() {
    const config = vscode.workspace.getConfiguration('sprinthub');
    const payload: RunwayConfig = {
      owner: config.get<string>('owner', '').trim(),
      projectNumber: config.get<number>('projectNumber', 0),
      ownerType: config.get<string>('ownerType', 'organization') as 'organization' | 'user',
      statusFieldName: config.get<string>('statusFieldName', 'Status'),
      refreshInterval: config.get<number>('refreshInterval', 5),
      liquidGlass: config.get<boolean>('liquidGlass', true),
      theme: config.get<string>('theme', 'dark') as 'dark' | 'light',
      preset: config.get<string>('preset', 'gold') as ThemePreset,
      colorBlind: config.get<boolean>('colorBlind', false),
    };
    this._post({ type: 'config', payload });
  }

  private async _updateConfig(cfg: RunwayConfig) {
    const config = vscode.workspace.getConfiguration('sprinthub');
    await Promise.all([
      config.update('owner', cfg.owner, vscode.ConfigurationTarget.Global),
      config.update('projectNumber', cfg.projectNumber, vscode.ConfigurationTarget.Global),
      config.update('ownerType', cfg.ownerType, vscode.ConfigurationTarget.Global),
      config.update('statusFieldName', cfg.statusFieldName, vscode.ConfigurationTarget.Global),
      config.update('refreshInterval', cfg.refreshInterval, vscode.ConfigurationTarget.Global),
      config.update('liquidGlass', cfg.liquidGlass, vscode.ConfigurationTarget.Global),
      config.update('theme', cfg.theme, vscode.ConfigurationTarget.Global),
      config.update('preset', cfg.preset, vscode.ConfigurationTarget.Global),
      config.update('colorBlind', cfg.colorBlind, vscode.ConfigurationTarget.Global),
    ]);
  }

  private async _fetchLinkedPRs(itemId: string, owner: string, repo: string, issueNumber: number) {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 15000)
    );
    let prs: LinkedPR[] = [];
    try {
      prs = await Promise.race([fetchLinkedPRChecks(owner, repo, issueNumber), timeout]);
    } catch {
      // fetchLinkedPRChecks failed or timed out — fall through to board-level fallback
    }

    if (!prs.length) {
      // Fallback: use board-level linked PRs already fetched in background
      const boardPRs = this._linkedByIssue.get(issueNumber) ?? [];
      if (boardPRs.length) {
        prs = boardPRs.map((pr): LinkedPR => ({
          number: pr.number,
          title: pr.title,
          url: pr.url,
          state: pr.state,
          isDraft: pr.isDraft ?? false,
          headRefName: pr.headRefName ?? '',
          ciState: pr.ciState ?? 'none',
          checkRuns: [],
        }));
      }
    }

    this._post({ type: 'linkedPRs', itemId, prs });
  }

  private async _fetchBody(itemId: string, owner: string, repo: string, number: number, isIssue: boolean, updatedAt: string) {
    try {
      const body = await fetchItemBody(owner, repo, number, isIssue);
      this._post({ type: 'itemBody', itemId, body, updatedAt });
    } catch {
      // null signals a transient failure — the webview will not cache it so the
      // next open will retry rather than permanently showing an empty body.
      this._post({ type: 'itemBody', itemId, body: null, updatedAt });
    }
  }

  private _scheduleRefresh() {
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
    }
    const intervalMinutes =
      vscode.workspace.getConfiguration('sprinthub').get<number>('refreshInterval', 5);
    if (intervalMinutes > 0) {
      this._refreshTimer = setInterval(
        () => this._loadData(),
        intervalMinutes * 60 * 1000
      );
    }
  }

  private async _loadData() {
    const config = vscode.workspace.getConfiguration('sprinthub');
    const owner = config.get<string>('owner', '').trim();
    const projectNumber = config.get<number>('projectNumber', 0);
    const ownerType = config.get<string>('ownerType', 'organization');
    const statusFieldName = config.get<string>('statusFieldName', 'Status');

    if (!owner || !projectNumber) {
      this._post({
        type: 'error',
        message:
          'Please set sprinthub.owner and sprinthub.projectNumber in your VS Code settings (File → Preferences → Settings → search "SprintHub").',
      });
      return;
    }

    // Show cached data immediately so the board is visible while fresh data loads.
    // Cache is scoped to the current config so switching projects never shows stale data.
    const cacheKey = SprintHubPanel._cacheKey(owner, projectNumber, ownerType, statusFieldName);
    const cached = this._context.globalState.get<RunwayData>(cacheKey);
    if (cached) {
      this._post({ type: 'data', payload: cached });
      this._updateStatusBar(cached); // fix: status bar available immediately from cache
      this._post({ type: 'refreshing' });
    } else {
      this._post({ type: 'loading' });
    }

    try {
      const isRefresh = !!cached;
      const data = await fetchProjectData(
        owner,
        projectNumber,
        ownerType === 'organization',
        statusFieldName,
        isRefresh ? undefined : (partial) => {
          this._post({ type: 'data', payload: partial });
          this._updateStatusBar(partial);
        }
      );
      if (isRefresh) {
        // Post the complete fresh data atomically — no partial updates during refresh
        this._post({ type: 'data', payload: data });
        this._updateStatusBar(data);
      }
      // Persist for next open — attach .catch() so a storage rejection doesn't go silent
      this._context.globalState.update(cacheKey, data).then(undefined, (err: unknown) => {
        console.error('SprintHub: cache write failed', err);
      });
      // Signal that the main board data is ready — the webview can render now.
      // Linked PRs and conflict checks run in the background and push updates
      // incrementally via linkedIssuePRs / conflictThreats messages.
      this._post({ type: 'dataComplete' });
      void (async () => {
        try {
          const linkedPRs = await this._fetchLinkedPRsBackground(data.groups);
          const enriched = { ...data, linkedIssuePRs: linkedPRs };
          // Update status bar with the now-enriched PR list (linked PRs were [] before this point)
          this._updateStatusBar(enriched);
          await this._checkConflicts(enriched);
        } catch {
          // best-effort — linked PRs and conflict checks are non-blocking
        }
      })();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this._post({ type: 'error', message: msg });
      this._post({ type: 'dataComplete' });
    }
  }

  // ─── Phase 1: Work-On-This Engine ──────────────────────────────────────────

  private async _workOnThis(branchName: string, _owner: string, _repo: string) {
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!cwd) {
      vscode.window.showErrorMessage('SprintHub: No workspace folder open to checkout branch.');
      return;
    }

    let branchExists = false;
    try {
      await exec(`git rev-parse --verify "${branchName}"`, { cwd });
      branchExists = true;
    } catch {
      branchExists = false;
    }

    let terminal = vscode.window.terminals.find((t) => t.name === 'SprintHub');
    if (!terminal) {
      terminal = vscode.window.createTerminal('SprintHub');
    }
    terminal.show(true);

    if (branchExists) {
      terminal.sendText(`git checkout ${branchName}`);
    } else {
      terminal.sendText(`git fetch origin ${branchName} 2>/dev/null; git checkout -b ${branchName} origin/${branchName} 2>/dev/null || git checkout ${branchName}`);
    }

    // Focus the most recently modified file in the workspace
    setTimeout(() => void this._focusMostRecentFile(cwd), 2000);
  }

  private async _focusMostRecentFile(cwd: string) {
    try {
      const { stdout } = await exec('git diff --name-only HEAD', { cwd });
      const files = stdout.trim().split('\n').filter(Boolean);
      if (!files.length) return;
      const found = await vscode.workspace.findFiles(files[0], '**/node_modules/**', 1);
      if (found.length) {
        const doc = await vscode.workspace.openTextDocument(found[0]);
        await vscode.window.showTextDocument(doc, { preserveFocus: false });
      }
    } catch {
      // silently skip if git diff fails (detached HEAD, etc.)
    }
  }

  // ─── Phase 1: File-Level Deep Linking ──────────────────────────────────────

  private async _fetchPRFiles(prKey: string, owner: string, repo: string, prNumber: number) {
    try {
      const files = await fetchPRFiles(owner, repo, prNumber);
      this._post({ type: 'prFiles', prKey, files });
    } catch {
      this._post({ type: 'prFiles', prKey, files: [] });
    }
  }

  private async _openPRFile(owner: string, repo: string, _prNumber: number, filename: string, patch?: string) {
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!cwd) {
      vscode.window.showWarningMessage('SprintHub: No workspace folder open.');
      return;
    }

    const found = await vscode.workspace.findFiles(filename, '**/node_modules/**', 1);
    if (!found.length) {
      vscode.window.showWarningMessage(`SprintHub: File not found locally: ${filename}`);
      return;
    }

    const doc = await vscode.workspace.openTextDocument(found[0]);
    let line = 0;
    if (patch) {
      const match = patch.match(/@@ -\d+(?:,\d+)? \+(\d+)/);
      if (match) line = Math.max(0, parseInt(match[1], 10) - 1);
    }
    const selection = new vscode.Range(line, 0, line, 0);
    await vscode.window.showTextDocument(doc, { selection });
  }

  // ─── Linked PRs background fetch ───────────────────────────────────────────

  private async _fetchLinkedPRsBackground(groups: RunwayData['groups']): Promise<BoardItem[]> {
    try {
      const prs = await fetchLinkedPRsForBoard(groups);
      // Build reverse lookup so _fetchLinkedPRs can find PRs by issue number
      const linkedByIssue = new Map<number, BoardItem[]>();
      for (const pr of prs) {
        for (const num of pr.closingIssueNumbers ?? []) {
          if (!linkedByIssue.has(num)) linkedByIssue.set(num, []);
          linkedByIssue.get(num)!.push(pr);
        }
      }
      this._linkedByIssue = linkedByIssue;
      this._post({ type: 'linkedIssuePRs', prs });
      return prs;
    } catch {
      this._post({ type: 'linkedIssuePRs', prs: [] });
      return [];
    }
  }

  // ─── Phase 2: Hotspot Conflict Monitor ─────────────────────────────────────

  private async _checkConflicts(data: RunwayData) {
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!cwd) return;

    let localDirty: Set<string>;
    try {
      const { stdout } = await exec('git diff --name-only HEAD', { cwd });
      localDirty = new Set(stdout.trim().split('\n').filter(Boolean));
    } catch {
      return;
    }

    if (!localDirty.size) {
      this._post({ type: 'conflictThreats', threats: [] });
      return;
    }

    // Collect open PRs from board + linked PRs
    const openPRs: Array<{ owner: string; repo: string; number: number; title: string; author: string; url: string }> = [];
    const allBoardItems: BoardItem[] = [...Object.values(data.groups).flat(), ...(data.linkedIssuePRs ?? [])];
    for (const item of allBoardItems) {
      if (item.type === 'PULL_REQUEST' && item.state === 'OPEN' && item.repositoryOwner && item.repository) {
        openPRs.push({
          owner: item.repositoryOwner,
          repo: item.repository,
          number: item.number,
          title: item.title,
          author: item.author.login,
          url: item.url,
        });
      }
    }

    if (!openPRs.length) {
      this._post({ type: 'conflictThreats', threats: [] });
      return;
    }

    try {
      const prFilesMap = await fetchAllOpenPRFiles(openPRs.map((p) => ({ owner: p.owner, repo: p.repo, number: p.number })));
      const threats: ConflictThreat[] = [];

      for (const pr of openPRs) {
        const key = `${pr.owner}/${pr.repo}#${pr.number}`;
        const files = prFilesMap.get(key) ?? [];
        for (const file of files) {
          if (localDirty.has(file.filename)) {
            threats.push({
              filename: file.filename,
              prNumber: pr.number,
              prTitle: pr.title,
              prAuthor: pr.author,
              prUrl: pr.url,
            });
          }
        }
      }

      this._post({ type: 'conflictThreats', threats });
    } catch {
      // conflict check is best-effort
    }
  }

  // ─── Phase 2: Status Bar Blocker Watchdog ──────────────────────────────────

  private _updateStatusBar(data: RunwayData) {
    // Delegate display logic to the shared helper (also used by background service)
    applyStatusBarData(this._statusBarItem, data);

    // Store blocker lists for the quick-pick
    const allItems: BoardItem[] = [...Object.values(data.groups).flat(), ...(data.linkedIssuePRs ?? [])];
    const openPRs = allItems.filter((i) => i.type === 'PULL_REQUEST' && i.state === 'OPEN');
    const ciFailures = openPRs.filter((i) => i.ciState === 'FAILURE' || i.ciState === 'ERROR');
    const changesRequested = openPRs.filter((i) =>
      i.reviews?.some((r) => r.state === 'CHANGES_REQUESTED')
    );
    (this as unknown as Record<string, unknown>)._blockerPRs = { ciFailures, changesRequested };
  }

  public showBlockersQuickPick() {
    const stored = (this as unknown as Record<string, unknown>)._blockerPRs as
      | { ciFailures: BoardItem[]; changesRequested: BoardItem[] }
      | undefined;
    if (!stored) {
      vscode.window.showInformationMessage('SprintHub: No blocker data loaded yet.');
      return;
    }

    const { ciFailures, changesRequested } = stored;
    const items: vscode.QuickPickItem[] = [];

    if (ciFailures.length) {
      items.push({ label: '$(error) CI Failing', kind: vscode.QuickPickItemKind.Separator });
      for (const pr of ciFailures) {
        items.push({ label: `#${pr.number} ${pr.title}`, description: `${pr.repositoryOwner}/${pr.repository}`, detail: pr.url });
      }
    }

    if (changesRequested.length) {
      items.push({ label: '$(git-pull-request) Changes Requested', kind: vscode.QuickPickItemKind.Separator });
      for (const pr of changesRequested) {
        items.push({ label: `#${pr.number} ${pr.title}`, description: `${pr.repositoryOwner}/${pr.repository}`, detail: pr.url });
      }
    }

    if (!items.length) {
      vscode.window.showInformationMessage('SprintHub: All PRs are healthy!');
      return;
    }

    void vscode.window.showQuickPick(items, { title: 'SprintHub Blockers', placeHolder: 'Select a PR to open on GitHub' }).then((selected) => {
      if (selected?.detail) {
        void vscode.env.openExternal(vscode.Uri.parse(selected.detail));
      }
    });
  }

  // ─── Phase 3: Standup Markdown Generator ───────────────────────────────────

  private async _generateStandup(viewerLogin: string) {
    try {
      const { data, markdown } = await generateStandupData(viewerLogin);
      this._post({ type: 'standup', data, markdown });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this._post({ type: 'standup', data: { date: '', sections: [], error: msg }, markdown: `*Error generating standup: ${msg}*` });
    }
  }

  // ─── Phase 3: Metadata Sync ─────────────────────────────────────────────────

  private async _updateMetadata(
    itemId: string,
    owner: string,
    repo: string,
    issueNumber: number,
    labels?: string[],
    assignees?: string[]
  ) {
    try {
      const updated = await updateIssueMetadata(owner, repo, issueNumber, labels, assignees);
      this._post({ type: 'metadataUpdated', itemId, labels: updated.labels, assignees: updated.assignees });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`SprintHub: Failed to update metadata — ${msg}`);
    }
  }

  private async _fetchRepoLabels(owner: string, repo: string) {
    try {
      const labels = await fetchRepoLabels(owner, repo);
      this._post({ type: 'repoLabels', owner, repo, labels });
    } catch {
      this._post({ type: 'repoLabels', owner, repo, labels: [] });
    }
  }

  // ─── v2 extras ───────────────────────────────────────────────────────────────

  private async _convertDraftToReady(itemId: string, owner: string, repo: string, prNumber: number) {
    try {
      await convertDraftToReady(owner, repo, prNumber);
      this._post({ type: 'prReadied', itemId });
    } catch (err) {
      vscode.window.showErrorMessage(`SprintHub: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async _mergePR(
    itemId: string,
    owner: string,
    repo: string,
    prNumber: number,
    mergeMethod: 'merge' | 'squash' | 'rebase'
  ) {
    try {
      await mergePR(owner, repo, prNumber, mergeMethod);
      this._post({ type: 'prMerged', itemId });
      vscode.window.showInformationMessage(`SprintHub: PR #${prNumber} merged successfully.`);
    } catch (err) {
      vscode.window.showErrorMessage(`SprintHub: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async _fetchCodeowners(owner: string, repo: string) {
    try {
      const entries = await fetchCodeowners(owner, repo);
      this._post({ type: 'codeowners', owner, repo, entries });
    } catch {
      this._post({ type: 'codeowners', owner, repo, entries: [] });
    }
  }

  private async _fetchSettingsOwners() {
    try {
      const owners = await fetchSettingsOwners();
      this._post({ type: 'settingsOwners', owners });
    } catch {
      this._post({ type: 'settingsOwners', owners: [] });
    }
  }

  private async _fetchSettingsProjects(owner: string, ownerType: 'organization' | 'user') {
    try {
      const projects = await fetchSettingsProjects(owner, ownerType);
      this._post({ type: 'settingsProjects', projects });
    } catch {
      this._post({ type: 'settingsProjects', projects: [] });
    }
  }

  // ───────────────────────────────────────────────────────────────────────────

  private _post(message: ExtensionMessage) {
    this._panel.webview.postMessage(message);
  }

  private _buildHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'out', 'webview.js')
    );
    const stylesUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'out', 'styles.css')
    );
    const nonce = getNonce();

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
             img-src ${webview.cspSource} https: data:;
             script-src 'nonce-${nonce}';
             style-src ${webview.cspSource} 'unsafe-inline';">
  <title>SprintHub</title>
  <link rel="stylesheet" href="${stylesUri}">
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  public dispose() {
    SprintHubPanel.currentPanel = undefined;
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
    }
    this._panel.dispose();
    while (this._disposables.length) {
      const d = this._disposables.pop();
      if (d) d.dispose();
    }
  }
}
