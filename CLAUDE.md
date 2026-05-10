# dornosaur.com — Claude Context

Personal website for Ryan Dorn. Tracks books, vinyl, and hobbies.

## Stack

- **Framework**: Astro 6 (static site, `"type": "module"`, Node >=22.12.0)
- **Hosting**: GitHub Pages via GitHub Actions (`/.github/workflows/deploy.yml`)
- **Domain**: dornosaur.com (DNS managed in Squarespace, A records → GitHub Pages IPs, CNAME www → ryancdorn.github.io)
- **Fonts**: Playfair Display (headings, display) + Lora (body/italic) + Inter (UI labels, nav) — all from Google Fonts
- **No framework CSS** — all styles are scoped `<style>` blocks per Astro component

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
    books.astro           # Books page — genre sections from books.json
    vinyl.astro           # Vinyl page — wood panel header + genre sections from vinyl.json
    hobbies.astro         # STUB — just a placeholder, needs building out
  data/
    books.json            # 145 Audible books with genre + status
    vinyl.json            # 16 Discogs records
public/
  images/
    wood-panel.jpg        # Vertical wood slat photo used as vinyl header bg (Unsplash, free license)
  CNAME                   # dornosaur.com
scripts/
  update-books.cjs        # Node CommonJS script — re-run to refresh books.json from Audible MCP
```

## Design System

### Colors (CSS custom properties in Layout.astro)
```css
--bg:         #0C0C10   /* near-black page background */
--surface:    #14141A   /* card/section surfaces */
--surface-2:  #1C1C24
--text:       #EDEAE5   /* primary text */
--text-muted: #6A6A7E   /* secondary text */
--accent:     #FF6B2B   /* orange — wordmark, interactive elements, CTA */
--border:     #272733
```

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

Data source: `src/data/books.json` — populated via Audible MCP (`audible-mcp` by tannerwj).

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

### Status logic (in update-books.cjs)
- `read` — ≥95% complete in Audible
- `reading` — on in-progress list, <95% complete
- `unread` — not on in-progress list

### Current counts
- Total: 145 books | Read: 20 | Reading: 82 | Unread: 43
- By genre: fantasy 65, litrpg 47, scifi 16, ideas 12, history 10, memoir 10, horror 4, other 11

### Genre section design pattern
Each genre has a **dark full-width banner** (themed color + big Playfair title) above a **themed shelf area** (light for fantasy/memoir/history/ideas, dark for litrpg/scifi/horror). Book cards show cover art with a small circular status badge (✓ green / ◉ amber / ○ gray).

### Genre themes (banner bg → shelf bg → accent)
| Genre   | Banner        | Shelf            | Title color |
|---------|---------------|------------------|-------------|
| fantasy | dark forest   | parchment cream  | `#A8D878`   |
| litrpg  | terminal black| same black       | `#00E676`   |
| scifi   | deep space    | starfield dark   | `#64B5F6`   |
| horror  | near-black    | near-black       | `#EF5350`   |
| memoir  | dark warm     | warm cream       | `#D4956A`   |
| history | dark sepia    | aged gold        | `#C9A84C`   |
| ideas   | dark warm     | off-white        | `#E8A055`   |
| other   | dark neutral  | soft neutral     | `#A09585`   |

## Vinyl Page

Data source: `src/data/vinyl.json` — populated from Discogs MCP (username: `Dornosaur`).

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
- **Header**: Real photo of vertical wood slat paneling (`/images/wood-panel.jpg`) with dark overlay
- **Genre sections**: Same banner + shelf pattern as books, themed per genre:
  - Hip Hop → gold accent (`#D4A820`)
  - Rock → red accent (`#C84838`)
  - Pop & Soul → purple accent (`#A878DC`)
- Record cards: 170px min, format badge appears on hover

## Pending / Not Built

- **Hobbies page** — currently a bare stub (`<h1>Hobbies</h1>`), needs full design + content
- **Discogs refresh script** — no equivalent of `update-books.cjs` for vinyl yet; update vinyl.json manually for now
- **Mobile responsive** — no media queries yet, could break on small screens

## MCP Servers

Configured in `C:\Users\ryanc\.claude\settings.json`:
- **audible**: `npx -y audible-mcp serve` with `AUDIBLE_AUTH_FILE=C:\Users\ryanc\audible-auth.json`
- **discogs**: configured separately (Dornosaur account)

To refresh books data: run `node scripts/update-books.cjs` after calling Audible MCP tools to get fresh library/in-progress data.

## Known Gotchas

- Discogs image URLs must have **no spaces** in the base64 path segment — a space breaks the img src
- Node scripts must use `.cjs` extension (project has `"type": "module"` in package.json)
- GitHub Actions requires `node-version: 22` — Astro 6 needs Node >=22.12.0
- `fullWidth={true}` prop on Layout removes all padding — inner sections must manage their own `max-width: 1280px; margin: 0 auto; padding: 0 2.5rem`
