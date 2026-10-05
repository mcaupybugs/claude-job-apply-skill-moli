# ATS notes

Status: **Eightfold = verified end-to-end** (Oct 2026, submitted successfully).
Others = starting points from public form structure; verify with `inspect.mjs` before trusting.

## Eightfold (`app.eightfold.ai/careers…`, `*.eightfold.ai`) — VERIFIED

- Search API (no auth, used by search.mjs): `https://<host>/api/pcsx/search?domain=<domain>&query=<q>&location=<loc>&start=<n>`
  → `data.positions[]` (`id, name, locations, postedTs, department, workLocationOption, positionUrl`), 10 per page, `data.count`.
  Details: `/api/pcsx/position_details?position_id=<id>&domain=<domain>&hl=en`. Some hosts rate-limit (429).
  Verified hosts: app.eightfold.ai (domain volkscience.com), apply.careers.microsoft.com (microsoft.com),
  paypal.eightfold.ai (paypal.com), careers.dexcom.com (dexcom.com).
- Job page: `/careers/job/<pid>?domain=<domain>`. The listing URL with `pid=` can render "0 jobs" — use the job page.
- Apply form: `/careers/apply?pid=<pid>&domain=<domain>`. Single page, two sections (Resume, Contact Information).
- Wait for `#Contact_Information_email` with `state: 'attached'`.
- Resume: `input[type=file]` → confirm modal → JS-click `#confirmUploadResume`. Success = filename appears
  with Replace/Delete icons. Resume is parsed: State (and sometimes country code) get prefilled.
- Fields: `#Contact_Information_email`, `#Contact_Information_firstname`, `#Contact_Information_lastname`,
  `#Contact_Information_phone`, `#Contact_Information_city`.
- Phone country code: combobox `aria-label="Country code"` (id like `#input-4`, not stable) → `query: "India", match: "(+91)"`.
  Option title format: `🇮🇳 (+91) India`.
- Country: combobox placeholder "Select" (id like `#input-7`) → `match: "India"`. A State combobox appears after.
- Checkbox "Save my answers for future applications" defaults to checked.
- Submit button text: `Submit application`; sticky footer intercepts pointer clicks → JS click.
- Success: URL `/careers/apply/success?…`, text "Thank you for your application, <First>!".
- Invisible reCAPTCHA present; did not block.
- Ids like `input-4` are generated — prefer `label` in plans (`"label": "Country code"`).

## Greenhouse (`boards.greenhouse.io`, `job-boards.greenhouse.io`) — unverified

- Usually one page. Ids: `#first_name`, `#last_name`, `#email`, `#phone`, resume `input[type=file]` under "Resume/CV"
  (sometimes an "Attach" button + hidden input).
- Custom questions use `question_<n>` ids; EEO section at the bottom (voluntary).
- Location field is an autocomplete — treat as `combo`.
- Submit text: `Submit Application` / `Submit application`.

## Lever (`jobs.lever.co/<co>/<id>/apply`) — unverified

- Fields by `name`: `name` (full name), `email`, `phone`, `org` (current company), `urls[LinkedIn]`, `urls[GitHub]`.
- Resume: `input[name=resume]`; Lever parses it and prefills.
- hCaptcha is common → likely needs user hand-off.
- Submit text: `Submit application`.

## Ashby (`jobs.ashbyhq.com/<co>/<id>/application`) — unverified

- React form; labels are reliable → use `label` specs. Resume upload autofills.
- Yes/No questions are button groups, not radios — need a JS click on the button text.

## Workday (`*.myworkdayjobs.com`) — usually blocked by rule 3

- Requires account creation / sign-in before applying → stop and hand to the user.
- If the user signs in themselves in a regular browser, applying there is faster than via Moli.

## SmartRecruiters / iCIMS / Taleo — unverified

- iCIMS and Taleo often embed the form in an iframe and require accounts. Inspect first; if an
  account is required, hand off.

## Adding a new ATS

After a successful run, add a section here: URL patterns, wait selector, upload flow, stable
selectors/labels, combobox option formats, submit text, success signal, captcha seen.
