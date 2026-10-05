// Shared helpers for driving job application forms through a Moli CDP server.
// Moli reports most form elements as "hidden" to Playwright's actionability checks
// and does not paint some overlays, so every interaction here is either force-based
// or done through in-page JavaScript.
import { chromium } from 'playwright-core';

export const CDP = process.env.MOLI_CDP || 'http://127.0.0.1:9333';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const log = (...a) => console.log(new Date().toISOString(), ...a);

export async function connect() {
  const browser = await chromium.connectOverCDP(CDP);
  const ctx = browser.contexts()[0] ?? (await browser.newContext());
  return { browser, ctx };
}

// Pages are tagged with window.name = session id so later scripts find the exact tab
// (window.name survives same-tab navigations, e.g. to a /success page).
export async function findSessionPage(ctx, sessionId) {
  for (const p of ctx.pages()) {
    const name = await p.evaluate(() => window.name).catch(() => '');
    if (name === sessionId) return p;
  }
  return null;
}

// Installs window.__mjaLabel(el) in the page. Moli's innerText is often empty in
// --layout mode, so this uses textContent and walks: <label for>, aria-label,
// aria-labelledby, nearest container <label>/<legend>, placeholder, name.
export async function ensureHelpers(page) {
  await page.evaluate(() => {
    if (window.__mjaLabel) return;
    const t = (n) => (n?.textContent || '').replace(/\s+/g, ' ').replace(/\*/g, '').trim();
    window.__mjaText = (n) => (n?.innerText || '').trim() || t(n);
    window.__mjaLabel = (e) => {
      const own = (e.labels && e.labels[0] && t(e.labels[0])) || e.getAttribute('aria-label')
        || (e.getAttribute('aria-labelledby') || '').split(' ').map((id) => t(document.getElementById(id))).join(' ').trim();
      if (own) return own;
      let c = e.parentElement;
      for (let i = 0; i < 6 && c; i++, c = c.parentElement) {
        const l = c.querySelector('label, legend');
        if (l && !l.contains(e) && t(l)) return t(l);
      }
      return e.placeholder || e.name || '';
    };
  });
}

// Resolve a field spec ({ selector } or { label }) to a CSS selector usable by Playwright.
export async function resolveSelector(page, spec) {
  if (spec.selector) return spec.selector;
  await ensureHelpers(page);
  const id = await page.evaluate((label) => {
    const norm = (s) => (s || '').replace(/[*\s]+/g, ' ').trim().toLowerCase();
    const want = norm(label);
    const els = [...document.querySelectorAll('input, select, textarea')];
    const text = (e) => norm(window.__mjaLabel(e));
    const el = els.find((e) => text(e) === want) || els.find((e) => text(e).includes(want));
    if (!el) return null;
    if (!el.id) el.id = 'mja-' + Math.random().toString(36).slice(2, 9);
    return el.id;
  }, spec.label);
  if (!id) throw new Error(`no field found for label "${spec.label}"`);
  return `[id="${id}"]`;
}

export async function fillText(page, sel, value) {
  const el = page.locator(sel).first();
  await el.click({ force: true }).catch(() => {});
  await el.fill('', { force: true });
  await el.fill(String(value), { force: true });
  return el.inputValue();
}

// Combobox / custom select. Clears with the native setter (fill('') does not reliably
// clear React-controlled inputs), types `query`, then clicks the option whose
// title/text contains `match` via in-page JS.
export async function pickOption(page, sel, query, match = query) {
  const el = page.locator(sel).first();
  const isNativeSelect = await el.evaluate((e) => e.tagName === 'SELECT');
  if (isNativeSelect) {
    await el.selectOption({ label: match }, { force: true }).catch(() => el.selectOption(match, { force: true }));
    return el.evaluate((e) => e.options[e.selectedIndex]?.text);
  }
  await el.click({ force: true }).catch(() => {});
  await el.evaluate((e) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(e, '');
    e.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await el.pressSequentially(String(query), { delay: 40 });
  await sleep(1200);
  let res = await clickOption(page, match);
  if (!res.ok) {
    // List may not be open: toggle the chevron button inside the same wrapper and retry.
    await el.evaluate((e) => e.closest('[class*=wrapper], [class*=group], div')?.querySelector('button')?.click());
    await sleep(1000);
    res = await clickOption(page, match);
  }
  await sleep(600);
  return { ...res, value: await el.inputValue() };
}

async function clickOption(page, match) {
  return page.evaluate((m) => {
    const want = m.toLowerCase();
    const opts = [...document.querySelectorAll('[role=option], li[data-value], [class*=option]')];
    const label = (o) => (o.title || o.innerText || '').trim();
    const o = opts.find((o) => label(o).toLowerCase() === want) || opts.find((o) => label(o).toLowerCase().includes(want));
    if (!o) return { ok: false, sample: opts.slice(0, 8).map(label) };
    o.scrollIntoView?.();
    o.click();
    return { ok: true, picked: label(o) };
  }, match);
}

export async function setCheckbox(page, sel, checked) {
  return page.locator(sel).first().evaluate((e, want) => {
    if (e.checked !== want) e.click();
    return e.checked;
  }, Boolean(checked));
}

// File upload: try the visible "upload" button + filechooser first, then fall back to
// setting the <input type=file> directly and dispatching events. Afterwards, any
// confirm button (e.g. Eightfold's #confirmUploadResume) is clicked via JS because
// Moli does not paint the modal.
export async function uploadFile(page, path, { inputSelector = 'input[type=file]', confirmSelector } = {}) {
  try {
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 4000 }),
      page.evaluate(() => {
        const b = [...document.querySelectorAll('button, [role=button], label')].find((b) => /select file|upload|attach|choose file/i.test(b.innerText || b.getAttribute('aria-label') || ''));
        b?.click();
      }),
    ]);
    await chooser.setFiles(path);
    log('file set via filechooser');
  } catch {
    const inp = page.locator(inputSelector).first();
    await inp.setInputFiles(path);
    await inp.dispatchEvent('input');
    await inp.dispatchEvent('change');
    log('file set via input + events');
  }
  await sleep(4000);
  const confirmed = await page.evaluate((cs) => {
    const sels = [cs, '#confirmUploadResume', '[data-test-id*="confirm-upload"]'].filter(Boolean);
    for (const s of sels) {
      const b = document.querySelector(s);
      if (b) { b.click(); return s; }
    }
    return null;
  }, confirmSelector);
  if (confirmed) { log('clicked upload confirm', confirmed); await sleep(7000); }
  const name = path.split('/').pop();
  return page.evaluate((n) => (document.body.innerText + ' ' + document.body.textContent).includes(n), name);
}

// Snapshot of every visible-ish form control: what inspect prints and what the
// pre-submit check compares against.
export async function snapshotFields(page) {
  await ensureHelpers(page);
  return page.evaluate(() => {
    const lbl = (e) => window.__mjaLabel(e);
    const fields = [...document.querySelectorAll('input, select, textarea')]
      .filter((e) => e.type !== 'hidden' && !/recaptcha/i.test(e.name || e.id))
      .map((e) => ({
        id: e.id || null,
        name: e.name || null,
        tag: e.tagName.toLowerCase(),
        type: e.type,
        role: e.getAttribute('role'),
        label: lbl(e),
        required: e.required || e.getAttribute('aria-required') === 'true',
        value: e.type === 'checkbox' || e.type === 'radio' ? e.checked : e.type === 'file' ? (e.files?.[0]?.name || '') : e.value,
        options: e.tagName === 'SELECT' ? [...e.options].slice(0, 40).map((o) => o.text) : undefined,
      }));
    const errors = [...document.querySelectorAll('[id$=_error], [role=alert], [class*=error-message]')].map((e) => window.__mjaText(e)).filter(Boolean);
    const buttons = [...document.querySelectorAll('button, input[type=submit]')].map((b) => window.__mjaText(b) || b.value || b.getAttribute('aria-label') || '').filter(Boolean);
    const captcha = {
      recaptcha: !!document.querySelector('iframe[src*="recaptcha"], [name=g-recaptcha-response]'),
      hcaptcha: !!document.querySelector('iframe[src*="hcaptcha"]'),
      turnstile: !!document.querySelector('iframe[src*="challenges.cloudflare"], .cf-turnstile'),
    };
    return { url: location.href, title: document.title, fields, errors, buttons: [...new Set(buttons)], captcha };
  });
}

export async function clickButtonByText(page, text) {
  await ensureHelpers(page);
  return page.evaluate((t) => {
    const b = [...document.querySelectorAll('button, input[type=submit], [role=button]')].find((b) => (window.__mjaText(b) || b.value || '') === t);
    if (!b) return false;
    b.click();
    return true;
  }, text);
}
