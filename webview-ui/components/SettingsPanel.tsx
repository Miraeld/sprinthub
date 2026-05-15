import React, { useState } from 'react';
import { RunwayConfig } from '../../src/types';

interface Props {
  config: RunwayConfig;
  onSave: (config: RunwayConfig) => void;
  onClose: () => void;
}

export function SettingsPanel({ config, onSave, onClose }: Props) {
  const [owner, setOwner] = useState(config.owner);
  const [projectNumber, setProjectNumber] = useState(
    config.projectNumber > 0 ? String(config.projectNumber) : ''
  );
  const [ownerType, setOwnerType] = useState<'organization' | 'user'>(config.ownerType);
  const [statusFieldName, setStatusFieldName] = useState(config.statusFieldName);
  const [refreshInterval, setRefreshInterval] = useState(String(config.refreshInterval));
  const [theme, setTheme] = useState<'dark' | 'light'>(config.theme ?? 'dark');
  const [colorBlind, setColorBlind] = useState(config.colorBlind ?? false);

  const handleSave = () => {
    onSave({
      owner: owner.trim(),
      projectNumber: parseInt(projectNumber, 10) || 0,
      ownerType,
      statusFieldName: statusFieldName.trim() || 'Status',
      refreshInterval: parseInt(refreshInterval, 10) || 5,
      liquidGlass: true, // always on
      theme,
      colorBlind,
    });
    onClose();
  };

  const isValid = owner.trim().length > 0 && parseInt(projectNumber, 10) > 0;

  return (
    <div className="settings-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="settings-modal">
        <div className="settings-header">
          <span className="settings-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            Project Settings
          </span>
          <button className="detail-close-btn" onClick={onClose} title="Close">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="settings-body">
          <div className="settings-field">
            <label className="settings-label">Owner Type</label>
            <div className="settings-toggle-group">
              <button
                className={`settings-toggle-btn${ownerType === 'organization' ? ' active' : ''}`}
                onClick={() => setOwnerType('organization')}
              >
                Organization
              </button>
              <button
                className={`settings-toggle-btn${ownerType === 'user' ? ' active' : ''}`}
                onClick={() => setOwnerType('user')}
              >
                User
              </button>
            </div>
          </div>

          <div className="settings-field">
            <label className="settings-label">
              {ownerType === 'organization' ? 'Organization' : 'Username'}
            </label>
            <input
              className="settings-input"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder={ownerType === 'organization' ? 'my-org' : 'username'}
              autoFocus
            />
          </div>

          <div className="settings-field">
            <label className="settings-label">Project Number</label>
            <input
              className="settings-input"
              type="number"
              min="1"
              value={projectNumber}
              onChange={(e) => setProjectNumber(e.target.value)}
              placeholder="e.g. 42"
            />
            <span className="settings-hint">
              Found in the URL: github.com/orgs/<em>owner</em>/projects/<strong>42</strong>
            </span>
          </div>

          <div className="settings-field">
            <label className="settings-label">Status Field Name</label>
            <input
              className="settings-input"
              value={statusFieldName}
              onChange={(e) => setStatusFieldName(e.target.value)}
              placeholder="Status"
            />
            <span className="settings-hint">
              Name of the single-select field used as the board column
            </span>
          </div>

          <div className="settings-field">
            <label className="settings-label">Auto-refresh interval (minutes)</label>
            <input
              className="settings-input settings-input-sm"
              type="number"
              min="0"
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(e.target.value)}
              placeholder="5"
            />
            <span className="settings-hint">Set to 0 to disable auto-refresh</span>
          </div>

          <div className="settings-field">
            <label className="settings-label">Theme</label>
            <div className="settings-toggle-group">
              <button
                className={`settings-toggle-btn${theme === 'dark' ? ' active' : ''}`}
                onClick={() => setTheme('dark')}
              >
                🌙 Dark
              </button>
              <button
                className={`settings-toggle-btn${theme === 'light' ? ' active' : ''}`}
                onClick={() => setTheme('light')}
              >
                ☀️ Light
              </button>
            </div>
          </div>

          <div className="settings-field settings-field-row">
            <label className="settings-toggle-label" htmlFor="colorBlindToggle">
              <span className="settings-toggle-icon">👁</span>
              Color-blind mode
              <span className="settings-hint" style={{ marginTop: 0, marginLeft: 6 }}>(replaces red/green with orange/blue)</span>
            </label>
            <button
              id="colorBlindToggle"
              className={`settings-switch${colorBlind ? ' active' : ''}`}
              onClick={() => setColorBlind((v) => !v)}
              role="switch"
              aria-checked={colorBlind}
              title="Use orange/blue instead of red/green for CI and review status"
            >
              <span className="settings-switch-knob" />
            </button>
          </div>
        </div>

        <div className="settings-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!isValid}
            title={!isValid ? 'Owner and project number are required' : ''}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Save & Reload
          </button>
        </div>
      </div>
    </div>
  );
}
