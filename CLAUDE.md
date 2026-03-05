# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Dev server (localhost:3000)
npm run build    # Production build
npm run start    # Serve production build
npx tsc --noEmit # Type check
```

Deploy:
```bash
npx vercel --prod --yes
npx vercel env add VAR_NAME production  # Add env var to Vercel
```

## Architecture

Next.js 15 App Router, TypeScript, TailwindCSS 4. Three API routes, one page.

### Data flow

**Search:** `page.tsx` → `GET /api/search?q=QUERY&page=N` → DDG image search (primary) → Serper fallback → normalized `ImageResult[]`

**Explore mode:** click image → `POST /api/suggest` (fetches image as base64 → Claude Haiku vision → 10-14 word descriptive query) → triggers new search with that query

### `app/api/search/route.ts`
Primary engine. Two-step DDG flow:
1. Fetch `duckduckgo.com/?q=...&iax=images&ia=images` → parse VQD token from HTML
2. Fetch `duckduckgo.com/i.js?...&vqd=TOKEN&s=START_OFFSET` → up to 100 results per page

Pagination: `s = (page-1) * 100`. `hasMore` based on whether raw result count ≥ 50.

If DDG returns 0 results or fails, falls back to Serper.dev (two parallel calls: 8 sites + 7 sites) covering the same 15 design sites.

`isListingPage()` filters out generic gallery/search URLs — keeps only specific project pages. Behance requires `/gallery/` in path; Dribbble requires `/shots/\d+`.

### `app/api/suggest/route.ts`
Powers Explore mode. Fetches the clicked image server-side (CDN URLs aren't accessible directly from Anthropic), converts to base64, sends to `claude-haiku-4-5-20251001` with a structured 7-dimension visual analysis prompt (color, theme, UI type, visual style, layout, distinctive elements, mood/sector). Falls back to title-based keyword extraction if Claude is unavailable or image fetch fails.

### `app/page.tsx`
Single client component. Two UI states: idle (centered logo + search bar) and searched (sticky header with logo, centered search input via `absolute left-1/2`, mode switch on right).

Mode switch: `"source"` (click → opens source URL) | `"explore"` (click → calls `/api/suggest` → new search).

Pagination: `page` state incremented by "Ver más imágenes →" button. A `useEffect` on `page` calls `fetchImages` with `append=true` for pages > 1.

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `SERPER_API_KEY` | For fallback | serper.dev image search (2,500/month free) |
| `ANTHROPIC_API_KEY` | For Explore mode | Claude Haiku vision analysis |

Both must be set in `.env.local` (local) and Vercel dashboard (production).

## Design sites targeted

The 15 sources hardcoded in `SITES` constant (both in search and suggest routes):
`dribbble.com`, `behance.net`, `awwwards.com`, `mobbin.com`, `godly.website`, `siteinspire.com`, `land-book.com`, `lapa.ninja`, `saasframe.io`, `minimal.gallery`, `bentogrids.com`, `shoot.design`, `supahero.io`, `60fps.design`, `collectui.com`

## Font

Playfair Display loaded via `next/font/google` (weight 400 only) in `layout.tsx`, exposed as CSS variable `--font-playfair`. Applied inline via `style={{ fontFamily: "var(--font-playfair)", fontWeight: 400 }}` on logo elements.
