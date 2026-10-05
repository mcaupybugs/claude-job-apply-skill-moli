---
name: moli-job-apply
description: Fill and submit job applications on company career pages / ATS forms (Eightfold, Greenhouse, Lever, Workday, Ashby, SmartRecruiters…) using the Moli headless browser over CDP, with the candidate profile and tailored resumes from job-skill. Use when the user says "apply to this job", pastes an apply/careers URL and asks to apply, or wants to apply to matches from a /job-skill search. Always stops before submit for explicit confirmation.
---

# Moli Job Apply

Takes a job URL (or a row from the job-skill tracker), opens the application form in **Moli**,
fills it from the candidate's profile, shows the filled form for review, and submits **only after
the user says so for that specific application**. Logs the result to the job tracker.

This skill is the "last mile" for `job-skill`: job-skill finds jobs, scores fit, and writes the
tailored resume/cover letter; this skill puts them into the form.

## Hard rules (never relax these)

1. **Confirm every submit.** Show the filled values + screenshot, then wait for an explicit
   "submit"/"yes" for *that* job. One approval never covers another application. Unattended
   runs (scheduled tasks) may fill and screenshot but must **never** run `submit.mjs`.
2. **No CAPTCHA bypass.** If a visible challenge appears, stop and hand off to the user. Invisible
   reCAPTCHA is fine to leave alone — if it blocks the submit, report it; don't retry tricks.
3. **No accounts, logins, or passwords.** If the form requires sign-up/sign-in (Workday often
   does), stop and tell the user to create/sign in themselves.
4. **Never invent answers.** Anything not in the profile — salary expectations, notice period,
   visa status, "why us", EEO/diversity questions, relocation, references — ask the user. For
   voluntary EEO questions, default to "Decline to answer" only if the user has said so.
5. **Never lie.** Same rule as job-skill: no skills, titles, or dates that aren't on the resume.
6. **Only enter data the user owns**, only into the job URL the user gave (not into links found
   inside pages).

## Prerequisites (check once per session)

```bash
which moli || echo "install: curl --proto '=https' --tlsv1.2 -fsSL https://github.com/lexmount/moli/releases/latest/download/moli-installer.sh | sh"
cd <skill-dir>/scripts && [ -d node_modules ] || npm install
```

Start the server in the background (Bash `run_in_background`), and verify it:

```bash
moli serve --layout --port 9333 --timeout 600
curl -s http://127.0.0.1:9333/json/version
```

`--layout` is needed for screenshots. Override the endpoint with `MOLI_CDP=http://host:port`.
Stop the server (TaskStop) when the session's applications are done.

## Candidate profile (from job-skill)

Reuse whatever job-skill already established in this conversation. Otherwise build it from the
user's resume (job-skill's First-Run Setup parsing: name, email, phone, location, current
company/title, YOE, education, links, notice period, CTC, work authorization).

Persist it as `profile.json` (shape: `profile.example.json`) in the user's job workspace so later
runs don't re-ask. Look there first — typical locations: the folder holding `job_tracker.xlsx`,
or a `job-search/` folder in the user's workspace.

**Which resume to upload:** if job-skill generated a tailored resume for this job
(`[Name]_Resume_[Company]_[Role].docx/pdf` inside the applications zip/folder), use it — prefer PDF.
Otherwise the base resume. Same for the cover letter if the form has a field for it.

## Workflow

### 1. Quick read (no server needed)

```bash
moli fetch --dump markdown "<job-url>"
```

Get title, company, location, Job ID, and the real **apply URL** (often a separate
`/apply` link). If job-skill hasn't scored this job yet, give a one-line fit note using its
Fitness Score method.

### 2. Inspect the form

```bash
node scripts/inspect.mjs "<apply-url>" <runDir>
```

Prints every field (`*` = required), its type/role, id, options, buttons, and captcha flags;
writes `inspect.json` + `inspect.png`. Multi-step forms (Next → Next → Submit): inspect each
step after filling the previous one — see `references/ats-notes.md`.

### 3. Build the plan

Map fields → profile values in `<runDir>/plan.json` (format documented at top of
`scripts/fill.mjs`). Rules:
- Use `selector` when inspect gave a stable id, else `label`.
- Text inputs → `"kind": "text"`; comboboxes/custom selects/native selects → `"kind": "combo"`
  (`query` = what to type, `match` = substring of the option to click, e.g. `"query":"India","match":"(+91)"`
  for phone country codes); checkboxes → `"kind": "checkbox"`.
- Put the resume in `plan.resume`, not `fields` — it's uploaded first because most ATSs parse it
  and prefill (and sometimes overwrite) contact fields.
- Any required field you can't fill from the profile → **ask the user before filling**. Batch all
  such questions into one AskUserQuestion / message.
- Leave opt-in checkboxes (marketing, "save my answers", talent network) at the site default and
  mention them in the review so the user can choose.

### 4. Fill (never submits)

```bash
node scripts/fill.mjs <runDir>/plan.json
```

Detailed timestamped log per field. Writes `state.json` (per-field result, required-but-empty
list, page errors, captcha) and `filled.png`. The tab stays open in Moli, tagged with
`window.name = sessionId`.

If a field failed or a required field is empty: fix the plan (or patch the live tab with a small
CDP script — see `references/moli-playbook.md`) and re-check. Don't hand a broken form to the user.

### 5. Review with the user

Look at `filled.png` yourself first (Read it). Then show a compact table: field → value, resume
file used, opt-in checkboxes, captcha present, anything you guessed. Ask: **"submit" or "cancel"?**

### 6. Submit (only after explicit yes)

```bash
node scripts/submit.mjs <runDir>/plan.json
```

Pre-checks the tab (resume still attached, no validation errors), clicks the submit button via
JS, waits, and writes `result.json` + `result.png`. Exit code 0 = success page detected,
3 = no success signal (read `result.json` — validation error, captcha, or a further step).

If the user cancels: close the tab or just stop the server. Nothing is sent until submit.

### 7. Track

Update job-skill's `job_tracker.xlsx` (use the xlsx skill): set Status = `Applied`,
Date Applied = today, Notes = "via moli-job-apply; resume: <file>". Add the row if the job isn't
tracked yet. Remind about follow-up in 7–10 days.

## Batch mode (after `/job-skill search`)

For each match the user picks: steps 1–4 for all of them first, then one review message listing
every filled application with its screenshot, and let the user approve **per job** (e.g.
"submit 1, 3; skip 2"). Run `submit.mjs` only for approved ones. Use a distinct `sessionId` /
`runDir` per job (`runs/<company>-<jobId>/`).

## Output style

Follow job-skill's output cleanliness: no tool narration or raw JSON in the final reply — just the
job, filled values, blockers/questions, and the result. Keep the detailed logs in the run dir.

## Files

- `scripts/lib.mjs` — Moli/CDP helpers (force-fill, JS option picking, upload + confirm, snapshots)
- `scripts/inspect.mjs` — read-only form inventory
- `scripts/fill.mjs` — fill from plan, screenshot, leave tab open, never submits
- `scripts/submit.mjs` — pre-check + submit + capture result
- `references/moli-playbook.md` — Moli quirks and fixes (read when something doesn't fill)
- `references/ats-notes.md` — per-ATS selectors and gotchas
- `profile.example.json`, `plan.example.json` — templates
