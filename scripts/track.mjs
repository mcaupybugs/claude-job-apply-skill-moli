// Application tracker as a plain CSV (opens in Excel / Sheets / Numbers; no extra deps).
//
//   node track.mjs add    --tracker job_tracker.csv --from ./runs/search.json [--min-fit 60]
//   node track.mjs set    --tracker job_tracker.csv --key "<company>|<jobId>" Status=Applied "Date Applied=2026-10-05"
//   node track.mjs list   --tracker job_tracker.csv [--status Applied]
//   node track.mjs stats  --tracker job_tracker.csv
//
// Rows are keyed by "Company|Job ID". `add` takes jobs from search.mjs output (optionally with a
// `fit` number Claude added after scoring) and skips ones already tracked.
import fs from 'node:fs';

export const COLUMNS = [
  'Key', 'Date Found', 'Company', 'Role', 'Job ID', 'Source', 'Location', 'Posted Date', 'Job URL', 'Apply URL',
  'Fitness', 'Resume', 'Cover Letter', 'Status', 'Date Applied', 'Response Date', 'Outcome', 'Interview Stage',
  'Rejection Reason', 'Follow-up Date', 'Next Action', 'Notes',
];
// Status flow: Found -> Ready to Apply -> Applied -> Acknowledged -> Online Assessment ->
// Interview R1 -> Interview R2 -> HR Round -> Offer | Rejected | Ghosted (21+ days, no reply)

const [cmd, ...rest] = process.argv.slice(2);
const opt = {}; const sets = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) opt[rest[i].slice(2)] = rest[i + 1]?.startsWith('--') ? true : rest[++i];
  else sets.push(rest[i]);
}
const file = opt.tracker || 'job_tracker.csv';
const today = new Date().toISOString().slice(0, 10);

function parse(csv) {
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (q) { if (ch === '"' && csv[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return (body || []).filter((r) => r.some(Boolean)).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}
const esc = (v) => (/[",\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));
const load = () => (fs.existsSync(file) ? parse(fs.readFileSync(file, 'utf8')) : []);
const save = (rows) => fs.writeFileSync(file, [COLUMNS.join(','), ...rows.map((r) => COLUMNS.map((c) => esc(r[c])).join(','))].join('\n') + '\n');

const rows = load();
if (cmd === 'add') {
  const { jobs } = JSON.parse(fs.readFileSync(opt.from, 'utf8'));
  const min = opt['min-fit'] ? Number(opt['min-fit']) : null;
  let added = 0;
  for (const j of jobs) {
    if (min != null && (j.fit ?? 0) < min) continue;
    const key = `${j.company}|${j.id}`;
    if (rows.some((r) => r.Key === key)) continue;
    rows.push({
      Key: key, 'Date Found': today, Company: j.company, Role: j.title, 'Job ID': j.id, Source: j.ats || j.source || '',
      Location: j.location, 'Posted Date': (j.postedAt || '').slice(0, 10), 'Job URL': j.url, 'Apply URL': j.applyUrl || j.url,
      Fitness: j.fit != null ? `${j.fit}%` : '', Resume: j.resume || '', 'Cover Letter': j.coverLetter || '', Status: 'Found',
    });
    added++;
  }
  save(rows);
  console.log(`added ${added}, total ${rows.length} -> ${file}`);
} else if (cmd === 'set') {
  const r = rows.find((x) => x.Key === opt.key);
  if (!r) { console.error(`no row with Key "${opt.key}"`); process.exit(1); }
  for (const s of sets) { const k = s.slice(0, s.indexOf('=')); const v = s.slice(s.indexOf('=') + 1); if (!COLUMNS.includes(k)) { console.error(`unknown column ${k}`); process.exit(1); } r[k] = v; }
  save(rows);
  console.log(`updated ${opt.key}:`, sets.join(', '));
} else if (cmd === 'list') {
  for (const r of rows.filter((x) => !opt.status || x.Status === opt.status)) console.log(`${r.Status.padEnd(18)} ${r.Company} | ${r.Role} | fit ${r.Fitness || '-'} | applied ${r['Date Applied'] || '-'} | ${r['Apply URL']}`);
} else if (cmd === 'stats') {
  const by = (k) => rows.reduce((m, r) => ((m[r[k] || '(blank)'] = (m[r[k] || '(blank)'] || 0) + 1), m), {});
  const applied = rows.filter((r) => r['Date Applied']);
  const responded = applied.filter((r) => r.Outcome || !['Applied', 'Ghosted'].includes(r.Status));
  const stale = applied.filter((r) => r.Status === 'Applied' && (Date.now() - Date.parse(r['Date Applied'])) / 86400000 >= 7);
  console.log(JSON.stringify({
    total: rows.length, applied: applied.length, responseRate: applied.length ? `${Math.round((100 * responded.length) / applied.length)}%` : 'n/a',
    byStatus: by('Status'), bySource: by('Source'),
    followUpDue: stale.map((r) => `${r.Company} (${r.Role}) applied ${r['Date Applied']}`),
  }, null, 2));
} else {
  console.error('commands: add | set | list | stats'); process.exit(2);
}
