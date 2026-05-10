import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AudibleApi } from 'audible-mcp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const AUTH_FILE = process.env.AUDIBLE_AUTH_FILE || 'C:/Users/ryanc/audible-auth.json';
const BOOKS_PATH = path.join(__dirname, '..', 'src', 'data', 'books.json');

function getGenre(book) {
  const t = (book.title || '').toLowerCase();
  const a = (book.author || '').toLowerCase();
  const s = (book.series || '').toLowerCase();

  if (s.includes('primal hunter') || s.includes('dungeon crawler carl') || s.includes('noobtown') ||
      s.includes('unbound') || s.includes('industrial strength magic') ||
      s.includes('cradle') || s.includes('last horizon')) return 'litrpg';

  if (s.includes('expeditionary force') || s.includes('bobiverse') || s.includes('old man') ||
      s.includes('lost colonies') || s.includes('forever war') || s.includes('ready player') ||
      s.includes('willful child')) return 'scifi';
  if (a.includes('andy weir') || a.includes('neal stephenson') || a.includes('china') ||
      a.includes('john scalzi') || a.includes('george orwell')) return 'scifi';
  if (t === 'embassytown' || t === '1984' || t === 'snow crash' || t === 'redshirts') return 'scifi';

  if (t.includes('final girl') || t === 'fantasticland' || t === 'billy summers' || t === 'odd thomas') return 'horror';
  if (a.includes('grady hendrix') || a.includes('mike bockoven') || a.includes('stephen king') || a.includes('dean koontz')) return 'horror';

  if (s.includes('stormlight') || s.includes('mistborn') || s.includes('cosmere') ||
      s.includes('wheel of time') || s.includes('malazan') || s.includes('first law') ||
      s.includes('kingkiller') || s.includes('farseer') || s.includes('tawny man') ||
      s.includes('liveship') || s.includes('rain wild') || s.includes('green bone') ||
      s.includes('broken earth') || s.includes('gentleman bastard') || s.includes('greatcoats') ||
      s.includes('faithful and the fallen') || s.includes('book of the new sun') ||
      s.includes('his dark materials') || s.includes('chronicles of narnia') ||
      s.includes('lord of the rings') || s.includes('deryni') || s.includes('redwall') ||
      s.includes('winternight') || s.includes('spellmonger') || s.includes('black company') ||
      s.includes("queen's thief")) return 'fantasy';
  if (a.includes('brandon sanderson') || a.includes('robin hobb') || a.includes('robert jordan') ||
      a.includes('joe abercrombie') || a.includes('patrick rothfuss') || a.includes('scott lynch') ||
      a.includes('john gwynne') || a.includes('gene wolfe') || a.includes('fonda lee') ||
      a.includes('katherine arden') || a.includes('glen cook') || a.includes('neil gaiman') ||
      a.includes('philip pullman') || a.includes('c. s. lewis') || a.includes('j. r. r. tolkien') ||
      a.includes('j.k. rowling') || a.includes('brian jacques') || a.includes('megan whalen turner') ||
      a.includes('katherine kurtz') || a.includes('sebastien de castell') ||
      a.includes('terry mancour') || a.includes('will wight') || a.includes('nicoli gonnella')) return 'fantasy';

  if (a.includes('tara westover') || a.includes('trevor noah') || a.includes('anthony bourdain') ||
      a.includes('barack obama') || a.includes('colin jost') || a.includes('james comey') ||
      a.includes('blaine harden') || a.includes('adam makos') || a.includes('karl marlantes') ||
      a.includes('bao ninh')) return 'memoir';

  if (a.includes('michael wolff') || a.includes('bob woodward') || a.includes('jane mayer') ||
      a.includes('mckay coppins') || a.includes('vicky ward') || a.includes('david mccullough') ||
      a.includes('thomas piketty') || a.includes('marc levinson') || a.includes('john mcphee') ||
      a.includes('adam higginbotham') || a.includes('colson whitehead')) return 'history';

  if (a.includes('clayton') || a.includes('john doerr') || a.includes('camille fournier') ||
      a.includes('mary l. gray') || a.includes('martin ford') || a.includes('chris voss') ||
      a.includes('arbinger') || a.includes('max s. bennett') || a.includes('michio kaku') ||
      a.includes('james gleick') || a.includes('richard dawkins') || a.includes('hallowell')) return 'ideas';

  return 'other';
}

function pickCover(productImages) {
  if (!productImages || typeof productImages !== 'object') return '';
  // keys are pixel widths as strings
  const sizes = Object.keys(productImages).map(Number).filter((n) => !Number.isNaN(n));
  if (sizes.length === 0) return '';
  const largest = Math.max(...sizes);
  return productImages[String(largest)] || '';
}

function parseSequence(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Audible series catalogs include many alternate formats of the same book —
// dramatized adaptations and part-N-of-M splits — that bloat the page without
// adding new content. The "real" book is in the same series children list with
// a clean title, so we filter these out.
const SUPPLEMENTAL_PATTERNS = [
  /\bdramatized adaptation\b/i,
  /\(\s*(part\s*)?\d+\s*of\s*\d+\s*\)/i,
  /\b(part|volume|disc)\s+(one|two|three|four|five|1|2|3|4|5)\b/i,
];
function isSupplementalEdition(title) {
  if (!title) return false;
  return SUPPLEMENTAL_PATTERNS.some((re) => re.test(title));
}

// Two-step: ask the series asin for its relationships (child book asins + sequence numbers),
// then batch-fetch the unowned child products to get title/author/cover.
async function fetchSeriesChildren(api, seriesAsin) {
  const seriesResp = await api.client.request(`/1.0/catalog/products/${seriesAsin}`, {
    query: { response_groups: 'relationships,product_attrs' },
  });
  if (!seriesResp.ok) {
    throw new Error(`series fetch HTTP ${seriesResp.status}: ${seriesResp.bodyText.slice(0, 200)}`);
  }
  const seriesData = JSON.parse(seriesResp.bodyText);
  const rels = Array.isArray(seriesData.product?.relationships) ? seriesData.product.relationships : [];
  return rels
    .filter((r) => r.relationship_to_product === 'child' && r.relationship_type === 'series')
    .map((r) => ({ asin: r.asin, sequence: parseSequence(r.sequence) }));
}

async function fetchProductsBatch(api, asins) {
  if (asins.length === 0) return [];
  const products = [];
  // Audible accepts ~50 ASINs per call comfortably; chunk to be safe.
  const chunkSize = 50;
  for (let i = 0; i < asins.length; i += chunkSize) {
    const chunk = asins.slice(i, i + chunkSize);
    const resp = await api.client.request('/1.0/catalog/products', {
      query: {
        asins: chunk.join(','),
        response_groups: 'contributors,media,product_attrs,product_desc,series',
      },
    });
    if (!resp.ok) {
      throw new Error(`batch fetch HTTP ${resp.status}: ${resp.bodyText.slice(0, 200)}`);
    }
    const data = JSON.parse(resp.bodyText);
    if (Array.isArray(data.products)) products.push(...data.products);
  }
  return products;
}

async function fetchAllLibrary(api) {
  const items = [];
  let page = 1;
  const perPage = 100;
  while (true) {
    const resp = await api.listLibrary({ numResults: perPage, page });
    const pageItems = Array.isArray(resp.items) ? resp.items : [];
    items.push(...pageItems);
    if (pageItems.length < perPage) break;
    page += 1;
    if (page > 50) break;  // safety
  }
  return items;
}

async function fetchAllInProgress(api) {
  const resp = await api.listInProgressTitles({ maxPages: 20, numResultsPerPage: 50 });
  return Array.isArray(resp.items) ? resp.items : [];
}

async function main() {
  if (!fs.existsSync(AUTH_FILE)) {
    console.error(`Auth file not found: ${AUTH_FILE}`);
    process.exit(1);
  }

  console.log('Loading auth & connecting to Audible...');
  const api = await AudibleApi.fromAuthFile({ authFile: AUTH_FILE });

  console.log('Fetching library...');
  const library = await fetchAllLibrary(api);
  console.log(`  ${library.length} items`);

  console.log('Fetching in-progress titles...');
  const inProgress = await fetchAllInProgress(api);
  console.log(`  ${inProgress.length} in progress`);

  const statusMap = new Map();
  for (const item of inProgress) {
    const pct = typeof item.percent_complete === 'number' ? item.percent_complete : 0;
    const status = pct >= 95 ? 'read' : 'reading';
    if (item.title) statusMap.set(item.title.toLowerCase().trim(), status);
  }

  // Owned books from the library
  const libraryAsins = new Set();
  const seriesAsinIndex = new Map(); // seriesAsin -> { name }

  const owned = library.map((item) => {
    const title = item.title || '';
    const authors = Array.isArray(item.authors) ? item.authors.map((a) => a.name).filter(Boolean) : [];
    const narrators = Array.isArray(item.narrators) ? item.narrators.map((n) => n.name).filter(Boolean) : [];
    const seriesArr = Array.isArray(item.series) ? item.series : [];
    const seriesEntry = seriesArr.length > 0 ? seriesArr[0] : null;
    const series = seriesEntry ? (seriesEntry.title || seriesEntry.name || '') : '';
    const seriesNumber = parseSequence(seriesEntry?.sequence);
    const cover = pickCover(item.product_images);
    const status = statusMap.get(title.toLowerCase().trim()) || 'unread';

    if (item.asin) libraryAsins.add(item.asin);
    // Index every series asin we see so we can fan out to its catalog later
    for (const s of seriesArr) {
      if (s?.asin && !seriesAsinIndex.has(s.asin)) {
        seriesAsinIndex.set(s.asin, { name: s.title || s.name || '' });
      }
    }

    const draft = {
      asin: item.asin || '',
      title,
      author: authors.join(', '),
      narrator: narrators.join(', '),
      series,
      seriesNumber,
      cover,
      status,
      genre: 'other',
      owned: true,
    };
    draft.genre = getGenre(draft);
    return draft;
  });

  // Step 1: pull the relationships for every series so we know each child ASIN + sequence.
  console.log(`\nResolving series relationships for ${seriesAsinIndex.size} series...`);
  const seriesChildren = new Map(); // seriesAsin -> [{asin, sequence}]
  const sequenceByAsin = new Map();
  let seriesIdx = 0;
  for (const [seriesAsin, info] of seriesAsinIndex) {
    seriesIdx += 1;
    try {
      const children = await fetchSeriesChildren(api, seriesAsin);
      seriesChildren.set(seriesAsin, children);
      for (const c of children) {
        if (c.sequence !== null && !sequenceByAsin.has(c.asin)) {
          sequenceByAsin.set(c.asin, c.sequence);
        }
      }
      console.log(`  [${seriesIdx}/${seriesAsinIndex.size}] ${info.name || seriesAsin}: ${children.length} books`);
    } catch (err) {
      console.warn(`  [${seriesIdx}/${seriesAsinIndex.size}] ${info.name || seriesAsin}: FAILED (${err.message})`);
      seriesChildren.set(seriesAsin, []);
    }
  }

  // Step 2: process series smallest-first so the most specific series claims overlapping books.
  // E.g., "The Stormlight Archive" (14) claims Stormlight books before "The Cosmere" (51) sees them;
  // Narnia "Publication Order" (40) claims its books before "Author's Preferred Order" (53) does.
  const orderedSeries = [...seriesAsinIndex.entries()].sort(
    (a, b) => (seriesChildren.get(a[0])?.length ?? 0) - (seriesChildren.get(b[0])?.length ?? 0),
  );

  // Step 2a: re-tag owned books to their smallest containing series (with the right sequence).
  // Audible may tag "Rhythm of War" under "The Cosmere" but we want it grouped with "The Stormlight Archive".
  for (const book of owned) {
    if (!book.asin) continue;
    for (const [seriesAsin, info] of orderedSeries) {
      const child = seriesChildren.get(seriesAsin)?.find((c) => c.asin === book.asin);
      if (child) {
        book.series = info.name;
        book.seriesNumber = child.sequence;
        // re-derive genre because it depends on series name
        book.genre = getGenre(book);
        break; // smallest series wins
      }
    }
  }
  const seenAsins = new Set(libraryAsins);
  // Title dedup: many Audible "series children" are alternate editions of the same book
  // (regular / deluxe / illustrated / bundle), each with its own ASIN. Collapse by lowercased title.
  const seenTitles = new Set(owned.map((b) => b.title.toLowerCase().trim()).filter(Boolean));
  const unowned = [];
  console.log(`\nFetching unowned book details (smallest series first)...`);
  for (const [seriesAsin, info] of orderedSeries) {
    const children = seriesChildren.get(seriesAsin) || [];
    const fresh = children.filter((c) => !seenAsins.has(c.asin));
    if (fresh.length === 0) {
      console.log(`  ${info.name || seriesAsin}: 0 new (all overlap with earlier series or owned)`);
      continue;
    }
    try {
      const products = await fetchProductsBatch(api, fresh.map((c) => c.asin));
      const seqMap = new Map(children.map((c) => [c.asin, c.sequence]));
      let added = 0;
      let skippedDup = 0;
      for (const p of products) {
        if (!p.asin || seenAsins.has(p.asin)) continue;
        if (isSupplementalEdition(p.title)) {
          seenAsins.add(p.asin);
          skippedDup += 1;
          continue;
        }
        const titleKey = (p.title || '').toLowerCase().trim();
        if (titleKey && seenTitles.has(titleKey)) {
          seenAsins.add(p.asin); // still track the asin so future passes don't reconsider
          skippedDup += 1;
          continue;
        }
        seenAsins.add(p.asin);
        if (titleKey) seenTitles.add(titleKey);
        const draft = {
          asin: p.asin,
          title: p.title || '',
          author: (p.authors || []).map((a) => a.name).filter(Boolean).join(', '),
          narrator: (p.narrators || []).map((n) => n.name).filter(Boolean).join(', '),
          series: info.name,
          seriesNumber: seqMap.get(p.asin) ?? null,
          cover: pickCover(p.product_images),
          status: 'unread',
          genre: 'other',
          owned: false,
        };
        draft.genre = getGenre(draft);
        unowned.push(draft);
        added += 1;
      }
      const dupNote = skippedDup > 0 ? ` (${skippedDup} dup editions skipped)` : '';
      console.log(`  ${info.name || seriesAsin}: +${added} unowned${dupNote}`);
    } catch (err) {
      console.warn(`  ${info.name || seriesAsin}: batch FAILED (${err.message})`);
    }
  }

  // Backfill sequenceNumber on owned books from the series-relationships data we already have.
  for (const b of owned) {
    if ((b.seriesNumber === null || b.seriesNumber === undefined) && b.asin && sequenceByAsin.has(b.asin)) {
      b.seriesNumber = sequenceByAsin.get(b.asin);
    }
  }

  const books = [...owned, ...unowned];

  // Sort: genre → series → seriesNumber → owned-first → title — stable for diffs.
  // Owned-first within the same sequence puts the user's actual book ahead of
  // alternate-title listings (e.g., "The Final Empire" before "Mistborn" at #1).
  books.sort((a, b) => {
    return a.genre.localeCompare(b.genre) ||
      a.author.localeCompare(b.author) ||
      a.series.localeCompare(b.series) ||
      ((a.seriesNumber ?? 9999) - (b.seriesNumber ?? 9999)) ||
      ((b.owned ? 1 : 0) - (a.owned ? 1 : 0)) ||
      a.title.localeCompare(b.title);
  });

  // Strip null seriesNumber for clean JSON output
  for (const b of books) {
    if (b.seriesNumber === null || b.seriesNumber === undefined) delete b.seriesNumber;
    if (!b.asin) delete b.asin;
  }

  const before = fs.existsSync(BOOKS_PATH) ? fs.readFileSync(BOOKS_PATH, 'utf8') : '';
  const after = JSON.stringify(books, null, 2) + '\n';
  fs.writeFileSync(BOOKS_PATH, after);

  const genres = Object.fromEntries(
    [...new Set(books.map((b) => b.genre))].map((g) => [g, books.filter((b) => b.genre === g).length])
  );
  const statuses = Object.fromEntries(
    ['read', 'reading', 'unread'].map((s) => [s, books.filter((b) => b.status === s).length])
  );
  const ownership = {
    owned: books.filter((b) => b.owned).length,
    unowned: books.filter((b) => !b.owned).length,
  };
  console.log(`\nWrote ${books.length} books to books.json`);
  console.log('By genre:', genres);
  console.log('By status:', statuses);
  console.log('By ownership:', ownership);
  if (before === after) console.log('No changes.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
