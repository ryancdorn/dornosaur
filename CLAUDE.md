# dornosaur.com — Claude Context

Personal website for Ryan Dorn. Tracks books, vinyl, and hobbies.

## Stack

- **Framework**: Astro 6 (static site, `"type": "module"`, Node >=22.12.0)
- **Hosting**: GitHub Pages via GitHub Actions (`/.github/workflows/deploy.yml`)
- **Domain**: dornosaur.com (DNS managed in Squarespace, A records → GitHub Pages IPs, CNAME www → ryancdorn.github.io)
- **Fonts**: Playfair Display (headings, display) + Lora (body/italic) + Inter (UI labels, nav) — all from Google Fonts
- **No framework CSS** — all styles are scoped `<style>` blocks per Astro component
- **Light/dark toggle**: theme is stored in `localStorage['dorno-theme']` and applied as `data-theme="light|dark"` on `<html>`. Default is dark. Toggle button lives in the header. An inline `<head>` script sets the attribute before paint to prevent FOUC.

## Commands

```bash
npm run dev      # local dev server
npm run build    # production build
npm run preview  # preview production build locally
```

Deploy is automatic on push to `main`.

## Project Structure

```
src/
  layouts/
    Layout.astro          # Global shell: nav, footer, font imports
  pages/
    index.astro           # Homepage — hero + 3 nav cards
    books.astro           # Books page — genre sections from books.json, books grouped by series
    vinyl.astro           # Vinyl page — typographic header + genre sections from vinyl.json
    hobbies.astro         # STUB — just a placeholder, needs building out
  data/
    books.json            # Audible books with genre + series + status — AUTO-REFRESHED DAILY
    vinyl.json            # Discogs records — AUTO-REFRESHED DAILY
public/
  CNAME                   # dornosaur.com
scripts/
  update-books.cjs        # Legacy — depended on dumped MCP tool-results; superseded by update-books-fresh.mjs
  update-books-fresh.mjs  # Self-contained Audible refresh — uses audible-mcp's bundled API client, refreshes auth in place
  update-books-task.ps1   # Wrapper invoked by Windows Task Scheduler: pull → refresh → commit → push
  update-vinyl.cjs        # Self-contained Discogs refresh — preserves manual genre + pressing fields per record
  logs/                   # Local PS task logs (gitignored)
.github/workflows/
  deploy.yml              # GitHub Pages deploy on push to main
  update-vinyl.yml        # Daily Discogs cron at 11:00 UTC (4 AM PT)
```

## Design System

### Colors (CSS custom properties in Layout.astro)
The palette flips with `[data-theme]`. Tokens read by every page; only the brand `--brand` and the per-page `--tint` differ between sections.

**Dark (default):**
```css
--bg:         #0E0E12
--surface:    #16161D
--surface-2:  #1E1E26
--text:       #EDEAE5
--text-muted: #7A7A8E
--text-dim:   #4A4A58
--border:     #28282F
--brand:      #E8743C   /* warm orange — wordmark, eyebrows, hover */
--header-bg:  #08080C
--hero-bg:    #0A0A10
```

**Light:**
```css
--bg:         #F6F2E8   /* warm parchment, NOT pure white */
--surface:    #FFFFFF
--surface-2:  #EDE7DA
--text:       #1A1A20
--text-muted: #6A6055
--border:     #DDD5C5
--brand:      #C95A22   /* darker orange for contrast */
--header-bg:  #FFFCF4
--hero-bg:    #F0EBDD
```

**Page tints** (subtle radial gradient on the page hero, set via `pageTint` prop on Layout):
- `books`   → cool ink (HSL 215, 18%)
- `vinyl`   → warm wine (HSL 350, 24%)
- `hobbies` → sage (HSL 150, 12%)
- `neutral` → near-flat

**Genre sections are always dark/immersive** in both light and dark modes — they're "rooms" you enter. The toggle only flips the shell (header, page hero, body bg, footer).

### Typography
- **Headings/display**: `Playfair Display` serif — large, italic for hero titles
- **Body/descriptions**: `Lora` serif — italic subtitles, genre descriptions
- **UI/labels**: `Inter` sans-serif — nav links, eyebrows, stats, badges

### Nav
- 62px sticky dark header (`#08080C`)
- Wordmark: orange Playfair Display, non-italic
- Tagline next to wordmark: *"Joss this is how you make a website"* — Lora italic, muted
- Nav links: Inter 0.75rem uppercase, sliding orange underline on hover

### Layout prop
`<Layout title="..." fullWidth={true}>` removes max-width/padding from `<main>` for full-bleed pages. Books, vinyl, and index all use `fullWidth={true}`.

## Books Page

Data source: `src/data/books.json` — auto-refreshed daily from the Audible API. The script uses `audible-mcp`'s bundled API client (no MCP server required at runtime — it's pulled in as a devDep just for the `AudibleApi` class). Auth lives in `C:\Users\ryanc\audible-auth.json` and gets rotated in place by the script. **Direct edits to books.json get clobbered next morning** — change genre rules in `scripts/update-books-fresh.mjs` instead.

### Book schema
```json
{
  "title": "...",
  "author": "...",
  "narrator": "...",
  "series": "...",
  "cover": "https://...",   // Audible CDN
  "status": "read|reading|unread",
  "genre": "fantasy|litrpg|scifi|horror|memoir|history|ideas|other"
}
```

### Status logic (in update-books-fresh.mjs)
- `read` — ≥95% complete in Audible
- `reading` — on in-progress list, <95% complete
- `unread` — not on in-progress list

### Genre section design pattern
Each genre has a **tinted dark banner** (subtle gradient + accent eyebrow + big Playfair title in the genre's accent color) above a **dark shelf area** with the same accent threaded through series headers and book titles. Books are grouped by series within each genre — series with the most books first, "Standalone" at the end. Cover art has a small circular status badge (✓ green / ◉ amber / ○ gray).

### Genre accent colors
| Genre   | Accent      | Notes |
|---------|-------------|-------|
| fantasy | `#A8D878`   | forest green |
| litrpg  | `#00E676`   | terminal green, monospace title + series headers |
| scifi   | `#64B5F6`   | cool blue, starfield grid pattern on banner + shelf |
| horror  | `#EF5350`   | blood red |
| memoir  | `#D4956A`   | warm bronze |
| history | `#C9A84C`   | aged gold |
| ideas   | `#E8A055`   | burnt orange |
| other   | `#C4B8A4`   | muted neutral |

Each genre exposes `--series-color` and `--btitle-color` CSS vars so the accent runs through series headers and book titles consistently.

## Vinyl Page

Data source: `src/data/vinyl.json` — auto-refreshed daily from the Discogs API (username: `Dornosaur`) via GitHub Actions cron. Token in `DISCOGS_TOKEN` repo secret. **The `genre` and `pressing` fields ARE preserved across refreshes** (matched by lowercased `artist+title`); all other fields (cover, label, format, year, pressYear) are always overwritten with API values. So manual curation of those two fields is safe.

### Record schema
```json
{
  "title": "...",
  "artist": "...",
  "year": 1977,           // original release year
  "pressYear": 2014,      // pressing/reissue year
  "cover": "https://...", // Discogs CDN — NOTE: no spaces in base64 path segment
  "genre": "hiphop|rock|soul",
  "label": "...",
  "format": "LP|2×LP",
  "pressing": "..."       // nullable — special pressing notes
}
```

### Current collection (16 records)
- **Hip Hop** (4): Dr. Dre — The Chronic; Eminem — Slim Shady LP, Marshall Mathers LP, Eminem Show
- **Rock** (11): Fleetwood Mac (×2), Led Zeppelin (×3), Meat Loaf (×2), Pink Floyd (×3), Steely Dan
- **Pop & Soul** (1): Michael Jackson — Thriller

### Vinyl page design
- **Header**: Pure typographic — italic Playfair "Vinyl." with a decorative CSS-only vinyl-groove ring pattern in the right margin. No photo. Stat strip below.
- **Genre sections**: Same banner + shelf pattern as books, themed per genre:
  - Hip Hop → gold accent (`#D4A820`)
  - Rock → red accent (`#C84838`)
  - Pop & Soul → purple accent (`#A878DC`)
- Record cards: 180px min, format badge appears on hover

## Pending / Not Built

- **Hobbies page** — currently a bare stub (`<h1>Hobbies</h1>`), needs full design + content
- **Mobile responsive** — no media queries yet, could break on small screens

## Automation

Both data files refresh daily without manual intervention:

| Source | When | How | Auth |
|---|---|---|---|
| Discogs → vinyl.json | 11:00 UTC daily (4 AM PT) | GitHub Actions: `.github/workflows/update-vinyl.yml` runs `scripts/update-vinyl.cjs`, commits if changed | `DISCOGS_TOKEN` repo secret |
| Audible → books.json | 4:00 AM local daily (wakes the PC) | Windows Scheduled Task `DornosaurBooksRefresh` runs `scripts/update-books-task.ps1` → `scripts/update-books-fresh.mjs` → commits + pushes if changed | `C:\Users\ryanc\audible-auth.json` (rotated in place) |

**Triggering manually:**
- Vinyl: `gh workflow run update-vinyl.yml -R ryancdorn/dornosaur`
- Books: `Start-ScheduledTask -TaskName 'DornosaurBooksRefresh'` (or run `node scripts/update-books-fresh.mjs` directly for dry-run)

**Logs:**
- Vinyl: GitHub Actions run history
- Books: `scripts/logs/update-books-YYYY-MM-DD.log` (gitignored)

**Re-registering the books task** (after machine wipe / new user):
```powershell
$action  = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -ExecutionPolicy Bypass -File "C:\code\dornosaur\scripts\update-books-task.ps1"'
$trigger = New-ScheduledTaskTrigger -Daily -At 4am
$settings = New-ScheduledTaskSettingsSet -WakeToRun -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
Register-ScheduledTask -TaskName 'DornosaurBooksRefresh' -Action $action -Trigger $trigger -Settings $settings -User $env:USERNAME -RunLevel Limited
```
Run from an elevated PowerShell; prompts for the user's Windows password (required for the task to fire while logged out).

## MCP Servers (interactive only)

Configured in `C:\Users\ryanc\.claude\settings.json` for ad-hoc Audible/Discogs queries from Claude Code. The daily auto-refresh does NOT use these — it talks directly to the APIs.

- **audible**: `npx -y audible-mcp serve` with `AUDIBLE_AUTH_FILE=C:\Users\ryanc\audible-auth.json`
- **discogs**: configured separately (Dornosaur account)

## Known Gotchas

- **Discogs image URLs must preserve internal slashes inside the base64 path segment.** The API returns URLs like `.../czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/...jpeg` — those slashes are load-bearing. Stripping them (e.g., treating them as whitespace artifacts) produces 403s on every request. Always copy the `cover_image` field from the API response verbatim.
- Node scripts must use `.cjs` extension (project has `"type": "module"` in package.json)
- GitHub Actions requires `node-version: 22` — Astro 6 needs Node >=22.12.0
- `fullWidth={true}` prop on Layout removes all padding — inner sections must manage their own `max-width: 1280px; margin: 0 auto; padding: 0 2.5rem`
