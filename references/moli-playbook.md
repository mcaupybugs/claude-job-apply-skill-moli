# Moli playbook — what breaks and how to fix it

Moli is a Rust headless browser with its own layout engine. It speaks CDP, so Playwright's
`connectOverCDP` works, but several Playwright assumptions don't hold. All of these were hit on a
real Eightfold application.

## Modes

| Need | Command |
|---|---|
| Read a page fast, no interaction | `moli fetch --dump markdown <url>` |
| Run one JS expression on a loaded page | `moli fetch --eval '<expr>' <url>` (promises awaited; use `--wait networkidle` for SPAs) |
| Interactive session (fill/click/upload) | `moli serve --layout --port 9333` + Playwright `connectOverCDP` |
| Screenshot | needs `--layout`; `fetch --dump screenshot_full --layout` or `page.screenshot()` |

`fetch` loads a page, does one thing, and exits — state does not carry between `fetch` calls.
Anything multi-step needs `serve`.

`--wait` values: `domcontentloaded | load | networkidle | domstable | done` (default `done`).
SPAs (Eightfold, Workday) render their forms after XHRs — use `networkidle` or `--wait-selector`.

zsh gotcha: don't put a bare `======` line in a shell command (zsh treats `=word` as a command lookup).

## Quirks → fixes

| Symptom | Cause | Fix (already in lib.mjs) |
|---|---|---|
| `waitForSelector` times out, "locator resolved to hidden <input>" | Moli geometry makes Playwright think elements are hidden | `waitForSelector(sel, { state: 'attached' })`; `fill(v, { force: true })` |
| `locator.click: Element is not visible` on options/buttons | same | click in-page: `page.evaluate(() => el.click())` |
| `<div class=footer…> intercepts pointer events` on Submit | sticky footer overlaps button in Moli's layout | JS click (`clickButtonByText`) |
| File input has a value but the uploader UI still says "Drag & drop" | ATS opened a confirm modal Moli doesn't paint (screenshot looks greyed out) | click the modal's confirm button via JS (`#confirmUploadResume` on Eightfold) |
| Combobox shows the typed text but nothing is selected | option list items not clicked | type query, then JS-click `[role=option]` whose title/text contains `match` |
| Combobox value becomes garbage like `+91ia` | ATS prefilled it from the resume; `fill('')` didn't clear a React-controlled input | clear via native value setter + `input` event before typing (`pickOption`) |
| Option list empty after typing | list not opened | JS-click the chevron button in the same wrapper, retry (`pickOption` does this) |
| Combobox shows the query text ("India") but the real value is set | display vs. filter text; toggling the list redraws it | re-read `inputValue()` after toggling; trust the post-toggle value |
| Script crashed mid-run | — | the tab survives in Moli; reconnect with `connectOverCDP` and find it via `window.name` (`findSessionPage`) |
| Many stale tabs after retries | each run opens a new tab | harmless; restarting `moli serve` clears them |

## Patching a live tab

When one field is wrong after `fill.mjs`, don't re-run the whole thing (the resume upload and
parse cost ~15s and may overwrite things). Connect a second client:

```js
import { connect, findSessionPage, pickOption } from './lib.mjs';
const { ctx } = await connect();
const page = await findSessionPage(ctx, '<sessionId>');
console.log(await pickOption(page, '#input-4', 'India', '(+91)'));
process.exit(0);   // never browser.close() — that can kill the tab
```

## Never call `browser.close()`

On a CDP connection it may tear down contexts/pages. Exit the Node process instead so the tab
stays alive between fill → review → submit.

## CAPTCHA

`snapshotFields().captcha` reports reCAPTCHA / hCaptcha / Turnstile presence. Invisible reCAPTCHA
v3 passed on Eightfold with Moli. A visible challenge = stop and hand off to the user.
