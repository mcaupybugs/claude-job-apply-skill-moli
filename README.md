# claude-job-apply-skill-moli

A [Claude Code](https://claude.com/claude-code) skill for the whole job hunt: it learns your profile from
your resume, **searches** company job boards and Indian job sites, **scores** how well you fit each role,
writes a **tailored resume + cover letter** per job, then **fills the application form** in the
[Moli](https://github.com/lexmount/moli) headless browser — and submits only when you type "submit".

> **Status: experimental.** Search works across Greenhouse, Lever, Ashby and Eightfold. Form filling is
> verified end-to-end on Eightfold; other ATS forms have notes but need real-world testing. Issues/PRs welcome.

## Why

Applying is mostly retyping the same name, email, phone and resume into a different form on every
career page. This automates the boring part and keeps you in charge of the decisions.

## What it does

```
you: find backend roles in Bangalore/Hyderabad, last 2 weeks
 → searches 30+ company job boards (+ Naukri/LinkedIn/etc. via web search)
 → scores each job against your resume (skills, YOE, domain, seniority…) with a one-line why
 → writes a tailored resume + cover letter per job
 → table: role · company · fit % · posted · apply link · "auto-fill ✅ / manual ⚠️"
you: fill 1, 3, 4
 → opens each form in Moli, uploads the right resume, fills fields, screenshots
 → asks you anything it doesn't know (salary, notice period, visa…)
you: submit 1, 4
 → submits those two, confirms the success page, updates job_tracker.csv
```

Also: `status` (reads application replies from Gmail if connected, else asks you), `automate`
(nightly search + morning report — never submits), `review` (weekly stats + what to change).

## Safety rules (built into the skill)

- Nothing is submitted without an explicit "submit" for **that** job. Scheduled runs never submit.
- Never lies on a resume, never invents form answers — it asks you.
- No CAPTCHA solving, no account creation, no passwords. Workday-style sign-up forms are handed back to you
  with the materials ready.
- Your profile, resumes and tracker live in a local workspace folder and never leave your machine except
  into the forms you approve.

## Install

1. [Moli](https://github.com/lexmount/moli):
   ```bash
   curl --proto '=https' --tlsv1.2 -fsSL https://github.com/lexmount/moli/releases/latest/download/moli-installer.sh | sh
   ```
2. The skill (Node.js 18+):
   ```bash
   git clone https://github.com/mcaupybugs/claude-job-apply-skill-moli.git ~/.claude/skills/moli-job-apply
   cd ~/.claude/skills/moli-job-apply/scripts && npm install
   ```
3. In Claude Code: *"/moli-job-apply setup"* (give it your resume), then *"find me jobs"* or
   *"apply to this: &lt;url&gt;"*.

## Scripts (usable without Claude)

```bash
cd scripts
node search.mjs --keywords "backend,platform" --locations "bengaluru,india,remote" --days 14 --out ../runs/s.json
node verify.mjs <job-url> ...                     # is this posting still live? (Moli-rendered)
moli serve --layout --port 9333 &                 # needed for the form scripts
node inspect.mjs "<apply-url>" ../runs/x          # list form fields (read-only)
node fill.mjs ../runs/x/plan.json                 # fill + screenshot, does NOT submit
node submit.mjs ../runs/x/plan.json               # submit after you've reviewed
node track.mjs stats --tracker job_tracker.csv
```

`data/companies.json` is a verified starter list (Razorpay, Groww, Databricks, Stripe, CRED, Meesho, Paytm,
OpenAI, Sarvam, Microsoft, PayPal, …). Add your own targets — `references/search.md` shows how to find a
company's ATS slug in a minute.

## Supported ATSs

| ATS | Search | Form filling |
|---|---|---|
| Eightfold | ✅ | ✅ verified |
| Greenhouse | ✅ | notes, untested |
| Lever | ✅ | notes, untested (hCaptcha common) |
| Ashby | ✅ | notes, untested |
| Workday / iCIMS / Taleo | via web search only | handed to you (needs an account) |
| Naukri / LinkedIn / Instahyre … | via web search | handed to you (login) |

## Layout

```
SKILL.md                     the skill (persona, workflow, rules)
references/                  search method + fit rubric, resume/cover-letter rules,
                             tracking/status/automation, Moli quirks, per-ATS notes
scripts/                     search, verify, inspect, fill, submit, track (+ lib)
data/companies.json          starter company → ATS list
profile.example.json         profile template      plan.example.json   form plan template
```

## Disclaimer

You're responsible for what's submitted in your name and for each site's terms of use. Review every
application before confirming.

## License

MIT
