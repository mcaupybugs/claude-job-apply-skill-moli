# Tracking, status, automation, review

## Tracker

`scripts/track.mjs` keeps `<ws>/job_tracker.csv` (opens in Excel/Sheets). Columns:
Key, Date Found, Company, Role, Job ID, Source, Location, Posted Date, Job URL, Apply URL, Fitness,
Resume, Cover Letter, Status, Date Applied, Response Date, Outcome, Interview Stage, Rejection Reason,
Follow-up Date, Next Action, Notes.

Status flow: Found → Ready to Apply → Applied → Acknowledged → Online Assessment → Interview R1 →
Interview R2 → HR Round → Offer, or Rejected / Ghosted (21+ days without a reply).

If the candidate already has a tracker in another format (e.g. xlsx from another tool), read it and
keep updating that one instead of starting a second.

## `status`

**With Gmail** (a Gmail connector is available — if not, offer once to connect it and explain it will only
search mail from companies in the tracker):
1. Collect sender domains of tracked companies (company domain + their ATS: greenhouse.io, lever.co,
   ashbyhq.com, eightfold.ai, myworkday.com…).
2. Search mail since the earliest Date Applied, restricted to those domains, with words like
   application, interview, unfortunately, regret, shortlisted, next steps, assessment, offer.
3. Classify: regret/unfortunately/not moving forward → Rejected; interview/next round/schedule →
   Interview; assessment/coding challenge/test link → Online Assessment; offer/pleased to → Offer;
   received/under review → Acknowledged. Note deadlines and required actions.
4. Update the tracker and report:

```
STATUS — 05 Oct 2026
New:
  ✅ <Company> — interview invite (04 Oct) — ACTION: pick a slot by 08 Oct
  🧪 <Company> — online assessment — ACTION: complete by 07 Oct
  ❌ <Company> — rejected after screening (03 Oct)
Waiting:
  <Company> — applied 26 Sep (9 days) — follow up now
  <Company> — applied 12 Sep (23 days) — likely ghosted
Applied 14 · responses 5 (36%) · interviews 2 · rejected 2
```

**Without Gmail:** `track.mjs list`, then ask "Any updates? e.g. 'Stripe — interview', 'CRED — rejected'",
apply them with `track.mjs set`, show the same report. Re-offer Gmail once after ~10 applications.

Never send email on the candidate's behalf; draft follow-ups for them to send if they want.

## `automate`

1. Ask time (default 11:00 PM IST) and frequency (daily / weekdays / weekly). IST = UTC+5:30, e.g.
   23:00 IST → `30 17 * * *`; weekdays → `30 17 * * 1-5`.
2. Create the scheduled task with whatever scheduler the environment provides (a schedule skill or
   scheduled-tasks tool). The task prompt must be self-contained: workspace path, "load profile.json",
   "run the search workflow unattended", "prepare materials for fit ≥ 60", "update tracker", "run status
   if Gmail is connected", "send the morning report", and **"do not submit any application"**.
3. Morning report: new matches (role, company, fit, posted, apply link, materials ready, one-line why),
   status changes, follow-ups due, weekly stats, then "Reply with the numbers to fill."

## `review` (weekly, or when asked "how's my search going?")

Metrics from the tracker: applied, response rate, interview rate, ghosted rate, median days to reply,
best source, best role title, fit-score band vs outcome.

Rejection pattern checks (run with every status update too):
- 3+ rejections in a row, or > 60% rejections after 10+ outcomes → diagnose before the next batch.
- Same-day / < 48h rejections → automated screen: tighten keyword tailoring for that role type.
- Rejections after assessment/interview → not a resume problem; suggest prep for their stack instead.
- All rejections from one company type / title / seniority → targeting problem; propose adjusting filters.
- Spread across unrelated roles → targeting too broad; propose narrowing.
- No clear pattern → say so; don't invent a cause.

Apply the change going forward (search keywords, filters, resume emphasis) and tell the candidate in one
or two lines what changed and why, e.g. "4 of your last 5 rejections were same-day from services
firms — that's keyword screening. I've tightened tailoring for those and moved product companies up."
