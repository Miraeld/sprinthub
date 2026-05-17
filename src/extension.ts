import * as vscode from 'vscode';
import { SprintHubPanel } from './SprintHubPanel';

class SprintHubSidebarProvider implements vscode.TreeDataProvider<never> {
  getTreeItem(): vscode.TreeItem { return new vscode.TreeItem(''); }
  getChildren(): [] { return []; }
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('sprinthub.sidebar', new SprintHubSidebarProvider())
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('sprinthub.open', () => {
      SprintHubPanel.createOrShow(context.extensionUri, context);
    })
  );

  // Phase 2: Status Bar Blocker Watchdog command
  context.subscriptions.push(
    vscode.commands.registerCommand('sprinthub.showBlockers', () => {
      SprintHubPanel.currentPanel?.showBlockersQuickPick();
    })
  );
}

export function deactivate() {}
