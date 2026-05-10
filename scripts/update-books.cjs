const fs = require('fs');

const inProgressData = JSON.parse(fs.readFileSync('C:/Users/ryanc/.claude/projects/C--code/6d4b416f-b503-480b-8f20-cffd9e0eaa4e/tool-results/mcp-audible-audible_list_in_progress_titles-1778404064030.txt','utf8'));
const books = JSON.parse(fs.readFileSync('C:/code/dornosaur/src/data/books.json','utf8'));

// Build status map
const statusMap = new Map();
for (const item of inProgressData.items) {
  const pct = item.percent_complete;
  const status = pct >= 95 ? 'read' : 'reading';
  statusMap.set(item.title.toLowerCase().trim(), status);
}

function getGenre(book) {
  const t = book.title.toLowerCase();
  const a = (book.author || '').toLowerCase();
  const s = (book.series || '').toLowerCase();

  // LitRPG & Progression
  if (s.includes('primal hunter') || s.includes('dungeon crawler carl') || s.includes('noobtown') ||
      s.includes('unbound') || s.includes('industrial strength magic') ||
      s.includes('cradle') || s.includes('last horizon')) return 'litrpg';

  // Sci-Fi
  if (s.includes('expeditionary force') || s.includes('bobiverse') || s.includes('old man') ||
      s.includes('lost colonies') || s.includes('forever war') || s.includes('ready player') ||
      s.includes('willful child')) return 'scifi';
  if (a.includes('andy weir') || a.includes('neal stephenson') || a.includes('china') ||
      a.includes('john scalzi') || a.includes('george orwell')) return 'scifi';
  if (t === 'embassytown' || t === '1984' || t === 'snow crash' || t === 'redshirts') return 'scifi';

  // Horror & Thriller
  if (t.includes('final girl') || t === 'fantasticland' || t === 'billy summers' || t === 'odd thomas') return 'horror';
  if (a.includes('grady hendrix') || a.includes('mike bockoven') || a.includes('stephen king') || a.includes('dean koontz')) return 'horror';

  // Epic Fantasy (broad check before author checks)
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

  // Memoir & Biography
  if (a.includes('tara westover') || a.includes('trevor noah') || a.includes('anthony bourdain') ||
      a.includes('barack obama') || a.includes('colin jost') || a.includes('james comey') ||
      a.includes('blaine harden') || a.includes('adam makos') || a.includes('karl marlantes') ||
      a.includes('bao ninh')) return 'memoir';

  // History & Politics
  if (a.includes('michael wolff') || a.includes('bob woodward') || a.includes('jane mayer') ||
      a.includes('mckay coppins') || a.includes('vicky ward') || a.includes('david mccullough') ||
      a.includes('thomas piketty') || a.includes('marc levinson') || a.includes('john mcphee') ||
      a.includes('adam higginbotham') || a.includes('colson whitehead')) return 'history';

  // Business & Ideas
  if (a.includes('clayton') || a.includes('john doerr') || a.includes('camille fournier') ||
      a.includes('mary l. gray') || a.includes('martin ford') || a.includes('chris voss') ||
      a.includes('arbinger') || a.includes('max s. bennett') || a.includes('michio kaku') ||
      a.includes('james gleick') || a.includes('richard dawkins') || a.includes('hallowell')) return 'ideas';

  return 'other';
}

const updated = books.map(book => {
  const key = book.title.toLowerCase().trim();
  const status = statusMap.get(key) || 'unread';
  const genre = getGenre(book);
  return { ...book, status, genre };
});

console.log('Genre breakdown:', Object.fromEntries(
  [...new Set(updated.map(b => b.genre))].map(g => [g, updated.filter(b => b.genre === g).length])
));
console.log('Status breakdown:', Object.fromEntries(
  ['read','reading','unread'].map(s => [s, updated.filter(b => b.status === s).length])
));

fs.writeFileSync('C:/code/dornosaur/src/data/books.json', JSON.stringify(updated, null, 2));
console.log('Done!');
