import * as vscode from 'vscode';
import { fetchProjectData, fetchLinkedPRChecks, fetchItemBody } from './githubService';
import { ExtensionMessage, RunwayConfig, WebviewMessage } from './types';

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
  private readonly _disposables: vscode.Disposable[] = [];
  private _refreshTimer: ReturnType<typeof setInterval> | undefined;

  public static createOrShow(extensionUri: vscode.Uri) {
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

    SprintHubPanel.currentPanel = new SprintHubPanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

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
            void this._fetchBody(message.itemId, message.owner, message.repo, message.number, message.isIssue);
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
          this._loadData();
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
      liquidGlass: config.get<boolean>('liquidGlass', false),
      theme: config.get<string>('theme', 'dark') as 'dark' | 'light',
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
      config.update('colorBlind', cfg.colorBlind, vscode.ConfigurationTarget.Global),
    ]);
  }

  private async _fetchLinkedPRs(itemId: string, owner: string, repo: string, issueNumber: number) {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 15000)
    );
    try {
      const prs = await Promise.race([fetchLinkedPRChecks(owner, repo, issueNumber), timeout]);
      this._post({ type: 'linkedPRs', itemId, prs });
    } catch {
      this._post({ type: 'linkedPRs', itemId, prs: [] });
    }
  }

  private async _fetchBody(itemId: string, owner: string, repo: string, number: number, isIssue: boolean) {
    try {
      const body = await fetchItemBody(owner, repo, number, isIssue);
      this._post({ type: 'itemBody', itemId, body });
    } catch {
      this._post({ type: 'itemBody', itemId, body: '' });
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
    this._post({ type: 'loading' });

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

    try {
      const data = await fetchProjectData(
        owner,
        projectNumber,
        ownerType === 'organization',
        statusFieldName
      );
      this._post({ type: 'data', payload: data });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this._post({ type: 'error', message: msg });
    }
  }

  private _post(message: ExtensionMessage) {
    this._panel.webview.postMessage(message);
  }

  private _buildHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'out', 'webview.js')
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
