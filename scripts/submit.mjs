// Usage: node submit.mjs <plan.json>
// Only run after the user has explicitly confirmed this specific application.
// Re-checks the filled tab (resume present, no page errors), clicks the submit button
// via JS (Moli overlays often intercept pointer clicks), and records the outcome.
import fs from 'node:fs';
import path from 'node:path';
import { connect, findSessionPage, log, sleep, snapshotFields, clickButtonByText } from './lib.mjs';

const planPath = process.argv[2];
if (!planPath) { console.error('usage: node submit.mjs <plan.json>'); process.exit(2); }
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const dir = plan.sessionDir || path.dirname(planPath);

const { ctx } = await connect();
const page = await findSessionPage(ctx, plan.sessionId);
if (!page) { log('no open tab for session', plan.sessionId, '- re-run fill.mjs first'); process.exit(1); }

const pre = await snapshotFields(page);
const resumeName = plan.resume?.path ? path.basename(plan.resume.path) : null;
const resumeOk = !resumeName || (await page.evaluate((n) => (document.body.innerText + ' ' + document.body.textContent).includes(n), resumeName));
if (!resumeOk || pre.errors.length) {
  log('PRE-CHECK FAILED - not submitting.', { resumeOk, errors: pre.errors });
  process.exit(1);
}

const text = plan.submitText || 'Submit application';
const clicked = await clickButtonByText(page, text);
log(`clicked "${text}":`, clicked);
if (!clicked) { log('submit button not found; buttons on page:', pre.buttons.join(' | ')); process.exit(1); }

await sleep(12000);
const after = await page.evaluate(() => ({ url: location.href, text: document.body.innerText.replace(/\n{2,}/g, '\n').slice(0, 2000) }));
const post = await snapshotFields(page);
const success = /success|thank you|application (has been )?(received|submitted)|we.ve received/i.test(after.url + ' ' + after.text);
const result = { submittedAt: new Date().toISOString(), success, url: after.url, text: after.text, errors: post.errors, captcha: post.captcha };
fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify(result, null, 2));
await page.screenshot({ path: path.join(dir, 'result.png') }).catch(() => {});
log(success ? 'SUBMITTED - success page detected' : 'NO SUCCESS SIGNAL - check result.json / result.png', after.url);
if (post.errors.length) log('page errors:', post.errors.join(' | '));
process.exit(success ? 0 : 3);
