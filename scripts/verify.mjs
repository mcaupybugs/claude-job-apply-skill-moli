// Usage: node verify.mjs <url> [url...]      or      node verify.mjs --file urls.txt
// Checks that job links found via web search (Naukri, LinkedIn, Instahyre, company pages…)
// are still live. Renders each page with `moli fetch` (handles JS-rendered job pages that a
// plain HTTP GET shows as empty) and looks for dead-posting signals.
// Prints one JSON line per URL: { url, live, status, title, reason }.
import fs from 'node:fs';
import { execFile } from 'node:child_process';

const argv = process.argv.slice(2);
const urls = argv[0] === '--file'
  ? fs.readFileSync(argv[1], 'utf8').split('\n').map((s) => s.trim()).filter(Boolean)
  : argv;
if (!urls.length) { console.error('usage: node verify.mjs <url...> | --file urls.txt'); process.exit(2); }

const DEAD = /job (is )?no longer (available|open|accepting)|position (has been )?(filled|closed)|no longer accepting applications|this job has expired|job not found|page not found|posting (has been )?(removed|closed)|requisition (is )?closed|0 jobs|we couldn.t find (that|this) job/i;
const LOGIN_WALL = /sign in to (view|apply)|log ?in to (view|continue)|join now to see/i;

function moliFetch(url) {
  return new Promise((res) => {
    execFile('moli', ['fetch', '--dump', 'json', '--wait', 'networkidle', url], { maxBuffer: 64 << 20, timeout: 90000 }, (err, out) => {
      if (err && !out) return res({ error: err.message.split('\n')[0] });
      try { res(JSON.parse(out)); } catch { res({ error: 'unparseable moli output' }); }
    });
  });
}

for (const url of urls) {
  const d = await moliFetch(url);
  if (d.error) { console.log(JSON.stringify({ url, live: false, reason: d.error })); continue; }
  const text = (d.html || '').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  let live = d.status >= 200 && d.status < 400;
  let reason = live ? 'ok' : `http ${d.status}`;
  const final = d.final_url || url;
  const redirectedUp = final !== url && new URL(url).pathname.startsWith(new URL(final).pathname.replace(/\/$/, '') + '/');
  if (live && (/[?&](error|notfound|expired)=|\/(404|not-?found|expired)\b/i.test(final) || redirectedUp)) {
    live = false; reason = `redirected away from posting -> ${final}`;
  } else if (live && DEAD.test(text)) { live = false; reason = `dead signal: "${text.match(DEAD)[0]}"`; }
  else if (live && LOGIN_WALL.test(text)) reason = 'login wall (posting may be live; apply needs the user)';
  else if (live && text.length < 400) { live = false; reason = 'page rendered almost empty'; }
  console.log(JSON.stringify({ url, final: d.final_url, live, status: d.status, title: d.title, reason }));
}
