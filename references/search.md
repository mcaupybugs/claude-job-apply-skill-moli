# Search

## Channel A — company ATS boards (primary)

`scripts/search.mjs` reads public job-board APIs. Every result is a live posting, comes with a full
description for scoring (`--with-description`), and has an apply form this skill can fill.

| ATS | Endpoint used | Config in companies.json |
|---|---|---|
| Greenhouse | `boards-api.greenhouse.io/v1/boards/<slug>/jobs` | `{ "ats": "greenhouse", "slug": "…" }` |
| Lever | `api.lever.co/v0/postings/<slug>?mode=json` | `{ "ats": "lever", "slug": "…" }` |
| Ashby | `api.ashbyhq.com/posting-api/job-board/<slug>` | `{ "ats": "ashby", "slug": "…" }` |
| Eightfold | `https://<host>/api/pcsx/search?domain=<domain>&query=&location=&start=` | `{ "ats": "eightfold", "host": "…", "domain": "…", "locationQuery": "India" }` |

If an API answers 403/429 to a plain request, `search.mjs` retries from inside a page on that origin
via `moli fetch --eval` (real browser context).

**Adding a company:** open its careers page and click any job.
- URL contains `greenhouse.io/<slug>` or `?gh_jid=` → Greenhouse; slug is the board name
  (test: `curl -s https://boards-api.greenhouse.io/v1/boards/<slug>/jobs | head -c 200`).
- `jobs.lever.co/<slug>/…` → Lever. `jobs.ashbyhq.com/<slug>/…` → Ashby.
- `…/careers/job/<id>?domain=<domain>` or `*.eightfold.ai` → Eightfold (`host` = that hostname).
- `myworkdayjobs.com`, `icims.com`, `taleo.net`, SuccessFactors → not searchable here; use Channel B and
  hand the application to the candidate.
If you aren't sure which ATS a company uses, `moli fetch --dump markdown <careers-url>` and look at the
job links. Add verified entries to the workspace `companies.json`.

**Suggested targets by company type** (look up their ATS before adding):
- Big tech / global product: Google, Microsoft, Amazon, Meta, Apple, Atlassian, Adobe, Salesforce, Nvidia, Stripe, Databricks
- Indian product: Flipkart, Razorpay, PhonePe, Zerodha, CRED, Groww, Swiggy, Zomato, Meesho, Dream11, ShareChat
- SaaS/mid-tier: Freshworks, Zoho, Postman, BrowserStack, Chargebee, Hasura, Druva, Mindtickle
- Banks/fintech engineering centres: Goldman Sachs, Morgan Stanley, JP Morgan, Deutsche Bank, PayPal
- Services (only if wanted): TCS, Infosys, Wipro, HCL, Tech Mahindra, Cognizant, Capgemini

## Channel B — job sites (discovery)

Use WebSearch; these sites block bots and many need logins, so don't try to automate applying on them.

| Site | Query pattern | Good for |
|---|---|---|
| Naukri | `site:naukri.com "<role>" "<skill>" "<city>"` | largest Indian volume |
| LinkedIn | `site:linkedin.com/jobs "<role>" "<skill>" "<city>"` | MNCs, product cos |
| Instahyre | `site:instahyre.com "<role>" "<skill>"` | curated product roles |
| Cutshort | `site:cutshort.io "<role>" "<skill>"` | startups |
| Hirist | `site:hirist.tech "<role>" "<skill>"` | experienced tech |
| Wellfound | `site:wellfound.com "<role>" India` | funded startups, equity |
| Indeed India | `site:in.indeed.com "<role>" "<city>"` | aggregator |
| Foundit / Shine / TimesJobs | `site:foundit.in "<role>"` etc. | MNC + mid-level volume |
| Glassdoor | `site:glassdoor.co.in/job "<role>"` | salary context |
| WeWorkRemotely | `site:weworkremotely.com "<skill>"` | remote, USD pay |
| Company pages | `"<company>" careers "<role>" "<city>"` | direct |

Abroad: add visa-friendly boards (Relocate.me, Arbeitnow) and country boards (StepStone DE, Reed UK,
Seek AU, Bayt UAE) with the same patterns.

For each hit: (1) try to find the same role on the company's ATS (search.mjs `--only <company>` or the
careers page) and prefer that link; (2) otherwise verify with `scripts/verify.mjs` and mark
"Apply via: <site> ⚠️ manual".

## Link rules

- Only show links verified this session (ATS API results count as verified).
- Drop: HTTP errors, "no longer accepting", redirects back to the listing page, empty renders.
- Flag postings older than 30 days: "⚠️ 30+ days old — may be filled".
- Never show a search-results page as an apply link.
- Posted date: absolute (e.g. "05 Oct 2026"); convert "3 days ago"; "date n/a" if unknown.
- Job ID: ATS id, or the site's id from the URL, or `<Source>-<Company>-<ShortTitle>`.

## Fit score (holistic, not a keyword count)

Score each dimension 0–100, weight, normalise:

| Dimension | Weight | Question |
|---|---|---|
| Skills | 3 | What share of the *required* skills does the candidate genuinely have? |
| Experience | 2 | Is their YOE inside the posting's range? (−15 per year outside) |
| Domain | 2 | Have they worked in this industry/problem space? |
| Seniority | 2 | Does their level match the role's scope (IC vs lead vs manager)? |
| Projects | 1 | Have they built something close to what this team builds? |
| Education | 1 | Degree/certs meet stated requirements? |

Bands: **≥80 strong**, **60–79 worth applying**, **<60 stretch** (show it, flagged, if otherwise relevant).
Explain each in 1–2 lines with specifics, e.g.
"Zscaler — Staff SDE — 84%: Go + distributed systems + AWS match 4/5 required; 7+ YOE asked, they have 6
(minor gap); event-pipeline work maps to their data-path team. Missing: Rust."

Apply the profile's preferences as filters, not score penalties: skip blocked companies/types and
deal-breakers entirely; mention salary mismatch if the posting lists a range.

## Unattended runs

When running as a scheduled task: no questions (AskUserQuestion would block), search every target
city/role in the profile, prepare materials for all ≥60, record decisions in the report, never submit.
