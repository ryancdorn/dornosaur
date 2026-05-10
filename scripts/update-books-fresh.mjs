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

  const books = library.map((item) => {
    const title = item.title || '';
    const authors = Array.isArray(item.authors) ? item.authors.map((a) => a.name).filter(Boolean) : [];
    const narrators = Array.isArray(item.narrators) ? item.narrators.map((n) => n.name).filter(Boolean) : [];
    const seriesArr = Array.isArray(item.series) ? item.series : [];
    const series = seriesArr.length > 0 ? (seriesArr[0].title || seriesArr[0].name || '') : '';
    const cover = pickCover(item.product_images);
    const status = statusMap.get(title.toLowerCase().trim()) || 'unread';
    const draft = {
      title,
      author: authors.join(', '),
      narrator: narrators.join(', '),
      series,
      cover,
      status,
      genre: 'other',
    };
    draft.genre = getGenre(draft);
    return draft;
  });

  // Sort: by genre, then author, then series, then title — stable for diffs
  books.sort((a, b) => {
    return a.genre.localeCompare(b.genre) ||
      a.author.localeCompare(b.author) ||
      a.series.localeCompare(b.series) ||
      a.title.localeCompare(b.title);
  });

  const before = fs.existsSync(BOOKS_PATH) ? fs.readFileSync(BOOKS_PATH, 'utf8') : '';
  const after = JSON.stringify(books, null, 2) + '\n';
  fs.writeFileSync(BOOKS_PATH, after);

  const genres = Object.fromEntries(
    [...new Set(books.map((b) => b.genre))].map((g) => [g, books.filter((b) => b.genre === g).length])
  );
  const statuses = Object.fromEntries(
    ['read', 'reading', 'unread'].map((s) => [s, books.filter((b) => b.status === s).length])
  );
  console.log(`\nWrote ${books.length} books to books.json`);
  console.log('By genre:', genres);
  console.log('By status:', statuses);
  if (before === after) console.log('No changes.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
