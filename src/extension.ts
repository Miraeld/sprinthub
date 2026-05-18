import * as vscode from 'vscode';
import { SprintHubPanel, cacheKeyFor } from './SprintHubPanel';
import { fetchProjectData } from './githubService';

class SprintHubSidebarProvider implements vscode.TreeDataProvider<never> {
  getTreeItem(): vscode.TreeItem { return new vscode.TreeItem(''); }
  getChildren(): [] { return []; }
}

let _bgTimer: ReturnType<typeof setInterval> | undefined;

async function _runBackgroundFetch(context: vscode.ExtensionContext): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('sprinthub');
  const owner = cfg.get<string>('owner', '').trim();
  const projectNumber = cfg.get<number>('projectNumber', 0);
  const ownerType = cfg.get<string>('ownerType', 'organization');
  const statusFieldName = cfg.get<string>('statusFieldName', 'Status');

  if (!owner || !projectNumber) return;

  try {
    const data = await fetchProjectData(owner, projectNumber, ownerType === 'organization', statusFieldName, undefined);
    await context.globalState.update(cacheKeyFor(owner, projectNumber, ownerType, statusFieldName), data);
  } catch {
    // best-effort — the panel will surface errors when it opens
  }
}

function _scheduleBackgroundRefresh(context: vscode.ExtensionContext): void {
  if (_bgTimer) clearInterval(_bgTimer);
  const minutes = vscode.workspace.getConfiguration('sprinthub').get<number>('refreshInterval', 5);
  if (minutes > 0) {
    _bgTimer = setInterval(() => {
      // Only refresh when the panel is closed — panel has its own timer when open
      if (!SprintHubPanel.currentPanel) {
        void _runBackgroundFetch(context);
      }
    }, minutes * 60 * 1000);
  }
}

export function activate(context: vscode.ExtensionContext) {
  // Use createTreeView so we can detect sidebar visibility and auto-open the panel
  const treeView = vscode.window.createTreeView('sprinthub.sidebar', {
    treeDataProvider: new SprintHubSidebarProvider(),
  });
  context.subscriptions.push(treeView);

  // Auto-open the webview panel and collapse the sidebar so only the panel is visible
  treeView.onDidChangeVisibility(({ visible }) => {
    if (visible) {
      void vscode.commands.executeCommand('sprinthub.open');
      void vscode.commands.executeCommand('workbench.action.closeSidebar');
    }
  }, null, context.subscriptions);

  context.subscriptions.push(
    vscode.commands.registerCommand('sprinthub.open', () => {
      SprintHubPanel.createOrShow(context.extensionUri, context);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('sprinthub.showBlockers', () => {
      SprintHubPanel.currentPanel?.showBlockersQuickPick();
    })
  );

  // Pre-warm the cache immediately on activation so the panel shows data instantly on first open
  void _runBackgroundFetch(context);
  _scheduleBackgroundRefresh(context);

  // Re-schedule if the refresh interval setting changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('sprinthub.refreshInterval')) {
        _scheduleBackgroundRefresh(context);
      }
    })
  );
}

export function deactivate() {
  if (_bgTimer) {
    clearInterval(_bgTimer);
    _bgTimer = undefined;
  }
}
