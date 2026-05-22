# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server (HMR)
npm run build     # Production build
npm run lint      # ESLint check
npm run preview   # Preview production build locally
```

No test framework is configured.

## Architecture Overview

This is a Korean TV broadcast draft-scheduling SPA (방송 편성 작업판) built with React 19 + Vite. Multiple users collaborate in real time on a weekly broadcast schedule.

### Data Flow

```
Google Apps Script (GAS) API
  → Firebase Realtime Database  (persistent, shared)
    → Zustand store (useScheduleStore)
      → React components
```

**Session key**: `{startDate}_{poolType}` (e.g. `2024-01-08_A`). Every Firebase path is scoped under `sessions/{weekKey}/`.

**First load**: `sessionActions.loadInitData` checks if `sessions/{weekKey}/gasData/meta` exists. If not, it calls GAS to fetch fresh data, writes it to Firebase, then calls `_loadFromFirebase`. If the key exists, it reads from Firebase directly.

**Real-time sync**: After loading, `subscribeRealtimePaths` attaches Firebase `onValue` listeners on five paths (`scheduleBlocks`, `splitSlots`, `starred`, `scheduledItemIds`, `manualInputs`), so edits by any user are reflected live for all.

### Store (`src/store/`)

`useScheduleStore` (Zustand) composes four action slices:

| File | Responsibility |
|---|---|
| `actions/sessionActions.js` | Load/reset weekly session, Firebase subscribe |
| `actions/blockActions.js` | Save/remove/copy schedule blocks |
| `actions/itemActions.js` | Schedule sidebar proposal items into blocks |
| `actions/refreshActions.js` | Re-fetch perfMap, proposals, pre-schedule from GAS |
| `helpers/blockBuilders.js` | Pure builder functions for slots and blocks |
| `helpers/firebaseSubscribe.js` | Manages active Firebase listeners |

**perfMap encoding**: Firebase disallows `[` and `]` in keys. `blockBuilders.js` encodes them as `__LB__`/`__RB__` before writing and decodes on read (`encodePerfMap`/`decodePerfMap`).

### External APIs

- **GAS** (`src/api/gas.js`): Single Google Apps Script endpoint. Called for `init` (pgmSlots, proposalItems, preScheduleRows, perfMap) and `refreshPerformance`. Data is cached in Firebase after first fetch.
- **Firebase** (`src/api/firebase.js`): Firebase Realtime Database (asia-southeast1). Config is embedded directly in the file.

### Pages & Components

Five tabs in `App.jsx`: 초안 편성 (`DraftSchedule`), 실적 예상값 (`PerformanceForecast`), 편성비중 (`ScheduleRatio`), 편성현황 (`ScheduleStatus`), 설명서 (`HelpPage`).

Key component groups:
- `components/schedule/` — `ScheduleGrid`, `SlotRow`, `SlotCell`, `ScheduleBlock` (drag-drop grid via @dnd-kit)
- `components/sidebar/` — `Sidebar`, `ProductCard` (proposal items draggable into grid)
- `components/modal/` — `SetupModal` (new session), `BlockEditModal`
- `components/common/` — `ChatPanel` (Firebase-backed), `PresenceBar`, `ExportModal`

### Channels

Three broadcast channels: `CA`, `IP`, `ALL`. A slot can be split into CA + IP sub-blocks; block keys for split slots are `{slotId}_CA` / `{slotId}_IP`.

### Styling

All styling is inline (`style={{}}`). Theming uses CSS custom properties (`--bg`, `--accent`, `--ca`, `--ip`, `--all`, etc.) set on `document.documentElement` by `src/styles/theme.js`. Light/dark preference is persisted in `localStorage`.

### Collaboration Features

- **Presence**: `usePresence` hook writes/cleans up the user's entry under `sessions/{weekKey}/presence/{uid}` on mount/unmount.
- **Chat**: `useChat` hook reads/writes `sessions/{weekKey}/chat`.
- **Action log**: Every block save/delete/schedule calls `_writeLog`, writing to `sessions/{weekKey}/logs/log_{timestamp}`.
