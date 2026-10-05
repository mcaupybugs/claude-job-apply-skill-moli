// Usage: node inspect.mjs <apply-url> [outDir]
// Opens the apply form in Moli, lists every field (label, type, required, current value),
// buttons, and captcha presence. Read-only: nothing is typed or clicked.
import fs from 'node:fs';
import path from 'node:path';
import { connect, log, sleep, snapshotFields } from './lib.mjs';

const [url, outDir = '.'] = process.argv.slice(2);
if (!url) { console.error('usage: node inspect.mjs <apply-url> [outDir]'); process.exit(2); }

const { ctx } = await connect();
const page = await ctx.newPage();
log('goto', url);
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => log('goto warning:', e.message.split('\n')[0]));
await sleep(2000);
const snap = await snapshotFields(page);
await page.screenshot({ path: path.join(outDir, 'inspect.png'), fullPage: true }).catch((e) => log('screenshot failed (start moli with --layout):', e.message.split('\n')[0]));
fs.writeFileSync(path.join(outDir, 'inspect.json'), JSON.stringify(snap, null, 2));
log(`fields: ${snap.fields.length}, buttons: ${snap.buttons.join(' | ')}`);
for (const f of snap.fields) log(`  ${f.required ? '*' : ' '} [${f.type}${f.role ? '/' + f.role : ''}] ${f.label || '(no label)'}  id=${f.id ?? '-'}${f.options ? '  options=' + f.options.slice(0, 6).join(', ') + '…' : ''}`);
log('captcha:', JSON.stringify(snap.captcha));
await page.close();
process.exit(0);
