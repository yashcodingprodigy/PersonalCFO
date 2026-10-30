# PayWatch — native iOS & Android app

A real native app (React Native + Expo SDK 58, expo-router), not a web wrapper. It talks to the same API as the
web app (`https://api.paywatch.in/v1`), so every account, dream, document and conversation is shared.

## Run it on your phone (development)

Run these on your Mac, inside this `mobile/` folder:

```bash
npm install
npx expo install --fix     # aligns every package to the exact SDK 58 versions
npx expo start             # then press i (iOS simulator) or a (Android emulator)
```

Voice, Face ID and file pickers need a **development build** (they aren't in Expo Go):

```bash
npm install -g eas-cli && eas login
eas build --profile development --platform android   # installs like a normal APK
eas build --profile development --platform ios       # needs an Apple developer account
```

Point it at another API with `EXPO_PUBLIC_API_URL=http://<your-mac-ip>:4000/v1 npx expo start`.

## Store builds

```bash
eas build -p android --profile production   # .aab for Google Play
eas build -p ios --profile production       # .ipa for App Store
eas submit -p android                        # then: eas submit -p ios
```

Before the first iOS submit, replace `ascAppId` in `eas.json` with the App Store Connect app ID.

## What's in it

| Area | Screens |
|---|---|
| Tabs | Home (money brain), Dreams (+ price guide, Can I afford it?), Ask (chat), Alerts, More |
| Voice | Full-screen hands-free voice (EN/HI) sharing one conversation with chat; assistant can open screens and pin a do/avoid guide |
| Money | Net worth, Invest (+ Portfolio X-ray), Insurance (+ policies, needs check), Find & compare plans (+ checkout → licensed partner), Tax (7 sections), File your ITR, Action plan, Markets |
| Documents | Monthly records (AI reader + confirm), Statement scan, Document vault, Your CA (chat, docs, ITR checklist) |
| Account | Onboarding, email-OTP / mobile-OTP / demo login, Reports, Plans, Settings (details, money, tax, work & benefits, language, app lock, export, **delete account**) |

Files (statements, holdings, P&L, PDFs) are parsed by the server (`POST /v1/files/parse`) because the phone can't run
the web's PDF/Excel libraries.

## Store-rule checklist (already handled in code)

- **Apple 4.2 / Play "webview" policy** — every screen is native UI.
- **Apple 5.1.1(v)** — account deletion in Settings → App → Delete my account.
- **Digital subscriptions (Apple 3.1.1, Play Billing)** — no purchase buttons or links in the app; Plans only describes
  what's included. Paid features unlock if the account already has a plan. Insurance applications are real-world
  services (no payment collected) so they are not in-app purchases.
- **Permissions** — only microphone (voice), speech recognition, Face ID / biometrics, notifications. Usage strings
  explain each one. Storage, location, camera, phone-state and background-audio permissions are blocked.
- **iOS privacy manifest** — declared in `app.config.ts` (required-reason APIs + collected data, no tracking).
- **Android** — `allowBackup=false` (financial data never goes to device cloud backups); tokens in the keystore.
- **Encryption export** — `ITSAppUsesNonExemptEncryption=false` (only standard HTTPS).

## What you still need to do (outside the code)

1. **Accounts**: Apple Developer Program ($99/yr, as an organisation → needs a D-U-N-S number) and Google Play Console
   ($25, organisation account). Finance apps on Play must be published by an organisation.
2. **Play Console forms**: Data safety (name, email, phone, financial info, files, audio — encrypted in transit,
   deletable), Financial features declaration (personal finance / budgeting; not a lender or broker),
   content rating, target audience (18+), privacy policy URL `https://paywatch.in/legal/privacy`.
3. **App Store Connect**: App Privacy answers matching the manifest, privacy policy URL, a demo login for the reviewer
   (use the "Explore with a demo account" button and say so in the review notes), category Finance.
4. **Push notifications** (optional): add Firebase (`google-services.json`) + APNs key in EAS, then build with
   `EXPO_PUBLIC_PUSH_ENABLED=1`.
5. Retire the old Capacitor wrapper (`web/android`, `web/ios`) once the native app is live.
