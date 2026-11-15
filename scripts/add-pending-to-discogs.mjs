#!/usr/bin/env node
// Add non-suspect entries from pending-vinyl.json to the Dornosaur Discogs collection.
//
//   node scripts/add-pending-to-discogs.mjs           # dry run: show the pressing picked for each
//   node scripts/add-pending-to-discogs.mjs --apply   # add them to the collection (folder 1, "Uncategorized")
//
// Pressing choice: among vinyl releases matching artist + title, the one most Discogs
// users own. Specific pressing doesn't matter for the site; correct it on Discogs if wanted.
// Suspect entries are always skipped. Entries already in the collection are skipped.
// On --apply, added entries are removed from pending-vinyl.json.
//
// Auth: DISCOGS_TOKEN env var if set. Otherwise no Authorization header is sent, which
// works where a proxy injects it (e.g. a Claude cloud environment network secret).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const USERNAME = 'Dornosaur';
const API = 'https://api.discogs.com';
const USER_AGENT = 'DornosaurSiteUpdater/1.0 +https://dornosaur.com';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PENDING_PATH = path.join(ROOT, 'pending-vinyl.json');
const APPLY = process.argv.includes('--apply');

const headers = { 'User-Agent': USER_AGENT };
if (process.env.DISCOGS_TOKEN) headers.Authorization = `Discogs token=${process.env.DISCOGS_TOKEN}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DELAY = headers.Authorization ? 1100 : 2600; // 60 req/min authenticated, 25 unauthenticated

async function discogs(url, init = {}, attempt = 0) {
  const res = await fetch(url, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  await sleep(DELAY);
  if (res.status === 429 && attempt < 5) {
    await sleep(15000 * (attempt + 1));
    return discogs(url, init, attempt + 1);
  }
  if (!res.ok) throw new Error(`Discogs ${res.status} on ${url}: ${(await res.text()).slice(0, 300)}`);
  return res.status === 204 ? null : res.json();
}

const norm = (s) =>
  s.toLowerCase()
    .replace(/\(\d+\)/g, '') // Discogs artist disambiguation, e.g. "Heart (2)"
    .replace(/^the\s+/, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

async function collectionKeys() {
  const keys = new Set();
  let url = `${API}/users/${USERNAME}/collection/folders/0/releases?per_page=100`;
  while (url) {
    const data = await discogs(url);
    for (const r of data.releases) {
      const b = r.basic_information;
      keys.add(norm(b.title));
      keys.add(`${norm(b.artists.map((a) => a.name).join(' '))}|${norm(b.title)}`);
    }
    url = data.pagination?.urls?.next;
  }
  return keys;
}

async function pickRelease(entry) {
  const q = new URLSearchParams({
    type: 'release', format: 'Vinyl', artist: entry.artist, release_title: entry.title, per_page: '50',
  });
  let { results } = await discogs(`${API}/database/search?${q}`);
  if (!results.length) {
    // Retry with a looser free-text query (soundtracks, compilations with odd artist credits).
    const q2 = new URLSearchParams({ type: 'release', format: 'Vinyl', q: `${entry.artist} ${entry.title}`, per_page: '50' });
    ({ results } = await discogs(`${API}/database/search?${q2}`));
  }
  if (!results.length) return null;
  // Full-length LPs only: no singles/EPs (7", 4" etc.) and no unofficial releases.
  const fmt = (r) => r.format || [];
  const lps = results.filter((r) => fmt(r).includes('LP') && !fmt(r).includes('Unofficial Release')
    && !fmt(r).some((f) => /Single|EP|^\d+"$/.test(f) && f !== '12"'));
  const pool = lps.length ? lps : results.filter((r) => !fmt(r).includes('Unofficial Release'));
  if (!pool.length) return null;
  // Rank: exact title, then title containing ours, then anything; most owned first within a tier.
  const want = norm(entry.title);
  const tier = (r) => {
    const t = norm(r.title.split(' - ').slice(1).join(' - '));
    return t === want ? 0 : t.includes(want) || want.includes(t) ? 1 : 2;
  };
  pool.sort((a, b) => tier(a) - tier(b) || (b.community?.have || 0) - (a.community?.have || 0));
  return pool[0];
}

// The collection is private. Without auth, a dry run checks against vinyl.json
// (the daily mirror of the collection); --apply always requires the live collection.
async function ownedKeys() {
  try {
    return await collectionKeys();
  } catch (err) {
    if (APPLY || !/Discogs 40[13]/.test(err.message)) throw err;
    console.log('(no Discogs auth — dry run is checking against src/data/vinyl.json)\n');
    const vinyl = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'vinyl.json'), 'utf8'));
    return new Set(vinyl.map((r) => `${norm(r.artist)}|${norm(r.title)}`));
  }
}

const pending = JSON.parse(fs.readFileSync(PENDING_PATH, 'utf8'));
const owned = await ownedKeys();
const added = new Set();
const rows = [];

for (const entry of pending) {
  const label = `${entry.artist} — ${entry.title}`;
  if (entry.suspect) { rows.push(['SKIP suspect', label, '']); continue; }
  if (owned.has(`${norm(entry.artist)}|${norm(entry.title)}`)) { rows.push(['SKIP owned', label, '']); continue; }
  const rel = await pickRelease(entry);
  if (!rel) { rows.push(['NOT FOUND', label, '']); continue; }
  const desc = `${rel.title} [${rel.year || '?'}, ${(rel.format || []).join(', ')}, ${rel.community?.have ?? 0} own] id=${rel.id}`;
  if (APPLY) {
    await discogs(`${API}/users/${USERNAME}/collection/folders/1/releases/${rel.id}`, { method: 'POST' });
    added.add(label);
    rows.push(['ADDED', label, desc]);
  } else {
    rows.push(['WOULD ADD', label, desc]);
  }
  console.log(`${rows.at(-1)[0].padEnd(12)} ${label}\n${' '.repeat(13)}→ ${desc}`);
}

for (const [status, label] of rows.filter((r) => r[0].startsWith('SKIP') || r[0] === 'NOT FOUND')) {
  console.log(`${status.padEnd(12)} ${label}`);
}

if (APPLY && added.size) {
  const remaining = pending.filter((e) => !added.has(`${e.artist} — ${e.title}`));
  fs.writeFileSync(PENDING_PATH, JSON.stringify(remaining, null, 2) + '\n');
  console.log(`\nAdded ${added.size}; ${remaining.length} left in pending-vinyl.json.`);
} else if (!APPLY) {
  console.log(`\nDry run. ${rows.filter((r) => r[0] === 'WOULD ADD').length} would be added. Re-run with --apply.`);
}
