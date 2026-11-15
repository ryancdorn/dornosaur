#!/usr/bin/env node
/**
 * audit-shelf.mjs — compare a photo of your record shelf against vinyl.json.
 *
 * Usage:
 *   node scripts/audit-shelf.mjs <path-to-image> [--json | --pending]
 *
 * This script asks you (the human) to run a vision pass on the photo and
 * paste the extracted album list — it does NOT call a vision API itself,
 * so there are no API keys or external services involved. The easiest
 * way to produce the list: open the image in Claude Code or claude.ai
 * and ask "list every album visible, as JSON array of {artist, title,
 * suspect?}" (suspect=true when the spine is hard to read), then paste.
 *
 * It then cross-references against src/data/vinyl.json and reports:
 *   ✓  in collection
 *   ❌ visible on shelf but NOT in collection (likely missing from Discogs)
 *   ⚠  in collection but NOT visible in the photo (maybe stored elsewhere)
 *
 * --pending: merge the "missing from Discogs" entries into
 *   pending-vinyl.json at the project root — a durable queue you can
 *   work through across sessions. Existing entries that have since been
 *   added to Discogs are auto-removed. Suspect flags are preserved.
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VINYL_PATH = path.join(__dirname, '..', 'src', 'data', 'vinyl.json');
const PENDING_PATH = path.join(__dirname, '..', 'pending-vinyl.json');

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function key(artist, title) {
  return `${norm(artist)}::${norm(title)}`;
}

async function readPastedJson() {
  console.log('\nPaste the album list as JSON array (end with a blank line, or Ctrl+D):');
  console.log('Example: [{"artist":"Pink Floyd","title":"The Wall"}, ...]');
  console.log('');
  const rl = readline.createInterface({ input: process.stdin });
  const lines = [];
  for await (const line of rl) {
    if (line.trim() === '' && lines.length > 0) break;
    lines.push(line);
  }
  const text = lines.join('\n').trim();
  if (!text) {
    console.error('No input received.');
    process.exit(1);
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    console.error('Failed to parse JSON:', err.message);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const imagePath = args.find((a) => !a.startsWith('--'));
  const jsonOut = args.includes('--json');
  const pending = args.includes('--pending');

  if (!imagePath) {
    console.error('Usage: node scripts/audit-shelf.mjs <path-to-image> [--json | --pending]');
    process.exit(1);
  }
  if (!fs.existsSync(imagePath)) {
    console.error(`Image not found: ${imagePath}`);
    process.exit(1);
  }

  console.log(`\nShelf audit for: ${imagePath}`);
  console.log('');
  console.log('Step 1 — run a vision model on the image to extract albums.');
  console.log('        If you\'re in Claude Code, you can just drop the image');
  console.log('        in chat and ask: "list every album visible, as JSON');
  console.log('        array of {artist, title}". Then come back here.');

  const visible = await readPastedJson();
  if (!Array.isArray(visible)) {
    console.error('Expected a JSON array.');
    process.exit(1);
  }

  const collection = JSON.parse(fs.readFileSync(VINYL_PATH, 'utf8'));
  const inCollection = new Map(collection.map((r) => [key(r.artist, r.title), r]));
  const onShelf = new Map(
    visible
      .filter((v) => v && v.artist && v.title)
      .map((v) => [key(v.artist, v.title), v])
  );

  const found = [];
  const missingFromCollection = [];
  const missingFromShelf = [];

  for (const [k, v] of onShelf) {
    if (inCollection.has(k)) found.push(v);
    else missingFromCollection.push(v);
  }
  for (const [k, r] of inCollection) {
    if (!onShelf.has(k)) missingFromShelf.push(r);
  }

  if (jsonOut) {
    console.log(JSON.stringify({ found, missingFromCollection, missingFromShelf }, null, 2));
    return;
  }

  if (pending) {
    // Merge into pending-vinyl.json: add new missing-from-Discogs entries,
    // drop entries that have since been added to Discogs, preserve suspect flags.
    let existing = [];
    if (fs.existsSync(PENDING_PATH)) {
      try { existing = JSON.parse(fs.readFileSync(PENDING_PATH, 'utf8')); } catch {}
    }
    const existingByKey = new Map(existing.map((e) => [key(e.artist, e.title), e]));
    const merged = [];
    // New or still-pending
    for (const v of missingFromCollection) {
      const k = key(v.artist, v.title);
      const prior = existingByKey.get(k);
      merged.push({
        artist: v.artist,
        title: v.title,
        suspect: v.suspect === true || prior?.suspect === true,
        addedFromPhoto: prior?.addedFromPhoto || imagePath,
        note: prior?.note,
      });
    }
    // Preserve existing entries that weren't in this photo (shelf wasn't fully pictured)
    for (const [k, e] of existingByKey) {
      if (!missingFromCollection.some((v) => key(v.artist, v.title) === k) &&
          !inCollection.has(k)) {
        merged.push(e);
      }
    }
    merged.sort((a, b) => (a.artist + a.title).localeCompare(b.artist + b.title));
    fs.writeFileSync(PENDING_PATH, JSON.stringify(merged, null, 2) + '\n');
    const suspectCount = merged.filter((e) => e.suspect).length;
    console.log(`\nWrote ${merged.length} entries to pending-vinyl.json (${suspectCount} marked suspect).`);
    console.log('Work through this file at discogs.com/user/Dornosaur/collection, then');
    console.log("trigger: gh workflow run update-vinyl.yml -R ryancdorn/dornosaur");
    return;
  }

  console.log('');
  console.log(`✓  In collection and visible: ${found.length}`);
  for (const r of found) console.log(`     ${r.artist} — ${r.title}`);
  console.log('');
  console.log(`❌ Visible on shelf, NOT in collection: ${missingFromCollection.length}`);
  for (const r of missingFromCollection) console.log(`     ${r.artist} — ${r.title}`);
  console.log('');
  console.log(`⚠  In collection, not visible in photo: ${missingFromShelf.length}`);
  for (const r of missingFromShelf) console.log(`     ${r.artist} — ${r.title}`);
  console.log('');
  console.log('Next steps:');
  console.log('  ❌ entries → add them at discogs.com/user/Dornosaur/collection');
  console.log('              (daily refresh picks them up, or trigger manually)');
  console.log('  ⚠ entries → stored elsewhere? out on loan? or extra copies');
  console.log('              Discogs thinks you have but you don\'t.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
