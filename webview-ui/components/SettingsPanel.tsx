import React, { useEffect, useState } from 'react';
import { RunwayConfig, ThemePreset, THEME_PRESETS } from '../../src/types';

/**
 * Swatch colours for the preset picker, keyed by preset. Each pair is that
 * preset's own light/dark accent taken verbatim from theme.css — the dot has
 * to show the preset it *offers*, not the one currently active, so it can't
 * read var(--accent). Rendered as a small two-tone gradient so a single dot
 * previews both modes.
 */
const PRESET_SWATCHES: Record<ThemePreset, { light: string; dark: string; label: string }> = {
  gold:     { light: '#FED23A', dark: '#FED23A', label: 'Gold' },
  sage:     { light: '#42734F', dark: '#99BD9E', label: 'Sage' },
  lavender: { light: '#635C8C', dark: '#B0A6D6', label: 'Lavender' },
  slate:    { light: '#3D6488', dark: '#8FB4D4', label: 'Slate' },
  tide:     { light: '#2E7268', dark: '#85BEB2', label: 'Tide' },
  clay:     { light: '#A15D48', dark: '#D29D88', label: 'Clay' },
  rose:     { light: '#9C5A6C', dark: '#D0A0AC', label: 'Rose' },
};

interface OwnerOption { login: string; ownerType: 'organization' | 'user' }
interface ProjectOption { number: number; title: string }

interface Props {
  config: RunwayConfig;
  onSave: (config: RunwayConfig) => void;
  onClose: () => void;
  owners: OwnerOption[] | null;
  projects: ProjectOption[] | null;
  onFetchOwners: () => void;
  onFetchProjects: (owner: string, ownerType: 'organization' | 'user') => void;
}

export function SettingsPanel({ config, onSave, onClose, owners, projects, onFetchOwners, onFetchProjects }: Props) {
  const [owner, setOwner] = useState(config.owner);
  const [projectNumber, setProjectNumber] = useState(
    config.projectNumber > 0 ? String(config.projectNumber) : ''
  );
  const [ownerType, setOwnerType] = useState<'organization' | 'user'>(config.ownerType);
  const [statusFieldName, setStatusFieldName] = useState(config.statusFieldName);
  const [refreshInterval, setRefreshInterval] = useState(String(config.refreshInterval));
  const [theme, setTheme] = useState<'dark' | 'light'>(config.theme ?? 'dark');
  const [preset, setPreset] = useState<ThemePreset>(config.preset ?? 'gold');
  const [colorBlind, setColorBlind] = useState(config.colorBlind ?? false);

  // Fetch owners when the modal opens
  useEffect(() => { onFetchOwners(); }, []);

  // Live-preview theme + accent while the modal is open, so picking a swatch
  // repaints the whole board instead of waiting for Save. `saved` guards the
  // revert: on Cancel (or Esc) we put the DOM back the way we found it, but
  // after Save the committed config drives it and we must not stomp on that.
  const saved = React.useRef(false);
  // Snapshot the committed look once, at mount — the revert target must be
  // what was saved when the modal opened, not whatever the previews left behind.
  const original = React.useRef({ theme: config.theme ?? 'dark', preset: config.preset ?? 'gold' });

  const applyLook = (t: 'dark' | 'light', p: ThemePreset) => {
    const html = document.documentElement;
    html.classList.toggle('dark', t !== 'light');
    if (p === 'gold') html.removeAttribute('data-preset');
    else html.setAttribute('data-preset', p);
  };

  useEffect(() => { applyLook(theme, preset); }, [theme, preset]);

  useEffect(() => () => {
    if (!saved.current) applyLook(original.current.theme, original.current.preset);
  }, []);

  // When owners load and current owner matches one, fetch its projects
  useEffect(() => {
    if (!owners || owner.trim() === '') return;
    const match = owners.find((o) => o.login === owner.trim());
    if (match) onFetchProjects(match.login, match.ownerType);
  }, [owners]);

  const handleOwnerSelect = (login: string, type: 'organization' | 'user') => {
    setOwner(login);
    setOwnerType(type);
    setProjectNumber('');
    onFetchProjects(login, type);
  };

  const handleProjectSelect = (num: string) => {
    setProjectNumber(num);
  };

  const handleSave = () => {
    saved.current = true;
    onSave({
      owner: owner.trim(),
      projectNumber: parseInt(projectNumber, 10) || 0,
      ownerType,
      statusFieldName: statusFieldName.trim() || 'Status',
      refreshInterval: parseInt(refreshInterval, 10) || 5,
      liquidGlass: true,
      theme,
      preset,
      colorBlind,
    });
    onClose();
  };

  const isValid = owner.trim().length > 0 && parseInt(projectNumber, 10) > 0;

  const ownersLoading = owners === null;
  const projectsLoading = projects === null && owner.trim().length > 0;

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
          {/* Owner picker */}
          <div className="settings-field">
            <label className="settings-label">
              Organization or User
              {ownersLoading && <span className="settings-loading-dot" />}
            </label>
            {owners && owners.length > 0 ? (
              <div className="settings-select-wrap">
                <select
                  className="settings-select"
                  value={owner}
                  onChange={(e) => {
                    const selected = owners.find((o) => o.login === e.target.value);
                    if (selected) handleOwnerSelect(selected.login, selected.ownerType);
                    else setOwner(e.target.value);
                  }}
                >
                  {!owners.some((o) => o.login === owner) && owner && (
                    <option value={owner}>{owner}</option>
                  )}
                  {owners.map((o) => (
                    <option key={o.login} value={o.login}>
                      {o.ownerType === 'organization' ? '⬡ ' : '◎ '}{o.login}
                      {o.ownerType === 'organization' ? ' (org)' : ' (you)'}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="settings-input-row">
                <input
                  className="settings-input"
                  value={owner}
                  onChange={(e) => {
                    setOwner(e.target.value);
                    setProjectNumber('');
                  }}
                  onBlur={() => {
                    if (owner.trim()) onFetchProjects(owner.trim(), ownerType);
                  }}
                  placeholder={ownerType === 'organization' ? 'my-org' : 'username'}
                  autoFocus={!ownersLoading}
                />
                <div className="settings-toggle-group settings-toggle-group-sm">
                  <button
                    className={`settings-toggle-btn${ownerType === 'organization' ? ' active' : ''}`}
                    onClick={() => setOwnerType('organization')}
                  >Org</button>
                  <button
                    className={`settings-toggle-btn${ownerType === 'user' ? ' active' : ''}`}
                    onClick={() => setOwnerType('user')}
                  >User</button>
                </div>
              </div>
            )}
          </div>

          {/* Project picker */}
          <div className="settings-field">
            <label className="settings-label">
              Project
              {projectsLoading && <span className="settings-loading-dot" />}
            </label>
            {projects && projects.length > 0 ? (
              <div className="settings-select-wrap">
                <select
                  className="settings-select"
                  value={projectNumber}
                  onChange={(e) => handleProjectSelect(e.target.value)}
                >
                  <option value="">— pick a project —</option>
                  {projects.map((p) => (
                    <option key={p.number} value={String(p.number)}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <>
                <input
                  className="settings-input"
                  type="number"
                  min="1"
                  value={projectNumber}
                  onChange={(e) => setProjectNumber(e.target.value)}
                  placeholder="e.g. 42"
                  disabled={projectsLoading}
                />
                {!projectsLoading && (
                  <span className="settings-hint">
                    Found in the URL: github.com/orgs/<em>owner</em>/projects/<strong>42</strong>
                  </span>
                )}
              </>
            )}
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
                Dark
              </button>
              <button
                className={`settings-toggle-btn${theme === 'light' ? ' active' : ''}`}
                onClick={() => setTheme('light')}
              >
                Light
              </button>
            </div>
          </div>

          <div className="settings-field">
            <label className="settings-label">Accent</label>
            <div className="preset-grid" role="radiogroup" aria-label="Accent preset">
              {THEME_PRESETS.map((p) => {
                const sw = PRESET_SWATCHES[p];
                return (
                  <button
                    key={p}
                    role="radio"
                    aria-checked={preset === p}
                    className={`preset-swatch${preset === p ? ' active' : ''}`}
                    onClick={() => setPreset(p)}
                    title={`${sw.label} — light ${sw.light}, dark ${sw.dark}`}
                  >
                    <span
                      className="preset-dot"
                      style={{ background: `linear-gradient(135deg, ${sw.light} 0 50%, ${sw.dark} 50% 100%)` }}
                    />
                    <span className="preset-name">{sw.label}</span>
                  </button>
                );
              })}
            </div>
            <span className="settings-hint">
              Each accent has its own <em>light</em> and <em>dark</em> palette — it combines with the theme above.
            </span>
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
