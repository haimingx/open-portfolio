# Open Portfolio — contributor notes

- Check before pushing: `npm run lint && npm run typecheck && npm test && npm run build` (CI runs the same).
- Layout, sharing or formatting changes: also run `npm run test:e2e`. It uses `e2e/mock-api.ts`, never the live API; add a case for each layout bug fixed.
- `lib/` holds logic and stays testable without a browser: data reading (`chaintable.ts`, `platform.ts`, `reference.ts`, `fetch-portfolio.ts`, `history.ts`, `ens.ts`), pure calculation (`portfolio.ts`, `story.ts`, `compare.ts`, `curve.ts`), formatting (`format.ts`, `wallet-markdown.ts`), card design (`card.ts`) and the Ask AI prompt (`ask-ai.ts`). Tests sit next to each module and mock every network call.
- Every Chaintable request goes through `lib/chaintable.ts`, which owns rate limiting, retries, the concurrency cap and the API key fallback. Do not call the API elsewhere; `lib/platform.ts` wraps the functions this project deploys.
- The functions live in `functions/*.py` and are deployed with `npx tsx scripts/functions.ts deploy`; the same script records the platform functions' hashes and checks the deployed code against the repo. A [workflow](.github/workflows/check-functions.yml) runs both daily. Bump `VALUE_AT_VERSION` in `lib/history.ts` when `functions/value_at.py` changes its results.
- Cache server data with `sharedCache` (`lib/cache.ts`), never `unstable_cache` directly, and give each cache a unique key.
- The page, its metadata, the share card, the Markdown version and comparisons read a wallet only through `getPortfolio`, so they share one cached read; do not read the same data another way.
- View state lives in the URL (`lib/view-state.ts`); invalid values fall back to defaults. Sections only decide which blocks show; Portfolio or Story is a separate choice held in `card`.
- A new browser request or third-party script must be allowed in the CSP in `next.config.ts`. When the wallet paths change, update the WAF rule shown in the README.
- Comments explain why, not what. Add no dependency without a clear need.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
