# Stride — App Store Submission Prep

Everything you need to list and ship Stride, once the **$99/yr Apple Developer
account** is active. Copy is written to Apple's character limits. Replace the
`[bracketed]` placeholders.

---

## 1. Listing copy (paste into App Store Connect)

**App name** (≤30 chars)
`Stride: AI Running Coach` (24)

**Subtitle** (≤30 chars)
`Train smart, run injury-free` (28)

**Keywords** (100-char field, comma-separated, NO spaces)
`running,run tracker,marathon,5k,cadence,gait,pace,training,injury,recovery,coach,nutrition,strava,garmin`

**Promotional text** (≤170 chars, editable anytime without review)
`Your AI running coach: injury-prevention insights, on-device form analysis, and nutrition that adapt to how you train and feel. Free to start.`

**Description** (≤4000 chars)
```
Stride is the running app that keeps you healthy — not just a log of what you did.

It combines fast daily tracking with an AI coach whose #1 job is preventing injury and building the consistency that actually makes you faster.

TRACK IN SECONDS
• Log runs in a few taps — distance, time, pace, workout type, and shoe
• Automatic shoe mileage with replacement alerts before worn cushioning raises impact
• Cross-training, plus a 10-second recovery journal (energy, soreness, sleep, notes)

AN AI COACH THAT EXPLAINS ITSELF
• Weekly insights from real training-load science (acute:chronic ratio, ramp rate, monotony)
• Early warnings for sudden mileage jumps and recovery deficits — always with the evidence
• Reads your journal over weeks to spot patterns like recurring calf tightness, and suggests targeted mobility, strength, and recovery routines
• Educational guidance, never a medical diagnosis

RUNNING FORM ANALYSIS
• Record or import a clip and get on-device gait feedback — cadence, posture, vertical bounce, arm carriage, and symmetry
• A skeleton overlay on your own video, with drills to work on
• Track how your form changes over time

FUEL FOR YOUR TRAINING
• Daily calorie and macro targets that adjust to your mileage
• Barcode scanner and food search
• Under-fueling detection — important for runners who don't eat enough

EVERYTHING ELSE
• Beautiful dashboards: weekly/monthly mileage, training load, recovery trends, streaks, PRs
• Connect Apple Health so watch runs (Garmin, COROS, Apple Watch) appear automatically
• Invite a coach with granular privacy controls — you choose exactly what they see
• Dark mode, offline logging, private by design

Free forever for logging. Stride Premium unlocks the full AI coach, nutrition, and form analysis.

Stride is for educational and training purposes only and is not a medical device.
```

**What's New** (first release)
`The first release of Stride — your AI running coach for smarter training and fewer injuries. We'd love your feedback.`

---

## 2. Metadata

- **Primary category:** Health & Fitness  •  **Secondary:** Sports
- **Age rating:** answer the questionnaire honestly → expected **4+** (no objectionable content; it is fitness/nutrition, not medical treatment).
- **Price:** Free (with auto-renewable subscription — see below).
- **Bundle ID:** `com.maxcerviskinner.stride`
- **Support URL:** `[https://your-site/support]` (a simple contact page or email link)
- **Marketing URL:** optional
- **Privacy Policy URL (required):** host `legal/privacy.html` (see §5) → e.g. `[https://your-site/privacy]`

**In-App Purchases** (from REVENUECAT_SETUP.md): `stride_premium_monthly` $6.99, `stride_premium_annual` $49.99, 14-day free trial. Add the subscription group and localized display name.

---

## 3. App Privacy ("nutrition label" — Data Collection section)

Declare these. **Nothing is used to track you across apps, and no data is sold.**
Mark all as "linked to you" and "app functionality" (not "tracking").

| Data type | Collected | Purpose |
|---|---|---|
| Contact info — Email | Yes | Account, app functionality |
| Health & Fitness — workouts, heart rate, distance (HealthKit); training/wellness logs | Yes | App functionality |
| User content — journal notes, running-form videos | Yes | App functionality |
| Identifiers — user ID | Yes | App functionality |
| Purchases — subscription status | Yes | App functionality (via Apple/RevenueCat) |
| Usage/diagnostics | Optional | If you enable analytics later; currently none |

- **Tracking:** None. Do not enable the "Used to Track You" toggle.
- **HealthKit:** confirm health data is only used for app features and never for advertising (matches the Privacy Policy).

---

## 4. Reviewer notes (App Review Information)

Paste into the "Notes" field so review goes smoothly:
```
Stride is a running-training app. Please use the demo account below to see all features.

Demo account:
  email: [create a reviewer test account]
  password: [•••]

Notes for review:
• HealthKit is used only to import the user's own running workouts into their training log; it is never used for advertising and never shared. See our Privacy Policy.
• All coaching, nutrition, and running-form output is clearly labeled as educational and is not a medical diagnosis (disclaimers shown in-app).
• Running-form analysis (pose estimation) runs on-device via Apple Vision; recorded videos are stored privately and auto-deleted after 30 days.
• Subscriptions use Apple In-App Purchase (RevenueCat). A 14-day free trial then $6.99/mo or $49.99/yr.
```
> Also add HealthKit usage to the review notes and ensure the Info.plist usage strings are present (they are).

---

## 5. Host the legal pages (needed for the Privacy Policy URL)

```bash
cd ~/Downloads/stride
node scripts/build-legal.mjs      # regenerates legal/privacy.html + legal/terms.html
```
Deploy the `legal/` folder (Vercel, Netlify, GitHub Pages, or your domain) and use
the resulting URLs for the App Store Privacy Policy URL and the in-app links.

---

## 6. Build & submit (recommended: EAS)

EAS Build compiles in the cloud — no local Xcode archive dance, and it handles
signing/certificates for you.

```bash
npm install -g eas-cli
eas login
eas build:configure                 # creates eas.json
eas build --platform ios --profile production
eas submit --platform ios           # uploads the build to App Store Connect
```
Then in App Store Connect:
1. **TestFlight** → the build appears after processing → add yourself + teammates as internal testers → they install TestFlight and run Stride.
2. Create the **App Store listing** (§1), upload **screenshots** (§7), fill **App Privacy** (§3) and **review notes** (§4).
3. Attach the build → **Submit for Review**.

Set secrets that the app needs at build time (EAS reads `.env`, or set them in the EAS dashboard): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_REVENUECAT_IOS_KEY`.

Bump `version` in app.json for each App Store version; EAS auto-increments the build number.

---

## 7. Screenshots

Apple requires a set for the **6.9" display: 1290 × 2796 px** (covers all iPhones).
Drafts captured from the app live in `store-assets/screenshots/`. For a polished
listing, drop each into a device frame with a one-line headline (e.g. "Your AI
injury-prevention coach", "See your running form", "Fuel for your training").

---

## 8. Pre-flight checklist

- [x] Unique bundle id, icons, splash, cohesive branding
- [x] Legal pages (privacy + terms) — in-app and exportable HTML
- [x] Paywall wired (RevenueCat) — needs products created
- [x] HealthKit usage strings in Info.plist
- [x] Educational / not-medical disclaimers in-app
- [ ] $99 Apple Developer account
- [ ] App Store Connect app record + IAP products (REVENUECAT_SETUP.md)
- [ ] RevenueCat API key set, release build
- [ ] Privacy Policy URL hosted
- [ ] Reviewer demo account created
- [ ] Screenshots framed to 1290×2796
- [ ] Fill in the `[bracketed]` placeholders here and in legal.ts
```
