# Gym Tracker

A personal Progressive Web App to log gym workouts and body measurements during a 12-week Upper/Lower plan. It works offline: all data lives on your phone.

- **Log sets** one at a time, with weight and reps, plus a rest timer.
- **Suggestions** for when to add or lower weight, based on your last session.
- **Progress charts** for body weight, waist, and each exercise.
- **Backups:** export a JSON file, or connect Dropbox for an automatic copy after each session.

The routine is defined in `public/plan.json`. The original plan (in Spanish) is in `docs/rutina-gym-upper-lower.md`.

## Install on iPhone

1. Open the app in Safari.
2. Tap **Share → Add to Home Screen**.
3. Open it from the home screen. Data is stored per app, so use the same one every time.

## Development

Requirements: Node.js (LTS).

```bash
npm install
npm run dev      # local dev server, exposed on your network
npm test         # domain tests (node --test)
npm run build    # type-check and production build into dist/
npm run preview  # serve the production build
```

The app is deployed to GitHub Pages at `https://luiscrjs.github.io/gym/` on every push to `main` (see `.github/workflows/deploy.yml`). The base path `/gym/` is set in `vite.config.ts`.

## Project layout

```
public/plan.json     routine template
src/cloud/           Dropbox connection and sync
src/db/              the only code that touches IndexedDB (Dexie)
src/domain/          pure logic: rotation, progression, units, backups (tested)
src/screens/         Home, Session, Measurements, Progress, Settings, Welcome
src/components/      reusable UI pieces
src/version.ts       app version
```

See `CLAUDE.md` for the data model, domain rules, and project conventions.

## Versions

Every merge into `main` is a new version, tagged `vX.YY` with a GitHub release. The current version is shown in **Settings → Aplicación** and at the bottom of **Inicio**.

## Backups and data

- Importing a backup **replaces all data** on the phone. The app shows a summary first and keeps a copy of the previous data, so you can undo the import from Settings.
- iOS may delete a site's data if it is not installed and unused for a long time. Install the app and keep a recent backup.
