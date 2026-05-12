const fs = require('fs');
const path = require('path');

const USERNAME = 'Dornosaur';
const TOKEN = process.env.DISCOGS_TOKEN;
const VINYL_PATH = path.join(__dirname, '..', 'src', 'data', 'vinyl.json');
const USER_AGENT = 'DornosaurSiteUpdater/1.0 +https://dornosaur.com';

if (!TOKEN) {
  console.error('DISCOGS_TOKEN env var is required');
  process.exit(1);
}

async function discogs(url) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Discogs token=${TOKEN}`,
      'User-Agent': USER_AGENT,
    },
  });
  if (!res.ok) {
    throw new Error(`Discogs ${res.status} on ${url}: ${await res.text()}`);
  }
  // Discogs rate limit: 60/min authenticated. Throttle gently.
  await new Promise((r) => setTimeout(r, 1100));
  return res.json();
}

async function fetchCollection() {
  const releases = [];
  let page = 1;
  while (true) {
    const data = await discogs(
      `https://api.discogs.com/users/${USERNAME}/collection/folders/0/releases?per_page=100&page=${page}&sort=added&sort_order=asc`
    );
    releases.push(...data.releases);
    if (!data.pagination || page >= data.pagination.pages) break;
    page += 1;
  }
  return releases;
}

function pickFormat(formats) {
  if (!Array.isArray(formats) || formats.length === 0) return 'LP';
  const f = formats[0];
  const qty = parseInt(f.qty, 10) || 1;
  if (qty === 1) return 'LP';
  return `${qty}×LP`;
}

function inferGenre(release) {
  const genres = (release.basic_information.genres || []).map((g) => g.toLowerCase());
  const styles = (release.basic_information.styles || []).map((s) => s.toLowerCase());
  const all = [...genres, ...styles].join(' ');
  if (all.includes('hip hop') || all.includes('rap')) return 'hiphop';
  if (all.includes('rock') || all.includes('metal')) return 'rock';
  if (all.includes('funk') || all.includes('soul') || all.includes('r&b') || all.includes('pop')) return 'soul';
  return 'rock';
}

function key(artist, title) {
  return `${artist}::${title}`.toLowerCase().trim();
}

async function main() {
  const existingArr = fs.existsSync(VINYL_PATH) ? JSON.parse(fs.readFileSync(VINYL_PATH, 'utf8')) : [];
  const existingByKey = new Map(existingArr.map((r) => [key(r.artist, r.title), r]));

  console.log(`Fetching collection for ${USERNAME}...`);
  const collection = await fetchCollection();
  console.log(`Got ${collection.length} releases. Fetching master years...`);

  const out = [];
  for (const item of collection) {
    const bi = item.basic_information;
    const artist = (bi.artists || []).map((a) => a.name.replace(/\s*\(\d+\)$/, '')).join(', ') || 'Unknown';
    const title = bi.title;
    const pressYear = bi.year || null;

    let originalYear = pressYear;
    if (bi.master_id) {
      try {
        const master = await discogs(`https://api.discogs.com/masters/${bi.master_id}`);
        if (master.year) originalYear = master.year;
      } catch (err) {
        console.warn(`  master ${bi.master_id} failed: ${err.message}`);
      }
    }

    const existing = existingByKey.get(key(artist, title));

    out.push({
      title,
      artist,
      year: originalYear,
      pressYear,
      cover: bi.cover_image || existing?.cover || '',
      genre: existing?.genre || inferGenre(item),
      label: (bi.labels && bi.labels[0]?.name) || existing?.label || '',
      format: pickFormat(bi.formats),
      pressing: existing?.pressing ?? null,
    });
  }

  // Sort: genre group, then artist, then year
  const genreOrder = { hiphop: 0, rock: 1, hardrock: 1.5, soul: 2 };
  out.sort((a, b) => {
    const g = (genreOrder[a.genre] ?? 99) - (genreOrder[b.genre] ?? 99);
    if (g !== 0) return g;
    const ar = a.artist.localeCompare(b.artist);
    if (ar !== 0) return ar;
    return (a.year || 0) - (b.year || 0);
  });

  const before = JSON.stringify(existingArr);
  const after = JSON.stringify(out, null, 2);
  fs.writeFileSync(VINYL_PATH, after + '\n');

  console.log(`\nWrote ${out.length} records to vinyl.json`);
  console.log('By genre:', Object.fromEntries(
    [...new Set(out.map((r) => r.genre))].map((g) => [g, out.filter((r) => r.genre === g).length])
  ));
  if (before === JSON.stringify(out)) console.log('No changes.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
