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

Terms of Use: https://maxscs25.github.io/Stride-Project/terms.html
Privacy Policy: https://maxscs25.github.io/Stride-Project/privacy.html
```

**What's New** (first release)
`The first release of Stride — your AI running coach for smarter training and fewer injuries. We'd love your feedback.`

**What's New — 1.1.0**
```
Your weekly plan, VO2 max, and a big reliability fix.

WEEKLY PLAN
Set what each day is for — long run Sunday, workouts Tuesday and Friday, rest Saturday — then let Stride split your weekly goal across them. Today's target waits for you on the home screen.

VO2 MAX
Enter a recent race or time trial to see your estimated VO2 max, plus the times it predicts from a mile to a marathon.

CROSS-TRAINING AS MILES
Count the bike, pool, and elliptical toward your week. Pick your own ratio — 10 minutes to the mile, or whatever you use — and cross-training stacks on the bar graph in its own color. Your real mileage still reads first: 12 (15).

EDIT ANYTHING
Tap any run or shoe to fix a distance, change the date, or delete it.

SPLIT A RUN BETWEEN SHOES
Shakeout in the trainers, workout in the racers? Divide one run's mileage across both, and each pair's mileage stays honest.

ALSO
• Weeks can start on Sunday or Monday
• Enter run times as mm:ss (45:30), not just whole minutes
• Pick a past date when logging cross-training, meals, or a journal entry
• Star the foods you eat often for one-tap logging
• Food search is working again

FIXED
Runs could disappear and your weekly goal could reset if your session quietly expired in the background. Sessions now stay signed in, and anything you log while offline is kept and synced as soon as you're back.

Apple Health no longer re-imports a run you already logged by hand, and a watch run you delete stays deleted.
```

---

## 2. Metadata

- **Primary category:** Health & Fitness  •  **Secondary:** Sports
- **Age rating:** answer the questionnaire honestly → expected **4+** (no objectionable content; it is fitness/nutrition, not medical treatment).
- **Price:** Free (with auto-renewable subscription — see below).
- **Bundle ID:** `com.maxcerviskinner.stride`
- **Support URL:** `https://maxscs25.github.io/Stride-Project/support.html`
- **Marketing URL:** optional
- **Privacy Policy URL (required):** `https://maxscs25.github.io/Stride-Project/privacy.html`

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

## 5. Public pages (Support + Privacy Policy URLs)

Hosted free on GitHub Pages from `docs/` on `main`:

- **Support URL:** `https://maxscs25.github.io/Stride-Project/support.html`
- **Privacy Policy URL:** `https://maxscs25.github.io/Stride-Project/privacy.html`
- Terms: `.../terms.html` • Landing: `.../index.html`

Regenerate after any change to `src/constants/legal.ts` (same source as the
in-app screens, so the public pages can't drift), then commit and push:

```bash
cd ~/Downloads/stride
node scripts/build-legal.mjs      # rewrites docs/
```

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

**Bump `version` in app.json before every release build** — see §9 for why and
what Apple's rejection looks like when you forget.

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
- [x] $99 Apple Developer account
- [x] App Store Connect app record + IAP products (REVENUECAT_SETUP.md)
- [x] RevenueCat API key set, release build
- [x] Privacy Policy URL hosted (GitHub Pages, docs/)
- [x] Reviewer demo account created
- [x] Screenshots framed to 1290×2796
- [x] Fill in the `[bracketed]` placeholders here and in legal.ts

---

## 9. Shipping the 1.1.0 update

1.0.0 is already live, so everything in §1–§5 is done and stays as-is. An update
only needs a new build, new release notes, and a submit.

### What 1.1.0 contains

| | |
|---|---|
| Weekly plan | Day types + goal split across the week |
| VO2 max | Daniels–Gilbert from a baseline race, with race predictions |
| Cross-training miles | Adjustable ratio, stacked on the week/insights charts |
| Shoe splits | One run's mileage divided across multiple pairs |
| Editing | Runs and shoes are editable and deletable |
| Week start | Sunday or Monday |
| mm:ss entry | Run times accept `45:30` |
| Date pickers | Cross-training, food, and journal can backdate |
| **Fix** | Runs disappearing / goal resetting on silent session expiry |
| **Fix** | Apple Health re-importing runs already logged by hand |

### Build and upload

```bash
npx eas-cli build --platform ios --profile production --non-interactive
```

Then submit the build it prints an ID for:

```bash
npx eas-cli submit --platform ios --id <BUILD_ID> --non-interactive
```

`eas` is not on the PATH in a non-login shell — use `npx eas-cli`, not bare `eas`.

### In App Store Connect

1. **My Apps → Stride → the `+` next to "iOS App"** → enter version `1.1.0`.
   (Not the existing 1.0.0 page — that one is already released and read-only.)
2. **What's New in This Version** → paste the 1.1.0 block from §1.
3. **Build** → `+` → pick the build once it finishes processing (~10–20 min
   after upload; you get an email when it's ready).
4. **Version Release** → "Automatically release this version" is fine, or
   "Manually release" if you want to time it with a video.
5. Everything else — screenshots, description, privacy, pricing — carries over
   from 1.0.0 untouched. Only change a screenshot if a new feature deserves one.
6. **Add for Review → Submit to App Review.**

Nothing here needs the IAP products re-reviewed; they were approved with 1.0.0
and are unchanged.

### Version bumps

**Bump `version` in app.json before every release build.** EAS auto-increments
the *build* number but not the version string, and Apple rejects an upload whose
`CFBundleShortVersionString` matches an already-approved release:

> 90186: Invalid Pre-Release Train. The train version '1.0.0' is closed for new
> build submissions.

Bug fix → `1.1.1`, new features → `1.2.0`. The binary is fine when this happens;
only the version stamp is wrong, so bump and rebuild.
```
