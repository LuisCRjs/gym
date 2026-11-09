# CLAUDE.md — Gym Tracker (Hefesto project)

Personal PWA to log gym workouts and body measurements during a 12-week Upper/Lower plan. The original routine is in `docs/rutina-gym-upper-lower.md` (in Spanish).

---

## 1. How to work on this project

- Act as a development partner: if you see a gap, a contradiction, or unnecessary complexity, say so before coding.
- The owner studies Systems Engineering and maintains the project alone. **Prefer the simplest solution.** If you propose something complex, justify it.
- When you use a concept or API the owner may not know (IndexedDB, service workers, Web Share API, Dropbox OAuth), explain it in 2–3 lines, just enough to follow.
- Work in small, verifiable steps. One step = something that can be tested on the phone.
- **Do not redesign what is in "Decided"** (section 9) unless asked. If a change affects a decided item, call it out explicitly.
- Do not add screens, modules, dependencies, or features outside this document without asking.
- Ready-to-use code, no filler. Talk to the owner in Spanish. Code, identifiers, commits, pull requests, and documentation are in English. UI text stays in Spanish.

---

## 2. Usage context

- Main use: **iPhone, at the gym**, one-handed, between sets.
- Priority: **work offline** and **do not use data**. Everything runs on the phone.
- Users: the owner and maybe one friend. **Each person on their own phone = their own data.** No accounts, no login on the app itself.

---

## 3. Stack

| Part | Choice |
|---|---|
| Base | Vite + React + TypeScript |
| Data | Dexie.js (IndexedDB wrapper), read and written only through `src/db/` |
| PWA | vite-plugin-pwa (manifest + service worker, precached app, `registerType: 'prompt'`) |
| Charts | Chart.js |
| Backup | Dropbox (app folder, OAuth PKCE, no client secret) |
| Hosting | GitHub Pages, deployed by GitHub Actions on push to `main` |
| Backend | **None.** |

Keep dependencies to a minimum. No heavy UI libraries, complex routers, or global state managers while React and hooks are enough.

---

## 4. Project structure

```
public/
  plan.json              # routine template (exercises + slots), copied into IndexedDB on every start
src/
  cloud/                 # Dropbox connection (dropbox.ts) and automatic sync (sync.ts)
  db/                    # ONLY place that touches Dexie
    db.ts                # table definitions and migration notes
    repo.ts              # saveWorkout, getLastEntry, importBackup, undo copy...
    backup-file.ts       # save a backup file via the iOS share sheet
  domain/                # pure logic, no React or Dexie (easy to test)
    rotation.ts          # next session
    progression.ts       # weight up/down suggestion
    plan-week.ts         # plan week, deload
    units.ts             # kg/lb conversion, STEP
    backup.ts            # backup summary, staleness
    entry.ts, progress.ts
  screens/               # Welcome, Home, Session, Measurements, Progress, Settings
  components/            # steppers, rest timer, rings, update prompt, charts
  version.ts             # APP_VERSION, shown in Ajustes and Inicio
```

**Key rule:** screens never call Dexie directly; they use `src/db/repo.ts`. Moving to another storage would only change that folder.

---

## 5. Data model

```ts
// ---------- TEMPLATE (loaded once from plan.json) ----------
type SessionKey = 'UPPER_A' | 'LOWER_A' | 'UPPER_B' | 'LOWER_B' | 'UPPER_C';
type Unit = 'kg' | 'lb' | 'pin';   // pin = "barrita": plate position on machines without a marked weight

interface Exercise {
  id: string;                      // 'press-plano'
  name: string;
  metric: 'reps' | 'seconds';      // plank = seconds
  defaultUnit: Unit;
  defaultPerSide: boolean;         // true for barbell with plates
  unilateral?: boolean;            // reps per leg/arm (split squat)
}

interface TemplateSlot {
  sessionKey: SessionKey;
  order: number;                   // 1..7
  exerciseIds: string[];           // 1 or more options
  sets: number;
  repMin: number;
  repMax: number;
  restSec: number;
  short: boolean;                  // part of the short session
  note?: string;
}

// ---------- RECORDS ----------
interface Workout {
  id: string;
  sessionKey: SessionKey;
  mode: 'full' | 'short';
  startedAt: number;               // ms timestamp
  finishedAt?: number;             // undefined = session in progress
  entries: Entry[];                // embedded on purpose
}

interface Entry {
  exerciseId: string;              // chosen option
  unit: Unit;                      // copy of what was used that day
  perSide: boolean;
  repMin: number;                  // copy of the template that day
  repMax: number;
  sets: { weight: number; value: number; done: boolean }[];  // value = reps or seconds
}

interface Measurement {
  id: string;
  date: string;                    // 'YYYY-MM-DD'
  type: 'weight' | 'waist';
  value: number;                   // kg or cm
}

// ---------- SETTINGS (one row) ----------
interface Settings {
  planStartDate: string;           // 'YYYY-MM-DD', defines week 1
  includeUpperC: boolean;
  lastBackupAt?: number;
}

// ---------- CONSTANTS (in code, not in the database) ----------
const STEP: Record<Unit, number> = { kg: 2.5, lb: 5, pin: 1 };
const KG_TO_LB = 2.2046;
```

**Dexie tables:** `workouts`, `measurements`, `settings`, `plan`.

**Local-only values (not in the backup):** the Dropbox refresh token, the time of the last cloud upload, and the undo copy. They live in `localStorage` on each phone.

**Why `entries` is embedded in `Workout`:** about 55 sessions in 12 weeks; reading them all is instant. Each session is one object, the JSON backup is trivial, and there are no joins. Do not normalize.

**Model principles:**
1. The routine is **data** (`plan.json`), not code.
2. Records **copy** what matters from the template (rep range, unit) so changing the template does not break history.
3. **Anything calculable is not stored** (next session, week, deload, suggestions, averages, last chosen option).

---

## 6. Domain rules

| Topic | Rule |
|---|---|
| **Next session** | Take the last finished `Workout` and advance in the cycle `UPPER_A → LOWER_A → UPPER_B → LOWER_B → (UPPER_C if includeUpperC) → UPPER_A`. No history: `UPPER_A`. Missing a session does not "recover" anything. A short session counts the same as a full one. |
| **Session in progress** | If a `Workout` has no `finishedAt`, Home offers to continue it. |
| **Plan week** | `floor((today − planStartDate) / 7 days) + 1`, by calendar. |
| **Deload** | Weeks 6 and 12: half the sets (rounded up), same weight, **no** weight-up suggestion. Home warns about it. |
| **Weeks 1–2** | Adaptation: the app may show "3 in reserve" as a reminder. No extra logic. |
| **Short version** | Only slots with `short = true`. |
| **Preloaded values** | Each exercise preloads unit, perSide, weight, and reps from its last `Entry`. No history: the `Exercise` defaults. |
| **Chosen option** | Preloads the option chosen last time in the same `sessionKey` (inferred from history). |
| **Weight up** | If in the last session of an exercise **all** sets reached `repMax` → suggest `weight + STEP[unit]` and go back to `repMin`. |
| **Weight down** | If `repMin` was missed in 2 consecutive sessions → suggest lowering 5–10% (in `pin`: −1). |
| **Unit change** | kg ↔ lb converts in history and charts. `pin` does not convert: moving an exercise to or from `pin` starts a new chart series and there is no suggestion until a session in the new unit exists. |
| **Bodyweight** | Weight 0 = bodyweight (pull-ups). Positive value = added load. |
| **Body weight log** | Logged whenever (daily); the chart shows the weekly average. |
| **Waist** | Logged weekly. |
| **Backup staleness** | A backup is "stale" when a session finished after the last backup. Home then offers to save one. |
| **Cloud upload safety** | A phone with zero finished sessions never uploads, so an empty database cannot replace a good cloud copy. |

---

## 7. Screens

Bottom navigation: **Inicio · Medidas · Progreso · Ajustes.** The Session screen opens from Home.

| Screen | Content | Usage notes |
|---|---|---|
| **Welcome** (first run only) | Install guide for iOS (Share → Add to Home Screen), plan start date, include Upper C? | Detect standalone mode (`display-mode: standalone`) and insist on installing if not. |
| **Home** | Week X of 12, next session, **Completa** / **Corta ⭐** buttons, small link to pick another session, last session, notices (deload, stale backup, session in progress), quick link to measurements, app version. | One tap to start. |
| **Session** | One exercise per screen: name, set N/M, rep range, collapsible technique note, option picker when a slot has several, weight with +/−, unit picker kg/lb/barrita, reps (or seconds) with +/−, ✓ button, rest timer, weight suggestion line, previous/next. | Large buttons. **Save every set when ✓ is tapped** (not at the end). The rest timer starts on ✓. |
| **Measurements** | Log weight and waist (date = today by default) + history with delete. | Two fields and a button. |
| **Progress** | Charts: waist, weight (weekly average), progression per exercise (exercise picker). | Lightweight. |
| **Settings** | Export / import backup, last backup date, Dropbox connection (connect, upload now, restore, disconnect), persistent-storage status, app version and "check for update", include Upper C, plan start date. | Import shows a summary of the file and keeps an undo copy. |

**Timer:** store the end time (`endsAt`) and compute the remaining time against `Date.now()`, do not count with `setInterval`, so it does not drift when the app goes to the background. On iOS it does **not** sound or vibrate with the screen locked; v1 is visual only.

**Layout:** the document does not scroll. Each screen scrolls inside `main.scroll`, and the tab bar is part of the flex column. Do not reintroduce fixed or sticky bars that overlap the session buttons.

---

## 8. iOS, storage, and updates

- Safari may delete a site's storage after ~7 days without visits, **unless the PWA is installed** on the home screen. The app requests `navigator.storage.persist()` at startup and shows the result in Settings; iOS may still refuse.
- Protection layers:
  1. Welcome screen with the install guide.
  2. Export a JSON backup with the Web Share API (save to Files / iCloud Drive). If Web Share is unavailable, download the file.
  3. Automatic Dropbox copy after finished sessions (see section 8.1).
  4. Home warns when a session was finished without a backup, and when the last backup is 7+ days old.
  5. Import from file, with a confirmation that summarizes the file and an undo copy.
- Backup format: `{ schemaVersion, exportedAt, settings, workouts, measurements }`. `schemaVersion` allows migrating old backups when the model changes. Importing a backup **replaces all data**.
- The template (`plan`) is not in the backup: it is reloaded from `plan.json`.

### 8.1 Dropbox

- Uses the **App folder** permission (only `files.content.read` and `files.content.write`), so the app sees only its own folder.
- OAuth **PKCE** with `token_access_type=offline`: the refresh token does not expire, so there is no hourly re-login. The access token is cached in memory only.
- One file, `/gym-tracker.json`, overwritten on each upload. Dropbox keeps the version history.
- The connection finishes at startup in `src/main.tsx`, because Dropbox returns to the root URL.
- If the refresh token is revoked, the app disconnects and asks the user to reconnect.
- Known risk: on iOS, the sign-in may open in Safari, and the PKCE verifier lives in the PWA's storage. If the return lands in a different storage, the connection fails with a message.

### 8.2 Updates

- The service worker uses `registerType: 'prompt'`. A new version is downloaded and waits.
- `UpdatePrompt` shows **Actualizar** / **Después**. "Después" silences the prompt only for the running version.
- Settings → **Buscar actualización** asks the browser to check and offers **Actualizar ahora** when a version is waiting.
- The app never reloads on its own during a session. Each set is already saved in IndexedDB.

### 8.3 Changing the data model

- **Never change a published Dexie version.** Add `db.version(n + 1)` with an `.upgrade()` that transforms existing records. The migration steps are written in `src/db/db.ts`.
- Bump `schemaVersion` in `repo.ts` when the backup format changes, and keep importing older files.
- Every migration needs a test that opens a database from the previous version.

---

## 9. Status

### Decided
- PWA, local-first. Everything works offline on the phone. Dropbox is an optional copy, not a server.
- No backend, no accounts. One phone = one user.
- Data model in section 5 (`entries` embedded, units per exercise).
- Weight on a barbell is recorded **per side**; no total-weight calculation (bar + plates).
- Units kg / lb / barrita (`pin`) per exercise, remembered from history.
- Exercise catalog **fixed in v1**, loaded from `plan.json`, no editing screen.
- Plan week and deload are **calendar-based**.
- Five screens + welcome, section 7.
- JSON backup + Web Share API + backup-staleness warning + Dropbox copy.
- Charts with **Chart.js**.
- Importing a backup **replaces everything**, after a summary and confirmation. Undo is available until the next import.
- Provisional app name: **Gym Tracker**.
- Node is installed with **nvm** (per user, no sudo).

### Done
- Plan template, domain logic with tests, all screens, backup and import, Dropbox copy, update prompt, data-safety features.

### Ideas (do not build without asking)
- Sync with several devices, or a sharing feature for a friend.
- Rest-timer alert with the screen locked (needs a native app).
- Tailwind / shadcn/ui for the interface (optional, screen by screen).

---

## 10. Process

- Branch from `main` for every change: `feat/...`, `fix/...`, `chore/...`, or `docs/...`.
- Commit messages, PR titles, and PR descriptions in English.
- **Every merge is a new version.** Bump `APP_VERSION` in `src/version.ts` in the same PR (`1.04` → `1.05`, and so on), then after merging create an annotated tag `vX.YY` on the merge commit and a GitHub release with the same version.
- Before merging: `npm run build` and `npm test` must pass. Features that depend on iOS (install, update, Dropbox sign-in) are verified on the phone after publishing.
