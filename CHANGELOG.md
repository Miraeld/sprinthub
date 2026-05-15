# Changelog

All notable changes to SprintHub will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2026-05-15

### Added
- **Settings dropdowns** — Organization and Project fields in the settings modal now load as smart dropdowns. Opening the modal fetches the user's GitHub orgs and personal login automatically; selecting an owner immediately loads that owner's Projects v2 by name. Falls back to manual text input if the list is empty or loading. (#13)

### Fixed
- **Search bar** — Typing in the search box now correctly filters the Dashboard tab (LaunchpadView) and linked PRs. Previously the dashboard bypassed the filtered data entirely. (#12)
- **Sprint filter** — Clearing the sprint filter no longer causes it to reselect itself on the next auto-refresh. The first sprint is still auto-selected on the very first panel open, but explicit user choices (including "show all") are respected from that point on. (#14)
- **Detail panel — light theme** — Multiple elements had no light-theme overrides and inherited dark-mode colors illegible on the light background: description body, metadata values, branch pill, section dividers, review chips, and sprint/milestone badges are all now readable. (#15)
- **Detail panel — stale state on refresh** — The detail panel no longer shows stale body content after a background board refresh changes a card's `updatedAt`. The body is now re-fetched automatically. Panels for closed or merged linked PRs now close instead of freezing on stale open state. (#6)

### Performance
- Issue and PR body text is cached by `itemId:updatedAt` to avoid redundant fetches when reopening the same card. (#4)
- Search input is debounced (150 ms) to avoid filtering on every keystroke. (#7)
- Board data is not reloaded when only cosmetic settings (theme, color-blind mode) change. (#5)

## [1.0.0] - 2026-05-01

### Added
- Sprint filter persists across tab switches and panel reopens via `vscodeApi.setState`. (#3)
- Liquid glass is now the only visual mode; theme toggle (dark / light) and color-blind mode remain configurable. (#8)
- Webview CSS externalized to `out/styles.css` for a cleaner build pipeline with Tailwind v4. (#9)

---

*Earlier development history is available in the [git log](https://github.com/Miraeld/sprinthub/commits/develop).*
