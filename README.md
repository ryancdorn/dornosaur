# dornosaur.com

Personal website for Ryan Dorn — books, vinyl, hobbies. Static Astro site, deployed to GitHub Pages at [dornosaur.com](https://dornosaur.com).

## Stack

- **Astro 6** static site (Node ≥ 22.12)
- **GitHub Pages** via Actions (`.github/workflows/deploy.yml`)
- **Scoped component CSS** — no framework, no Tailwind
- **Data**: `src/data/books.json` + `src/data/vinyl.json`, both auto-refreshed daily

## Local development

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # production build → ./dist
npm run preview  # preview the built site locally
```

Deploy is automatic on push to `main`.

## Documentation

- **[CLAUDE.md](./CLAUDE.md)** — architecture, design system, data schemas, automation details, known gotchas
- **[docs/OPERATIONS.md](./docs/OPERATIONS.md)** — common management tasks (overriding a book genre, adding a vinyl, forcing a rebuild, rotating Audible auth)
