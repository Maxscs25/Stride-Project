# Stride

AI-powered running app: training log, shoe mileage, recovery journal, daily
checklist, and an injury-prevention coach that explains itself.
Strava tells you what you ran — Stride keeps you running.

Built with **Expo (React Native) + Supabase + Claude**, per the full design doc
(architecture, schema, AI pipelines, pricing Model A) produced at project start.

## Status — MVP scaffold (Phase 1)

Working now, fully offline with seeded demo data:

- **Today** — AI coach card (status + evidence + recommendations), weekly
  mileage progress, daily checklist with streaks, worn-shoe alert
- **Log** (FAB) — run / cross-training / journal entry, each ≤4 taps
- **Training** — activity feed, shoe locker with wear bars, PRs
- **Insights** — weekly mileage chart, acute:chronic load chart (ACWR),
  recovery sparklines, consistency heatmap, weekly AI report
- **Fuel** — dynamic calorie/macro targets (Mifflin-St Jeor + logged mileage),
  functional hydration tracker; food logging is Phase 2
- **Profile** — goals, Model A membership tiers, demo reset

The "AI coach" currently runs on the **deterministic signal engine only**
([src/lib/load.ts](src/lib/load.ts)): ACWR via EWMA, week-over-week ramp %,
keyword symptom mining of journal notes, sleep debt, shoe wear, consistency
wins. The Claude narration layer is stubbed in
[supabase/functions/weekly-insight/index.ts](supabase/functions/weekly-insight/index.ts)
and activates once Supabase is connected.

## Run it

```bash
npm install
npx expo start          # then i / a / w for iOS / Android / web
```

Demo data regenerates relative to today (Profile → Reset demo data).

## Wiring up Supabase (Phase 2)

1. `npx supabase init && npx supabase link --project-ref <ref>`
2. `npx supabase db push` — applies:
   - [0001_schema.sql](supabase/migrations/0001_schema.sql) — full schema:
     runs, shoes, journal + symptom tags, checklist, nutrition, form analyses,
     coach links with permission JSON, signals/insights, jobs
   - [0002_rls.sql](supabase/migrations/0002_rls.sql) — owner-only RLS +
     `coach_can_view()` permission-scoped coach read policies
   - [0003_signal_engine.sql](supabase/migrations/0003_signal_engine.sql) —
     sRPE load, EWMA acute/chronic + ACWR, rule-based signal detection,
     nightly pg_cron refresh
3. `supabase secrets set ANTHROPIC_API_KEY=...` and
   `supabase functions deploy weekly-insight`
4. Add `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` to `.env`
   and swap the local store for Supabase sync.

## Architecture notes

- **Three-layer AI**: SQL feature engine → deterministic rules → Claude
  narration constrained to a curated exercise library. The model explains the
  numbers; it never invents them.
- **Privacy**: notes are athlete-private by default; coach access is per-scope
  (`coach_links.permissions`) and enforced in RLS, not the UI.
- **Pricing (Model A)**: Free logging forever · Premium $6.99/mo ($49.99/yr) ·
  Coach Pro $9.99/mo — constants in
  [src/constants/pricing.ts](src/constants/pricing.ts).

All AI output is educational training guidance, never diagnosis.
