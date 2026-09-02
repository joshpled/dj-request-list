# DJ Request List

An installable mobile guest request app with a PIN-protected DJ dashboard. This branch prepares the app for Cloudflare Workers with a D1 database in the owner's Cloudflare account, independent of OpenAI Sites.

**Migration status: prepared locally, not published.** The original Sites version remains on `main` and has not been changed. The intended new address is `https://dj-request-list.joshuapleduc.workers.dev`; it is not live yet. No domain purchase is required for this address.

## Local development

Requires Node.js 22.13 or newer. Use the included lockfile:

```bash
npm ci
cp .dev.vars.example .dev.vars
```

Set `INITIAL_ADMIN_PIN` in the ignored `.dev.vars` file to a private 4–12 digit PIN, then start the app:

```bash
npm run dev
```

Open `/admin` on the local URL printed by the development server. There is no default PIN: new event initialization fails without a valid `INITIAL_ADMIN_PIN`. The initial value does not replace the PIN in an existing database. Change that PIN from **Event settings**.

The dashboard provides the private guest link and its QR code after sign-in. Local development uses project-local Cloudflare emulation; it does not copy the live event database.

## Features

- Private guest route with online title/artist search, scrollable suggestions, automatic artist fill, manual entry, and an optional reason; no guest name required
- Clear confirmation, per-device request limit, duplicate protection, cooldown, and honeypot
- Automatically refreshed DJ queue with search, sorting, and New / Played filters
- **Played** keeps a request on the list; **Clear**, then **Clear?**, removes it without marking it rejected
- Editable event name, per-device request limit, and closing time
- PIN hashing, rate-limited login, signed secure sessions, and PIN rotation
- Web app manifest, app icons, service worker, offline fallback, iOS instructions, and Android install prompt
- Cloudflare Worker configuration, D1 schema, and schema-only migration

## Validation

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:integration
npm run cf:dry-run
```

The integration suite runs the compiled app in a local Cloudflare runtime with an ephemeral database and a mocked music catalog. It checks authentication, request submission, duplicates, limits, closing time, Played/Clear, PIN changes, and catalog query handling. Installation assets and existing UI controls are checked from source; this is not a physical iPhone/Android installation test or a live catalog availability test.

The compatibility date is pinned to `2026-05-22`, supported by the locked local runtime. Upgrade the runtime dependencies and date together, then repeat these checks. Regenerate binding types with `npm run cf:types` after changing `wrangler.jsonc`.

## Publishing checklist — requires owner approval

Do not deploy until the owner says **Publish**. There is no automatic deployment workflow. Pushing this branch to GitHub does not publish it.

1. Confirm access to the intended Cloudflare account and that `dj-request-list` does not overwrite an existing Worker. The connected plugin's account access does not automatically sign the local Wrangler CLI in. Complete any required deployment authorization without copying OAuth tokens into files.
2. Create a new D1 database named `dj-request-list`. Add its returned `database_id` to the `DB` binding in `wrangler.jsonc`. Keep `remote: false` so development uses local data.
3. Apply the schema-only migration in `drizzle/0000_sweet_white_queen.sql` to that new, empty database. Do not reuse the historical credential migration from the Sites branch.
4. Arrange a cutover snapshot of the existing event settings and song requests. Keep any export in ignored `private-data/`, outside published assets, with restricted file permissions. Do not commit exports, print their contents, or include them in logs.
5. Import the existing event settings and song requests into the new database, preserving request IDs and the guest token. Preserve the current PIN hash and salt only after checking that they differ from the legacy setup credentials in repository history; otherwise require a new private PIN for the new deployment. Generate a fresh cryptographically random `session_secret` and increment `pin_version` before importing settings; never reuse the old session secret. Do not transfer login-attempt records. Verify row counts and settings before directing guests to the new site.
6. Configure a private `INITIAL_ADMIN_PIN` as a Cloudflare secret for safe initialization; an imported existing event keeps its current PIN. Do not put the PIN into source, configuration, shell history, or GitHub. The build's missing-secret warning is expected before this step.
7. Rebuild and dry-run, then deploy the compiled Worker and static assets using the new account/database only. Validate the public pages, PIN login, catalog, request submission, queue changes, and Home Screen behavior on the new origin. Use identifiable test requests and remove only those test requests afterward.
8. Copy the new guest link and regenerate the QR code from the new dashboard. Installed Home Screen shortcuts must be added again because the origin changes. Browser/device cookies also restart, so per-device limits do not carry across origins. The two sites will not synchronize; use the new link for the event after cutover.

Keep the old site as a fallback until the owner approves retiring it. Do not change the wedding-camera app. This branch contains no live event export, and no event data has been transferred yet.

## Hosting and privacy

`wrangler.jsonc` owns the new deployment configuration; the Sites association and Sites build plugin are removed only on this migration branch. Worker secrets and the hosted database are managed separately from GitHub. This server-backed app needs its Worker runtime and D1 database; GitHub Pages alone cannot run it.

Do not commit `.env*`, `.dev.vars*` (except the blank example), private PINs, session secrets, live guest tokens, database exports, or recordings. This private repository's prior history contains legacy setup credentials: keep the repository private and do not reuse those credentials for the new deployment. The wedding-camera app and the separate presentation/video project are not part of this repository.
