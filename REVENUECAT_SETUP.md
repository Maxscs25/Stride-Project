# Turning on the Stride Premium paywall

The paywall is **fully built and wired** — it just needs the products created and
one API key. Everything below happens *after* you have the **$99/yr Apple
Developer account**. Until then the app stays on the free tier and the paywall
shows a "Subscriptions aren't live yet" state (no crashes).

## 1. App Store Connect — create the subscription
1. [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → your app → **Subscriptions**.
2. Create a **Subscription Group** (e.g. `Stride Premium`).
3. Add two subscriptions in that group:
   - **Monthly** — product ID `stride_premium_monthly`, price **$6.99**
   - **Annual** — product ID `stride_premium_annual`, price **$49.99**
4. On each, add a **14-day free trial** introductory offer.
5. Fill in the localization/description and submit for review with your first build.

> Also add the **In-App Purchase** agreement + banking/tax info in App Store
> Connect (Agreements, Tax, and Banking) or purchases can't go live.

## 2. RevenueCat — free account
1. Sign up at [app.revenuecat.com](https://app.revenuecat.com) and create a project.
2. **Add an app** → iOS → enter the bundle id `com.maxcerviskinner.stride` and your
   App Store shared secret (App Store Connect → App Information → App-Specific Shared Secret).
3. **Entitlements** → create one with identifier exactly **`premium`** (the code checks this).
4. **Products** → add `stride_premium_monthly` and `stride_premium_annual`; attach both to the `premium` entitlement.
5. **Offerings** → the default offering → add two packages: **Monthly** → the monthly product, **Annual** → the annual product.
6. **API keys** → copy the **Apple/iOS public SDK key** (starts with `appl_`).

## 3. Set the key + rebuild
```bash
cd ~/Downloads/stride
# put the key in .env (it's a public SDK key, safe in the app)
echo "EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_XXXXXXXXXXXX" >> .env   # replace the placeholder line
npx expo run:ios --device
```
On launch, `initPurchases()` configures RevenueCat, the paywall loads the live
packages with localized prices, and "Start 14-day free trial" makes a real purchase.

## 4. Test before shipping
- Create a **Sandbox tester** in App Store Connect (Users and Access → Sandbox).
- Sign into that sandbox account on the device (Settings → App Store → Sandbox Account).
- Buy in the app — sandbox purchases are free and RevenueCat shows the event.

## How it's wired in code
- `src/lib/purchases.ts` — init, entitlement state (`useIsPremium()`), purchase/restore, and `loginPurchases(uid)`/`logoutPurchases()` tied to Supabase auth so entitlements follow the account.
- `src/app/paywall.tsx` — the paywall screen (localized prices, restore, Apple-required disclosures).
- Profile → Membership card opens `/paywall`; shows **ACTIVE** when subscribed.
- **Gating features:** nothing is gated yet so you can keep testing. To gate any
  premium feature, add `const premium = useIsPremium();` and guard it — e.g. show
  the paywall instead of running a form analysis when `!premium`.

## Which features to put behind Premium (from the plan)
AI weekly insights beyond the basic summary, nutrition logging, form analysis,
and advanced analytics. Keep core logging + shoe tracking free forever.
