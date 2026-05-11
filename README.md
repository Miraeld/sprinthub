# SprintHub

**Your GitHub sprint board and PR hub — right inside VS Code.**

Stop switching between VS Code and the browser 30 times a day. SprintHub brings your GitHub Projects v2 board, pull request statuses, CI results, and sprint progress into a single panel where you already work.

---

## Why SprintHub?

Most teams manage their sprint in GitHub Projects and their code in VS Code — but checking issue status, reviewing PRs, and tracking CI means constantly jumping to the browser. SprintHub closes that gap.

- ✅ See your full sprint board without leaving VS Code
- ✅ Know instantly which PRs need your attention
- ✅ Track CI pass/fail per PR at a glance
- ✅ Filter everything by sprint in one click
- ✅ Stays in sync — auto-refreshes in the background

---

## Features

### 🚀 Dashboard (main tab)
A high-signal PR hub that shows exactly what needs action. Every open pull request — including PRs linked to board issues — grouped by status:

| Group | What it means |
|---|---|
| **Ready to Merge** | Approved + all checks passing — just needs a merge |
| **Changes Requested** | A reviewer asked for changes |
| **CI Failing** | One or more checks are red |
| **Ready for Review** | Awaiting a reviewer |
| **Needs Review** | No one assigned to review yet |
| **In Progress** | Actively being worked on |
| **Draft** | Not ready for review yet |

**"Assigned to me" filter** — one click to see only PRs you authored, are assigned to, or are requested to review.

### 📋 Main Board
Full Kanban view of your GitHub Project v2. Filter by sprint, search by keyword, click any item to read its full description and comments — all without opening a browser tab.

### 🏁 Milestones
Browse all milestones and drill into the issues attached to each one.

### ⚙️ Settings
Configure everything from inside the extension. No digging through VS Code settings JSON.

---

## Setup (takes 2 minutes)

1. Install SprintHub
2. Click the **SprintHub icon** in the VS Code activity bar
3. Click **Open SprintHub**
4. Click the **⚙️ icon** (top-right) to open Settings
5. Enter:
   - **Owner** — your GitHub org or username
   - **Project number** — the number in your GitHub Project URL (`/projects/42` → `42`)
   - **Owner type** — Organization or User
6. Hit Save — your board loads instantly

> SprintHub uses your existing VS Code GitHub authentication. No extra login required.

---

## Requirements

- VS Code 1.85 or newer
- GitHub account signed in through VS Code
- A [GitHub Project v2](https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/about-projects) (classic Projects v1 are not supported)

---

## Settings Reference

| Setting | Default | Description |
|---|---|---|
| `sprinthub.owner` | `""` | GitHub org or username |
| `sprinthub.projectNumber` | `0` | GitHub Project v2 number |
| `sprinthub.ownerType` | `"organization"` | `"organization"` or `"user"` |
| `sprinthub.statusFieldName` | `"Status"` | Name of your board's status field |
| `sprinthub.refreshInterval` | `5` | Auto-refresh in minutes (0 = off) |
| `sprinthub.colorBlind` | `false` | Replaces red/green with orange/blue |
| `sprinthub.liquidGlass` | `false` | Frosted-glass UI style |

---

## Tips

**Sprint filter** — select a sprint in the toolbar to filter the board and dashboard simultaneously.

**Linked PRs** — the Dashboard finds PRs linked to your board issues even when the PR itself isn't on the board. Works with `Fixes #N`, `Closes #N`, `Resolves #N` in the PR body.

**CI dots** — each PR row shows a colored dot: 🟢 passing, 🔴 failing, 🟡 pending, ⚪ no CI.

**Color-blind mode** — enable in Settings to replace all red/green signals with orange/blue.

---

## Privacy

SprintHub reads data exclusively from GitHub using your VS Code GitHub session token. No data is sent to any third-party service. All requests go directly to `api.github.com`.

---

## Feedback

Found a bug or have a feature idea? [Open an issue](https://github.com/gaelrobin/sprinthub/issues) — contributions welcome!
