# Fine Print CA

Every California November 2026 ballot measure, the ads for and against it, who paid for them, and what each side's ads tend to leave out. Working name; rename freely.

**Test scope:** California only, the 14 measures on the November 3, 2026 ballot (Props 1–5, 37–45).

## How it's built

- **Frontend:** plain HTML/CSS/JS, hash-routed single page (`index.html`, `app.js`, `styles.css`). No build step. Deploys to Netlify as-is.
- **Data:** `data/measures.json` is the source of truth for measure content, committees, funders, ads, and "what it leaves out" notes. The site runs entirely off this file with no backend.
- **Backend (optional):** Supabase. `supabase/schema.sql` creates the tables + RLS; `supabase/seed.sql` is generated from the JSON by `scripts/build_seed.py`. When `config.js` has a Supabase URL and anon key, the site reads from Supabase instead of the JSON and the "I saw an ad" form writes to the `ad_reports` table. Without Supabase, the form falls back to a `mailto:` link.

## Run locally

```powershell
cd C:\Users\green\OneDrive\Documents\GitHub\fineprint-ca
python -m http.server 8765
# open http://localhost:8765
```

(It needs to be served over http, not opened as a file, because it fetches `data/measures.json`.)

## Set up Supabase

1. Create a new Supabase project.
2. SQL Editor → paste and run `supabase/schema.sql`.
3. SQL Editor → paste and run `supabase/seed.sql`.
4. Project Settings → API → copy the **Project URL** and the **anon public** key into `config.js`.

To update content later: edit `data/measures.json`, then

```powershell
python scripts\build_seed.py
```

and re-run the new `supabase/seed.sql` in the SQL editor. It upserts, so it's safe to re-run. Visitor submissions land in `ad_reports`; review them in the Supabase table editor and add the good ones to `data/measures.json` under `ads`.

## Get emailed when someone submits an ad report

`supabase/webhook.sql` adds a trigger on `ad_reports` that POSTs each new row (via pg_net) to the Edge Function in `supabase/functions/notify-ad-report/`, which emails it through Resend.

1. Deploy the function (Supabase CLI: `supabase functions deploy notify-ad-report --no-verify-jwt`, or via the dashboard).
2. Set its secrets: `RESEND_API_KEY`, `NOTIFY_TO`, `NOTIFY_FROM`, `NOTIFY_SECRET` (any long random string), optional `DASHBOARD_URL`.
3. In `webhook.sql` replace `__FUNCTION_URL__` and `__NOTIFY_SECRET__`, then run it in the SQL editor.

Every submission then arrives in your inbox with reply-to set to the submitter (if they gave an email).

## Deploy to Netlify

Connect the GitHub repo in Netlify. Publish directory: `/` (repo root). No build command. `netlify.toml` is already set.

## Editorial rules (keep it neutral)

- Every measure gets the same template; Yes and No get the same boxes in the same order.
- "What it leaves out" lists facts from official sources (voter guide, LAO, FPPC) that the ad's framing omits. It is not a truth rating.
- Ads are linked, never hosted or edited. Every ad entry names its sponsor.
- Funding figures cite the FPPC Top 10 Contributors list and the date pulled (`election.funding_as_of`).

## Ad status values

`draft` (hidden) → `needs_transcript` (shown, asks visitors for the wording) → `published` (shown with claims) / `rejected` (hidden).

## Data sources

- Official Voter Information Guide: https://voterguide.sos.ca.gov/propositions/
- Legislative Analyst's Office ballot analyses: https://lao.ca.gov/
- FPPC Top 10 Contributors, Nov 2026: https://www.fppc.ca.gov/search-filings/top-10-contributors-list/november-2026-general-election/
- CalMatters 2026 voter guide: https://calmatters.org/california-voter-guide-2026/propositions/
- Meta Ad Library: https://www.facebook.com/ads/library/
- Google Ads Transparency Center: https://adstransparency.google.com/
