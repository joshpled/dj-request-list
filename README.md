# DJ Request List

An installable mobile guest request app with a PIN-protected DJ dashboard. The app is separate from the wedding-camera project and is configured for OpenAI Sites with D1 persistence.

## Local development

Requires Node.js 22.13 or newer. Use the included lockfile:

```bash
npm ci
npm run dev
```

Open `/admin` on the local URL printed by the development server. A new database uses `INITIAL_ADMIN_PIN` when configured, otherwise the development fallback PIN is `2468`. Configure a private `INITIAL_ADMIN_PIN` through Sites before initializing any new hosted database; never rely on the fallback for a live event. The initial value does not replace the PIN in an existing database. Change that PIN from **Event settings**.

The dashboard provides the private guest link and its QR code after sign-in. Local development uses project-local Cloudflare emulation; it does not copy the live event database.

## Features

- Private guest route with online title/artist search, scrollable suggestions, automatic artist fill, manual entry, and an optional reason; no guest name required
- Clear confirmation, per-device request limit, duplicate protection, cooldown, and honeypot
- Automatically refreshed DJ queue with search, sorting, and New / Played filters
- **Played** keeps a request on the list; **Clear**, then **Clear?**, removes it without marking it rejected
- Editable event name, per-device request limit, and closing time
- PIN hashing, rate-limited login, signed secure sessions, and PIN rotation
- Web app manifest, app icons, service worker, offline fallback, iOS instructions, and Android install prompt
- D1 schema and migrations for Sites hosting

## Validation

```bash
npm run lint
npm run build
```

## Hosting and data

The app is hosted on Sites. `.openai/hosting.json` retains the existing project association and logical `DB` binding. Hosting secrets and the live database are managed separately; they are not included in this repository.

This repository is a source-code copy, not a database backup. Uploading to GitHub does not publish or update the live site. This server-backed app needs its Worker runtime and D1 database; GitHub Pages alone cannot run it.

Do not commit `.env*`, `.dev.vars*`, private PINs, session secrets, live guest tokens, database exports, or recordings. The wedding-camera app and the separate presentation/video project are not part of this repository.
