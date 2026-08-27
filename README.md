# DJ Request List

An installable mobile guest request app with a PIN-protected DJ dashboard. The app is separate from the wedding-camera project and is configured for OpenAI Sites with D1 persistence.

## Local preview

```bash
npm install
npm run dev
```

Open `/admin`. Local preview uses setup PIN `2468`; production uses the private PIN supplied at publish time. Change the PIN from **Event settings** whenever needed. The dashboard generates the private guest link and its QR code after sign-in.

## Included in version one

- Private guest route with local song autocomplete, automatic artist fill, manual entry, and an optional reason
- Clear confirmation, per-device request limit, duplicate protection, cooldown, and honeypot
- Live DJ queue with search, sort, and New / Approved / Played / Declined statuses
- Editable event name, welcome message, request limit, and closing time
- PIN hashing, rate-limited login, signed secure sessions, and PIN rotation
- Web app manifest, app icons, service worker, offline fallback, iOS instructions, and Android install prompt
- D1 schema and generated migration for Sites hosting

The app has not been published. Publishing is intentionally reserved for an explicit `Publish` instruction.
