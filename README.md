# claude-job-apply-skill-moli

A [Claude Code](https://claude.com/claude-code) skill that fills and submits job applications on
company career pages / ATS forms using the [Moli](https://github.com/lexmount/moli) headless
browser — and **always stops for your confirmation before submitting**.

It's designed as the "last mile" for a job-search skill (finding jobs, scoring fit, tailoring
resumes): this skill takes a job URL, opens the application form in Moli, fills it from your
profile, uploads your (tailored) resume, shows you a screenshot, and submits only when you say so.

## What it does

1. **Inspect** the apply form — every field, label, required flag, dropdown options, captcha presence.
2. **Fill** it from your profile (`profile.json`) via a per-job `plan.json` — resume first (most ATSs
   parse it and prefill), then contact fields, dropdowns, checkboxes. Never submits.
3. **Review** — screenshot + field table for you to check.
4. **Submit** only after an explicit "submit" for that job; detects the success page.
5. **Track** — marks the job as Applied in your job tracker spreadsheet.

Batch mode: fill several jobs, then approve each one individually ("submit 1, 3; skip 2").

## Safety rules built into the skill

- Every submission needs explicit per-job confirmation; unattended runs never submit.
- No CAPTCHA bypassing — visible challenges are handed back to you.
- No account creation, logins, or passwords (e.g. Workday sign-up → handed back to you).
- Never invents answers (salary, visa, notice period, EEO questions, "why us") — it asks you.
- Never adds skills/experience that aren't on your resume.

## Requirements

- Claude Code
- [Moli](https://github.com/lexmount/moli):
  ```bash
  curl --proto '=https' --tlsv1.2 -fsSL https://github.com/lexmount/moli/releases/latest/download/moli-installer.sh | sh
  ```
- Node.js 18+ (scripts use `playwright-core` connected to Moli over CDP — no Chromium download needed)

## Install

```bash
git clone https://github.com/mcaupybugs/claude-job-apply-skill-moli.git ~/.claude/skills/moli-job-apply
cd ~/.claude/skills/moli-job-apply/scripts && npm install
```

Then in Claude Code: *"apply to this job: &lt;url&gt;"*.

Create your `profile.json` from `profile.example.json` (or let the skill build it from your resume).
`profile.json`, resumes, and `runs/` are git-ignored.

## Using the scripts directly

```bash
moli serve --layout --port 9333 &                 # --layout enables screenshots
node scripts/inspect.mjs "<apply-url>" ./runs/x   # list fields (read-only)
node scripts/fill.mjs ./runs/x/plan.json          # fill + screenshot, does NOT submit
node scripts/submit.mjs ./runs/x/plan.json        # submit (only after you've reviewed)
```

Set `MOLI_CDP` to use a different endpoint. See `plan.example.json` for the plan format.

## Supported ATSs

| ATS | Status |
|---|---|
| Eightfold | ✅ verified end-to-end |
| Greenhouse, Lever, Ashby, SmartRecruiters | notes only — inspect first, PRs welcome |
| Workday, iCIMS, Taleo | usually require an account → handed back to you |

`references/ats-notes.md` has per-ATS selectors and gotchas; `references/moli-playbook.md`
documents Moli-specific quirks (elements reported hidden, unpainted modals, React comboboxes,
overlays intercepting clicks) and their fixes. If you get a new ATS working, please add a section.

## Disclaimer

You're responsible for what gets submitted in your name and for following each site's terms of
use. Review every application before confirming.
