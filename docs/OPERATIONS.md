# Operations Playbook

Common management tasks for dornosaur.com. For architecture, design system, and data schemas, see [CLAUDE.md](../CLAUDE.md).

---

## Deploy

Everything deploys automatically on push to `main` via `.github/workflows/deploy.yml`.

```bash
git push origin main
```

Watch the run:
```bash
gh run watch -R ryancdorn/dornosaur
```

Force a rebuild without a code change:
```bash
gh workflow run deploy.yml -R ryancdorn/dornosaur
```

### How the daily refreshes reach the live site

- **Books** (Windows scheduled task): pushes with your personal git credentials → GitHub sees it as a normal push → deploy workflow fires automatically. ✅
- **Vinyl** (GitHub Actions): pushes with the workflow's `GITHUB_TOKEN`. By default, GitHub blocks `GITHUB_TOKEN`-authored pushes from triggering other workflows (loop prevention). We work around this with a `workflow_run` trigger in `deploy.yml` that fires after `Update vinyl from Discogs` completes, gated on success. ✅

If you ever add a third source that commits from within a workflow, add it to the `workflow_run.workflows` list in `deploy.yml` or deploys won't fire.

---

## Books (Audible)

### Where data lives
`src/data/books.json` — auto-refreshed daily by the Windows Scheduled Task `DornosaurBooksRefresh` (4 AM local). Direct edits get clobbered next morning.

### Override a book's genre
Genre classification happens in `scripts/update-books-fresh.mjs`. To change how a book (or series) is categorized, edit the rules there, not `books.json`.

### Manually trigger a refresh
```powershell
Start-ScheduledTask -TaskName 'DornosaurBooksRefresh'
```

Or dry-run (writes to `books.json` but doesn't commit):
```powershell
node scripts/update-books-fresh.mjs
```

Log: `scripts/logs/update-books-YYYY-MM-DD.log` (gitignored).

### Rotate Audible auth
Auth file is `C:\Users\ryanc\audible-auth.json`. The daily script refreshes the token in place. If auth breaks completely (manual password change on Amazon, etc.), regenerate via the `audible-mcp` CLI or re-run the auth flow — the file gets rewritten with a fresh set of tokens + locale/marketplace info.

### Re-register the scheduled task (after machine wipe)
See CLAUDE.md § Automation — full PowerShell snippet.

---

## Vinyl (Discogs)

### Where data lives
`src/data/vinyl.json` — auto-refreshed daily via `.github/workflows/update-vinyl.yml` (11:00 UTC, uses `DISCOGS_TOKEN` repo secret).

### Add a record
Add it to the Discogs collection at [discogs.com/user/Dornosaur/collection](https://www.discogs.com/user/Dornosaur/collection), then either wait for the daily refresh or trigger manually:
```bash
gh workflow run update-vinyl.yml -R ryancdorn/dornosaur
```

### Override genre or add a pressing note
The refresh preserves `genre` and `pressing` per record (matched by lowercased `artist+title`). Edit them directly in `vinyl.json` and commit — they will survive future refreshes.

Other fields (`cover`, `label`, `format`, `year`, `pressYear`) are always overwritten by the API. See `scripts/update-vinyl.cjs` § `main()` for the merge logic.

### Add a new genre bucket
1. Add the key + inference rule in `inferGenre()` in `scripts/update-vinyl.cjs`.
2. Add a `genreOrder` entry in the same file for sort position.
3. Add the genre block + accent color in `src/pages/vinyl.astro`.

---

## Site content

### Add a new page
1. Create `src/pages/<name>.astro`, wrap in `<Layout title="..." pageTint="...">`.
2. Add a nav link in `src/layouts/Layout.astro` (`<nav>` block).
3. Optionally add a `pageTint` preset in Layout's `[data-tint="<name>"]` rule.

### Change a design token
All color/tint tokens live in `src/layouts/Layout.astro` `<style is:global>` — `:root` (dark) and `[data-theme="light"]`. Per-page tints are `[data-tint="<page>"]`.

### Change the mobile breakpoint
Scoped `<style>` in Astro 6 drops `[data-astro-cid-*]` inside `@media` blocks (see CLAUDE.md § Known Gotchas). Put responsive overrides in `Layout.astro`'s `<style is:global>` `@media (max-width: 640px)` block.

---

## Debugging

### Build failed in CI
```bash
gh run list -R ryancdorn/dornosaur -L 5
gh run view <run-id> --log-failed -R ryancdorn/dornosaur
```

### Daily vinyl refresh failed
Check the Actions tab, or:
```bash
gh run list -R ryancdorn/dornosaur -w update-vinyl.yml -L 5
```
Common cause: expired/revoked `DISCOGS_TOKEN` secret. Regenerate at [discogs.com/settings/developers](https://www.discogs.com/settings/developers) and update the repo secret.

### Daily books refresh didn't run
- Confirm the PC was awake (task has `-WakeToRun`, but a suspended-not-asleep machine can still miss)
- Check `scripts/logs/update-books-YYYY-MM-DD.log`
- Check task history: `Get-ScheduledTaskInfo -TaskName 'DornosaurBooksRefresh'`

### Discogs image 403
Preserve the full URL verbatim from the API, including internal `/` inside the base64 path segment. See CLAUDE.md § Known Gotchas.

---

## Secrets & auth inventory

| What | Where | Rotates how |
|---|---|---|
| `DISCOGS_TOKEN` | GitHub repo secret | Manual at Discogs developer settings |
| Audible OAuth | `C:\Users\ryanc\audible-auth.json` | Auto-rotated by `update-books-fresh.mjs` each run |
| GitHub Pages deploy | Workflow's `GITHUB_TOKEN` + Pages environment | Automatic |
