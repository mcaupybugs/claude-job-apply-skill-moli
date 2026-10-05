// Usage: node fill.mjs <plan.json>
// Fills an application form from a plan, screenshots it, writes <sessionDir>/state.json,
// and EXITS WITHOUT SUBMITTING. The tab stays open in the Moli server, tagged with
// window.name = plan.sessionId, for submit.mjs to pick up after the user confirms.
//
// plan.json:
// {
//   "sessionId": "eightfold-1234567890",
//   "sessionDir": "./runs/eightfold-1234567890",
//   "url": "https://.../apply?...",
//   "waitFor": "#Contact_Information_email",        // optional
//   "resume": { "path": "/abs/resume.pdf" },         // optional; uploaded first (ATS may parse + prefill)
//   "fields": [
//     { "label": "Email", "kind": "text", "value": "me@x.com" },
//     { "selector": "#input-4", "kind": "combo", "query": "India", "match": "(+91)" },
//     { "label": "Country", "kind": "combo", "value": "India" },
//     { "label": "Save my answers", "kind": "checkbox", "value": true }
//   ],
//   "submitText": "Submit application"
// }
import fs from 'node:fs';
import path from 'node:path';
import { connect, log, sleep, resolveSelector, fillText, pickOption, setCheckbox, uploadFile, snapshotFields } from './lib.mjs';

const planPath = process.argv[2];
if (!planPath) { console.error('usage: node fill.mjs <plan.json>'); process.exit(2); }
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const dir = plan.sessionDir || path.dirname(planPath);
fs.mkdirSync(dir, { recursive: true });

const { ctx } = await connect();
const page = await ctx.newPage();
page.on('console', (m) => m.type() === 'error' && log('[page console.error]', m.text().slice(0, 160)));

log('goto', plan.url);
await page.goto(plan.url, { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => log('goto warning:', e.message.split('\n')[0]));
await page.evaluate((id) => { window.name = id; }, plan.sessionId);
if (plan.waitFor) await page.waitForSelector(plan.waitFor, { state: 'attached', timeout: 30000 });
await sleep(1500);
log('form loaded, tab tagged', plan.sessionId);

const report = [];
if (plan.resume?.path) {
  const ok = await uploadFile(page, plan.resume.path, plan.resume);
  log(`resume upload ${ok ? 'OK' : 'NOT CONFIRMED'}:`, path.basename(plan.resume.path));
  report.push({ field: 'resume', ok, value: path.basename(plan.resume.path) });
}

// Fill after the resume: many ATSs parse the resume and overwrite contact fields.
for (const f of plan.fields || []) {
  const name = f.label || f.selector;
  try {
    const sel = await resolveSelector(page, f);
    let got;
    if (f.kind === 'combo') { const r = await pickOption(page, sel, f.query ?? f.value, f.match ?? f.value); got = r.value; if (!r.ok) log(`  option not found for ${name}; sample:`, JSON.stringify(r.sample)); }
    else if (f.kind === 'checkbox') got = await setCheckbox(page, sel, f.value);
    else if (f.kind === 'file') got = await uploadFile(page, f.value, { inputSelector: sel });
    else got = await fillText(page, sel, f.value);
    log(`filled ${name} =`, JSON.stringify(got));
    report.push({ field: name, ok: true, value: got });
  } catch (e) {
    log(`FAILED ${name}:`, e.message.split('\n')[0]);
    report.push({ field: name, ok: false, error: e.message.split('\n')[0] });
  }
}

await sleep(1000);
const snap = await snapshotFields(page);
const emptyRequired = snap.fields.filter((x) => x.required && (x.value === '' || x.value === false) && x.type !== 'file');
fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify({ plan: planPath, report, emptyRequired, snapshot: snap }, null, 2));
await page.screenshot({ path: path.join(dir, 'filled.png'), fullPage: true }).catch((e) => log('screenshot failed:', e.message.split('\n')[0]));

log(`done. ${report.filter((r) => !r.ok).length} failures, ${emptyRequired.length} required fields still empty, ${snap.errors.length} page errors`);
if (emptyRequired.length) log('  empty required:', emptyRequired.map((x) => x.label || x.id).join(', '));
if (snap.errors.length) log('  page errors:', snap.errors.join(' | '));
log('captcha:', JSON.stringify(snap.captcha));
log(`NOT SUBMITTED. Review ${path.join(dir, 'filled.png')} then run: node submit.mjs ${planPath}`);
process.exit(0); // exit without browser.close() so the tab stays open in Moli
