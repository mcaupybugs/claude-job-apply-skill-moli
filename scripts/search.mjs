// Usage:
//   node search.mjs --companies ../data/companies.json --keywords "backend,platform,distributed" \
//     --locations "bengaluru,bangalore,hyderabad,india,remote" --days 14 \
//     [--exclude "intern,principal,manager"] [--with-description] [--out ./runs/search.json]
//     [--only "stripe,meesho"] [--ef-location "India"]   (Eightfold location query override)
//
// Pulls open roles straight from company ATS job boards (Greenhouse, Lever, Ashby, Eightfold),
// so every result is a live posting with a fillable apply URL. Filters by title keywords,
// location, and posting age; writes normalized JSON and prints a table.
// Fitness scoring against the candidate's resume is done by Claude afterwards (see SKILL.md).
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
    return acc;
  }, []),
);
const here = path.dirname(new URL(import.meta.url).pathname);
const companiesPath = args.companies || path.join(here, '..', 'data', 'companies.json');
const list = (s) => (typeof s === 'string' ? s.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean) : []);
const KEYWORDS = list(args.keywords);
const EXCLUDE = list(args.exclude);
const LOCATIONS = list(args.locations);
const DAYS = args.days ? Number(args.days) : null;
const WITH_DESC = Boolean(args['with-description']);
const OUT = args.out || `./runs/search-${new Date().toISOString().slice(0, 10)}.json`;
const ONLY = list(args.only); // optional: restrict to company names

const log = (...a) => console.error(new Date().toISOString(), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0 Safari/537.36' };
const stripHtml = (h = '') => h.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

// GET JSON with retry on 429/5xx. If still blocked (403/429) and `moliOrigin` is given,
// fetch it from inside a page on that origin via `moli fetch --eval` (browser context,
// cookies, same-origin) — the reason Moli is useful for search too.
async function getJSON(url, { moliOrigin } = {}) {
  let status;
  for (const wait of [0, 2000, 6000]) {
    if (wait) await sleep(wait);
    try {
      const r = await fetch(url, { headers: UA });
      status = r.status;
      if (r.ok) return await r.json();
      if (r.status !== 429 && r.status < 500) break;
    } catch (e) { status = e.cause?.code || e.message; }
  }
  if (moliOrigin) {
    log(`  plain fetch ${status} -> retrying via moli in ${moliOrigin}`);
    const u = new URL(url);
    const expr = `fetch(${JSON.stringify(u.pathname + u.search)}).then(r => r.text())`;
    const text = await new Promise((res) => execFile('moli', ['fetch', '--wait', 'networkidle', '--eval', expr, moliOrigin], { maxBuffer: 64 << 20, timeout: 120000 }, (err, out) => res(err ? '' : out)));
    try { return JSON.parse(text); } catch { /* fall through */ }
  }
  throw new Error(`GET ${url} -> ${status}`);
}

const sources = {
  async greenhouse(c) {
    const d = await getJSON(`https://boards-api.greenhouse.io/v1/boards/${c.slug}/jobs${WITH_DESC ? '?content=true' : ''}`);
    return d.jobs.map((j) => ({
      id: String(j.id), title: j.title, location: j.location?.name || '', department: j.departments?.[0]?.name || '',
      postedAt: j.first_published || j.updated_at, url: j.absolute_url, applyUrl: j.absolute_url,
      remote: /remote/i.test(j.location?.name || ''), description: WITH_DESC ? stripHtml(j.content) : undefined,
    }));
  },
  async lever(c) {
    const d = await getJSON(`https://api.lever.co/v0/postings/${c.slug}?mode=json`);
    return d.map((j) => ({
      id: j.id, title: j.text, location: (j.categories?.allLocations || [j.categories?.location]).filter(Boolean).join('; '),
      department: j.categories?.team || j.categories?.department || '', postedAt: new Date(j.createdAt).toISOString(),
      url: j.hostedUrl, applyUrl: j.applyUrl, remote: j.workplaceType === 'remote',
      description: WITH_DESC ? `${j.descriptionPlain || ''} ${(j.lists || []).map((l) => `${l.text}: ${stripHtml(l.content)}`).join(' ')}`.trim() : undefined,
    }));
  },
  async ashby(c) {
    const d = await getJSON(`https://api.ashbyhq.com/posting-api/job-board/${c.slug}`);
    return d.jobs.filter((j) => j.isListed !== false).map((j) => ({
      id: j.id, title: j.title, location: [j.location, ...(j.secondaryLocations || []).map((l) => l.location)].filter(Boolean).join('; '),
      department: j.department || j.team || '', postedAt: j.publishedAt, url: j.jobUrl, applyUrl: j.applyUrl,
      remote: Boolean(j.isRemote), description: WITH_DESC ? j.descriptionPlain : undefined,
    }));
  },
  async eightfold(c) {
    const host = c.host || 'app.eightfold.ai';
    const origin = `https://${host}/careers?domain=${c.domain}`;
    const loc = encodeURIComponent(args['ef-location'] || c.locationQuery || '');
    const out = [];
    const seen = new Set();
    // Eightfold search is relevance-ranked full text: one query per keyword, deduped.
    for (const kw of KEYWORDS.length ? KEYWORDS : ['']) {
    const q = encodeURIComponent(kw);
    for (let start = 0; start < (c.maxResults || 100); start += 10) {
      const d = await getJSON(`https://${host}/api/pcsx/search?domain=${c.domain}&query=${q}&location=${loc}&start=${start}`, { moliOrigin: origin });
      const ps = d.data?.positions || [];
      for (const p of ps) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        out.push({
          id: String(p.id), title: p.name, location: (p.locations || []).join('; '), department: p.department || '',
          postedAt: p.postedTs ? new Date(p.postedTs * 1000).toISOString() : null,
          url: `https://${host}${p.positionUrl}?domain=${c.domain}`,
          applyUrl: `https://${host}/careers/apply?pid=${p.id}&domain=${c.domain}`,
          remote: /remote/i.test(p.workLocationOption || ''),
        });
      }
      if (ps.length < 10 || start + 10 >= (d.data?.count ?? 0)) break;
      await sleep(400);
    }
    }
    if (WITH_DESC) {
      for (const j of out.filter(match).slice(0, 25)) {
        try {
          const d = await getJSON(`https://${host}/api/pcsx/position_details?position_id=${j.id}&domain=${c.domain}&hl=en`, { moliOrigin: origin });
          j.description = stripHtml(d.data?.jobDescription || d.data?.job_description || '');
        } catch (e) { log(`  ${c.name}: description ${j.id} failed: ${e.message}`); }
        await sleep(300);
      }
    }
    return out;
  },
};

function match(j) {
  const title = (j.title || '').toLowerCase();
  if (KEYWORDS.length && !KEYWORDS.some((k) => title.includes(k))) return false;
  if (EXCLUDE.some((k) => title.includes(k))) return false;
  if (LOCATIONS.length) {
    const loc = (j.location || '').toLowerCase();
    const ok = LOCATIONS.some((l) => (l === 'remote' ? j.remote || loc.includes('remote') : loc.includes(l)));
    if (!ok) return false;
  }
  if (DAYS && j.postedAt) {
    const age = (Date.now() - Date.parse(j.postedAt)) / 86400000;
    if (age > DAYS) return false;
  }
  return true;
}

const companies = JSON.parse(fs.readFileSync(companiesPath, 'utf8')).companies
  .filter((c) => !ONLY.length || ONLY.includes(c.name.toLowerCase()));
log(`searching ${companies.length} companies | keywords=${KEYWORDS.join('|') || '*'} exclude=${EXCLUDE.join('|') || '-'} locations=${LOCATIONS.join('|') || '*'} days=${DAYS ?? '*'}`);

const results = [];
const failures = [];
let i = 0;
async function worker() {
  while (i < companies.length) {
    const c = companies[i++];
    const fn = sources[c.ats];
    if (!fn) { failures.push({ company: c.name, error: `unknown ats ${c.ats}` }); continue; }
    try {
      const all = await fn(c);
      const hits = all.filter(match);
      log(`${c.name.padEnd(18)} ${c.ats.padEnd(10)} total=${String(all.length).padStart(4)} matched=${hits.length}`);
      for (const j of hits) results.push({ company: c.name, ats: c.ats, ...j });
    } catch (e) {
      log(`${c.name.padEnd(18)} ${c.ats.padEnd(10)} FAILED ${e.message}`);
      failures.push({ company: c.name, error: e.message });
    }
  }
}
await Promise.all(Array.from({ length: 4 }, worker));

results.sort((a, b) => Date.parse(b.postedAt || 0) - Date.parse(a.postedAt || 0));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ searchedAt: new Date().toISOString(), filters: { KEYWORDS, EXCLUDE, LOCATIONS, DAYS }, failures, jobs: results }, null, 2));

const fmt = (d) => (d ? new Date(d).toISOString().slice(0, 10) : 'n/a');
console.log(`\n${results.length} matching jobs (${failures.length} sources failed) -> ${OUT}\n`);
results.forEach((j, n) => console.log(`${String(n + 1).padStart(3)}. ${j.company} | ${j.title} | ${j.location.slice(0, 50)} | posted ${fmt(j.postedAt)} | ${j.ats}:${j.id}\n     ${j.applyUrl}`));
if (failures.length) console.log('\nfailed:', failures.map((f) => `${f.company} (${f.error})`).join(', '));
