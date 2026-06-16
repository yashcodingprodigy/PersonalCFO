# PayWatch mobile apps (Android + iOS)

PayWatch ships to the app stores with **Capacitor**: the web UI is statically
exported and bundled into a native app that talks to the live API
(`https://api.paywatch.in/v1`). Same codebase, same screens — wrapped natively
with biometric lock, splash, haptics and push.

- **App ID:** `in.paywatch.app` · **App name:** PayWatch
- Config: `capacitor.config.ts` · native bridge: `src/lib/native.ts`
- Mobile build = `BUILD_TARGET=mobile next build` → static export in `web/out/`

---

## 1. Prerequisites (one time)

- **Node 18+** and this repo installed (`cd web && npm install`)
- **Android:** [Android Studio](https://developer.android.com/studio) + JDK 17
- **iOS (Mac only):** Xcode 15+, and CocoaPods (`sudo gem install cocoapods`)

## 2. Add the native platforms (one time)

```bash
cd web
npx cap add android
npx cap add ios          # Mac only
```

This creates `web/android/` and `web/ios/` (commit them, or keep them generated —
your choice; committing makes CI easier).

## 3. Point the app at the live API

The API URL is baked in at build time. Set it for the mobile build:

```bash
# web/.env.production (or export before building)
NEXT_PUBLIC_API_URL=https://api.paywatch.in/v1
```

The server already allows the Capacitor origins (`capacitor://localhost`,
`http(s)://localhost`) in CORS, so no API change is needed.

## 4. Generate icons & splash

Source art lives in `web/assets/` (`icon.png` 1024², `splash.png` 2732²). Replace
with designed art anytime, then:

```bash
npm run cap:assets        # generates every platform icon/splash size
```

## 5. Build, sync, run

```bash
npm run cap:android       # build:mobile → cap sync → opens Android Studio
npm run cap:ios           # build:mobile → cap sync → opens Xcode (Mac)
```

Then press Run in Android Studio / Xcode to launch on a device or emulator.
After any web change, re-run `npm run cap:sync` (or the `cap:*` script).

---

## 6. Native features (already wired in `src/lib/native.ts`)

- **Biometric app-lock** — Face ID / fingerprint on launch & resume (`@aparajita/capacitor-biometric-auth`). Falls open if no biometrics are enrolled so users aren't locked out.
- **Splash screen, status bar, haptics** — themed to the brand.
- **Push registration** — the app requests permission, registers, and POSTs the device token to `/user/push-token` (stored in `device_tokens`).

### Finishing push delivery (Firebase Cloud Messaging)

Token capture and the server cron hook are done; delivery needs a Firebase project:

1. Create a Firebase project; add an Android app (`in.paywatch.app`) and an iOS app.
2. Android: download `google-services.json` → `web/android/app/`.
3. iOS: download `GoogleService-Info.plist` → add to the Xcode project; upload your **APNs key** in Firebase → Cloud Messaging.
4. Install the FCM Capacitor plugin or use `@capacitor/push-notifications` (already installed) with Firebase.
5. Server: install `firebase-admin`, init it, and complete `server/src/adapters/push.ts` `sendPush()` (the integration point is marked). Set the relevant env so `config.fcmServerKey` is non-empty. The cron (`POST /v1/cron/run`) then pushes urgent alerts to each device.

Until that's done, push runs in **log mode** (visible in Railway logs) and the
in-app Alerts + email digests already work.

---

## 7. Store submission

Both stores require an **organisation developer account + a D-U-N-S number**
(PayWatch is a finance app). Start the D-U-N-S request early.

**Google Play** ($25 one-time): create the app, set the **Finance** category,
complete the Data Safety form, upload a signed `.aab` (Android Studio →
Build → Generate Signed Bundle), add screenshots + privacy policy
(`https://paywatch.in/legal/privacy`).

**Apple App Store** ($99/yr): create the App ID + app in App Store Connect,
fill the Privacy "nutrition labels", set Finance category, archive in Xcode
(Product → Archive) and upload. You have a live website + matching-domain
email, which Apple requires.

**Both:** bump the version in `capacitor.config.ts` / native projects per
release, and keep the SEBI-education positioning in the listing (no "investment
advice" claims).

---

## 8. Gotchas

- **Change `NEXT_PUBLIC_API_URL`?** Rebuild (`cap:sync`) — it's compile-time baked.
- **Web (Vercel) build unaffected:** `next build` (no `BUILD_TARGET`) keeps the
  normal server build with security headers; only `BUILD_TARGET=mobile` switches
  to static export. The Capacitor imports are SSR-safe; if a Vercel build ever
  errors on them, switch `src/lib/native.ts` imports to dynamic `await import()`.
- **CORS:** if you change the API domain, make sure native origins stay allowed
  (handled in `server/src/index.ts`).
