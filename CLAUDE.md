# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

"Garimpo" — a Brazilian discovery/affiliate-commerce platform (Next.js 16, App Router, Turbopack). Workspace package name is `@garimpo/contracts`; `package.json`'s own name (`my-project`) is a placeholder. All routes, UI copy, and API error messages are in Portuguese.

Package manager is **pnpm** (`pnpm-workspace.yaml`: `.` + `packages/*`). Do not use npm/yarn.

## Commands

```bash
pnpm dev              # next dev (Turbopack), http://localhost:3000
pnpm build            # next build
pnpm typecheck        # tsc --noEmit
pnpm test             # vitest run (tests/unit + tests/integration)
pnpm test:watch       # vitest watch mode
pnpm test:e2e         # playwright test (tests/e2e) — auto-starts pnpm dev on :3000
pnpm test:a11y        # playwright test tests/e2e/accessibility.spec.ts (axe-core)
pnpm quality          # typecheck && test && build — run before considering work done
```

Single test file: `pnpm vitest run tests/unit/rbac.test.ts` (or `pnpm exec playwright test tests/e2e/journeys.spec.ts` for e2e).

## Architecture: backend, auth, and the storefront are all real (Neon); only editorial content and the generic admin CRUD stay mock

As of 2026-09-04 the mock→real migration landed for the backend (`app/api/v1/*`, auth, admin RBAC) **and** the storefront rendering path (`app/page.tsx`, `app/produto`, `app/categorias`, `app/buscar`, `app/comparar`, `app/favoritos`/`historico`). The real Neon schema didn't originally have several fields the storefront needs (`rating`/`reviewsCount`/an editorial `score`/`growth` at product level — only offer-level `rating` existed, and that was unpopulated) — rather than fake these client-side, they were added as real, persisted columns on `products` (see `lib/db/schema.ts`, migration `0004_noisy_tenebrous.sql`) and backfilled by `pnpm db:seed-catalog` (`lib/db/seed-catalog-enrichment.ts`), which also seeds categories, brands, one primary image, and 6 months of `price_history` per offer for the 12 real products (the DB otherwise had bare name/slug/price with no images/categories/brands/tags — check before assuming enrichment happened on a fresh clone/branch).

**Data flow**: `app/layout.tsx` (async Server Component) calls `getStoreCatalog()` (`lib/db/repositories/store-catalog.ts`, cached across requests for 5 min with tag `catalog`; the Shopee cron invalidates it), which joins products/offers/providers/categories/brands/images/tags/price_history into shapes that match `lib/types.ts`'s original mock `Product`/`Offer`/`Provider`/`Category` types almost exactly — this was a deliberate adapter-pattern choice so that existing client components didn't need their rendering logic rewritten, only their data *source*. That catalog is passed into `<StoreDataProvider>` (`components/store-data-provider.tsx`), a React Context read by `useStoreData()` — client components (`ProductCard`, `ProductDetail`, `HomeCatalog`, `SearchExperience`, `SavedProducts`, `/comparar`) call this hook instead of importing arrays from `lib/mock-data.ts`. Server Components that need data before/outside the React tree (`generateStaticParams`, `generateMetadata`, `sitemap.ts`) call `getStoreCatalog()` directly. `lib/recommendation/engine.ts#generateRecommendations()` takes a second `catalog: {products, offers, metrics?}` argument; it no longer falls back to `lib/mock-data` — with no catalog it returns zero recommendations. Every caller (`ProductDetail`, `/api/v1/recommendations`, the admin ranking simulator in `components/admin/experience-studio.tsx`) passes the real catalog plus `metrics` from `lib/db/repositories/product-metrics.ts#getProductMetrics()` (views/clicks/favorites/conversions aggregated from `analytics_events` + `affiliate_clicks` + `affiliate_conversions`). `app/layout.tsx` loads those metrics alongside the catalog and passes them to `<StoreDataProvider metrics>`, so client components rank with measured engagement. Where no traffic has been measured yet the engine falls back to the offer's real `soldCount`/`commissionRate` instead of the hashed pseudo-random features it used before (`ALGORITHM_VERSION` is now `garimpo-ranker-3.0.0`).

### Catalog comes from the real Shopee Affiliate API

`lib/providers/shopee/client.ts` talks to `https://open-api.affiliate.shopee.com.br/graphql` (GraphQL, signed with `SHA256(AppId + Timestamp + Payload + Secret)`; credentials in `SHOPEE_AFFILIATE_APP_ID`/`SHOPEE_AFFILIATE_APP_SECRET`, server-only, retries on HTTP 429/5xx and on GraphQL code `10030`). `fetchProductOffers`/`fetchAllProductOffers` wrap `productOfferV2`; `generateShortLink` wraps the mutation (available, not used by the importer yet — `offerLink` from the API is already an attributed affiliate link).

`pnpm db:import-shopee [--per-category=12 --min-rating=4.5 --min-sales=50 --max-per-shop=2 --replace-demo]` (`lib/db/import-shopee.ts`) searches real keywords per storefront category, filters by `isUsableOffer`, caps products per seller, maps via `lib/providers/shopee/mapping.ts` and upserts through `lib/db/repositories/catalog-import.ts` (brand=seller, one primary image, tags derived from the numbers, `price_history` snapshot when the price moved). `--replace-demo` **archives** (status `removed`, never deletes) products with no affiliate offer; `getStoreCatalog()` only reads `status = 'active'` rows.

Gotchas the API imposes, don't "fix" them by inventing data:
- There is no review count and no description — `products.reviewsCount` stays 0 and the UI hides review counts; `description` is generated as "Vendido por {loja} na Shopee.".
- `priceDiscountRate` only reconciles with `priceMin` when `priceMin === priceMax`; otherwise it refers to another variant, so `originalPriceFrom()` returns null (no fake "de/por"). `offers.price_max` (migration `0005_unique_falcon.sql`) stores the range so the UI can say "até R$ X".
- Shipping is not exposed at all: `Offer.shipping` is 0 as a calculation placeholder and no screen claims "Frete grátis".
- `products.editorialScore` ("Índice Garimpo") is computed by `editorialScoreFrom()` from rating + log(sales) + discount; `growthPercentage` has no source and stays 0 (sorting that used it now uses `soldCount`).

**Still mock, deliberately, not an oversight**:
- `app/colecoes/[slug]` and `app/guias*` (historical note: now computed from the catalog; see Operations below).
  - The homepage no longer reads `collections` from mock data: its "Escolha pelo que importa" block (`components/home/home-selections.tsx`) is derived from the real catalog and links to `/buscar` filters. `lib/catalog/signals.ts` is the single source for those filter criteria (`matchesSignal`/`currentPrice`), shared with `components/search/search-experience.tsx` so counts and results never diverge. Collections and guides are no longer mock (see Operations below).
- `components/admin/module-content.tsx`'s generic per-module CRUD table (`LocalRepository`/browser storage) — spans ~29 unrelated admin modules (SEO, tema, campanhas, LGPD, ...), most without any real table to bind to.
- `components/admin/experience-studio.tsx`'s campaign/segment simulators and `app/admin/page.tsx`'s dashboard numbers (`auditEvents`, `jobs` from `lib/mock-data`, which now holds only mock content; formatters live in `lib/format.ts`) — admin-only demo tooling. The ranking simulator inside it is real now (real catalog + metrics).

### Schema coverage: 47 tables exist, ~22 are actually wired up

Don't assume a table being defined in `lib/db/schema.ts` means something uses it — the DB was introspected whole, and roughly half its tables have zero references outside `schema.ts`/`relations.ts`. Before building a feature, `grep` for the table name first. As of this writing, unused: `affiliateLinks`/`affiliatePrograms` (we call `affiliateClicks`/`affiliateConversions` directly with a bare `providerId`, no link/program layer), `syncJobs`/`syncJobRuns`/`syncErrors` (provider sync uses the generic `jobQueueEntries` instead), `productVariants`, `offerPrices`/`offerAvailability`/`offerCommissions` (fields live directly on `offers` instead of these normalized snapshot tables), `providerAccounts`/`providerCapabilities`, `consentRecords`/`privacyPreferences`/`privacyRequests` (LGPD — cookie consent is still `localStorage`-only), `anonymousIdentities`/`identityMerges`, `dailyProductMetrics`/`hourlyProductMetrics` (rollups are computed on the fly from `analyticsEvents` in `/api/v1/analytics/rollups` instead of precomputed), `auditLogs`, `globalSettings`.

Recently wired up (previously on this unused list): `productAttributes`/`productAttributeValues` (seeded by `pnpm db:seed-catalog`, joined into `Product.specs` by `getStoreCatalog()`), `providerProductMappings` (persisted by `lib/db/repositories/matching.ts#recordProviderProductMapping()` from both `POST /api/v1/matching` and the provider sync route — `productId` is `NOT NULL` on this table, so a mapping is only written when there's at least one match candidate; zero-candidate "new product" cases can't be persisted here until a product exists to point at), `wishlists`/`wishlistItems` (see below).

### Favorites: localStorage for anonymous visitors, `wishlists` table once logged in

`components/visitor-state-provider.tsx`'s `favorites` state (`useVisitorState()`) is dual-backed. Anonymous: `localStorage` only (`garimpo:favorites`), unchanged from before. Logged in: on session appearing, it fetches `GET /api/v1/wishlist`, merges in any local-only favorites via `POST /api/v1/wishlist` (one-time migration keyed by `syncedUserId` ref so it doesn't repeat), and from then on `toggleFavorite()` calls `POST /api/v1/wishlist/toggle` — the DB (via `lib/db/repositories/wishlist.ts`, one auto-created "Favoritos" wishlist per user) becomes the source of truth until the next full page load. Logging out mid-session doesn't revert the in-memory state to `localStorage` until a reload — a known, low-priority gap.

What's real now:
- **`lib/db/schema.ts`/`lib/db/relations.ts`** — introspected from the live Neon DB (`pnpm db:pull`), not hand-written. The DB had a full 46-table schema with seed data (products, offers, a Shopee provider) before this repo had any Drizzle code — re-pull after any out-of-band schema change instead of hand-editing shape.
- **`lib/db/client.ts`** — Drizzle over `@neondatabase/serverless`'s `Pool` (WebSocket, transaction-capable; required for the outbox-style writes in `docs/architecture.md`, not available on `neon-http`).
- **`lib/auth/auth.ts`** — Better Auth, mapped onto the pre-existing `users`/`sessions`/`accounts`/`verifications` tables (custom `modelName`/`fields`, `advanced.database.generateId: 'uuid'` since those columns are native `uuid`, not Better Auth's default id format). `lib/auth/client.ts` is the React client (`useSession`, `signIn`, `signUp`, `signOut`, `requestPasswordReset`). E-mail goes through Brevo only when `BREVO_API_KEY`/`EMAIL_FROM` are set; otherwise `sendResetPassword` just logs the link server-side.
- **RBAC is DB-driven**, not hardcoded: `roles.permissions` (jsonb) is the source of truth, seeded by `pnpm db:seed-roles` from `lib/auth/rbac.ts`'s `defaultRolePermissions` (role codes: `OWNER/ADMIN/MARKETING/CATALOG_MANAGER/ANALYST/SUPPORT/READ_ONLY`). `lib/auth/permissions.ts#getUserPermissions()` looks up a user's roles via `user_roles` on every `authorize()` call. New signups get **no role** (zero permissions) — grant one with `pnpm db:grant-role <email> <ROLE_CODE>`.
- **`lib/db/repositories/*.ts`** — real Drizzle queries behind the API routes (catalog, offers, providers, jobs, events). `lib/analytics/attribution.ts` and `lib/server/ingestion.ts` (provider matching) are DB-backed too, not `lib/mock-data`-backed — this makes them server-only; don't import them from client components (see `app/api/v1/attribution/route.ts` for the client-safe wrapper pattern used by `components/admin/analytics-studio.tsx`).
- **`lib/storage/blob.ts`** — `rehostProviderImage()` downloads a provider's image and re-uploads it to Vercel Blob; wired into `lib/server/ingestion.ts#normalizeProviderProduct()` when a `RawProviderProduct.imageUrl` is present.
- `pnpm db:generate`/`db:migrate`/`db:pull`/`db:studio`/`db:seed-roles`/`db:grant-role`/`db:seed-catalog`/`db:import-shopee` are all wired. `db:seed-catalog` only matters for the 12 archived demo products; the live catalog comes from `db:import-shopee`. Migration tracking is baselined against the pre-existing schema — `db:migrate` is safe/idempotent.

`lib/server/mock-platform.ts` is deleted. `lib/platform/services.ts` (formerly `mock-services.ts`) now posts to the real API via `fetch` instead of writing to `localStorage` — `lib/platform/index.ts` re-exports it unchanged, so client components didn't need touching. `lib/platform/local-repository.ts` (`LocalRepository`) is still used, but **only** by `components/admin/module-content.tsx`'s generic per-module CRUD table — that table spans ~29 unrelated admin modules (SEO, tema, campanhas, LGPD, ...) most of which have no real backing table, so it intentionally stays on browser storage.

### API route conventions (`app/api/v1/*`)

Every route handler follows the same shape via `lib/server/api.ts`:
- `ok(data, init?)` / `fail(message, status, details?, headers?)` — wrap responses as `{ data, meta }` / `{ error: { code, message, details? }, meta }`. `meta.mode` is now `'real'`.
- `authorize(request, permission)` — now **async**, returns `{ blocked: Response | null, userId: string | null }`. Reads the real Better Auth session from `request.headers` (`auth.api.getSession`), then checks the permission via `lib/auth/permissions.ts`. No session → 401; session but missing permission → 403. Callers must `await` it: `const { blocked } = await authorize(request, 'catalog:write'); if (blocked) return blocked`.
- `jsonBody<T>(request)` — unchanged, safe JSON body parse.

**Not every route calls `authorize()`** — public catalog reads (`GET /products`, `GET /products/{id}`, `GET /offers`, `GET /providers`) are intentionally anonymous (mirrors the old mock's `x-mock-role` defaulting to `viewer`, which always had `catalog:read`). Mutations and anything ops/analytics-flavored stay gated. Idempotency (`Idempotency-Key` header) is backed by the real `idempotency_keys` table via `lib/db/idempotency.ts#withIdempotency()`, not an in-memory map.

### `proxy.ts` (root)

Next 16 renamed edge middleware from `middleware.ts` to `proxy.ts` (exports `proxy(request)` + `config.matcher`). Here it only stamps `x-request-id`/`x-trace-id` onto `/api/:path*` and `/admin/:path*` requests for correlation — no auth or redirect logic lives here.

### `packages/contracts`

`@garimpo/contracts` is a pnpm workspace package with no build step (`package.json` exports `src/index.ts` directly). It's a pure re-export barrel of types from `lib/types.ts`, `lib/platform/contracts.ts`, and `lib/auth/rbac.ts`, promoting root-app types for future workspace members (e.g. background workers) per `docs/architecture.md`'s target layout.

### Admin module

`app/admin/[module]/page.tsx` is a single dynamic-segment catch-all that renders different admin modules (ranking, analytics, etc.) from one route. `app/admin/layout.tsx` → `components/admin/admin-shell.tsx` gates access client-side: redirects to `/entrar` with no session, to `/` if the session has zero roles (`GET /api/v1/me`, via `components/admin/admin-access.tsx`), then filters visible nav items by `permissionForModule()`.

### Components

Organized by feature domain: `components/{admin,home,product,search,storefront}/`. There is no shared UI kit: everything is hand-built with CSS Modules over the storefront tokens (`components.json` is only shadcn CLI config; `components/ui` and its dependencies were removed as unused). There is no `hooks/` directory despite the `@/hooks` alias.

### Styling: tokens live in `storefront.module.css`; prefer CSS Modules

The storefront's design tokens (`--primary`, `--surface`, `--foreground`, `--success`, `--radius-*`, `--shadow-*`, `--ease`...) are defined once on `.store` in `components/storefront/storefront.module.css` (applied by `StorefrontShell`). One color per role: orange (`--primary`) is the only action color, green (`--success`) is only for savings/success, navy (`--foreground`) is text and brand. New storefront UI should use a CSS Module that reads those tokens — don't add hex colors. Existing modules: `home`, `featured-products`, `product-detail`, `search-experience`, `personal-pages`, `content-pages` (auth, prose, 404/error), `account`.

`app/globals.css` is legacy: it was pruned by measurement (selectors whose classes appear nowhere in `app`/`components`/`lib` were removed) and now mostly serves the admin and a few shared classes (`.product-card` family in `ProductCard`, `.btn`, `.container`, `.sr-only`). `ProductCard` keeps its global class names on purpose — e2e tests select by them (`.product-card`, `.product-buy-button`, `.product-sold-count`, `.product-card-link`). Playwright's config uses `localhost` on purpose: the Next dev server blocks its own chunks for `127.0.0.1` and hydration fails.

Consent and e-mail (both real now): storefront events (`favorite_*`, `compare_updated`, `product_viewed`, ...) leave the browser only when `garimpo:cookie-preferences.analytics` is true (`lib/platform/consent.ts`, enforced in `lib/platform/services.ts#tracker`; admin operations are not gated), and `@vercel/analytics` is mounted by `components/consented-analytics.tsx` only after that consent. Password reset sends e-mail through Brevo's HTTP API (`POST /v3/smtp/email`) when `BREVO_API_KEY` (or the legacy `brevo`) and `EMAIL_FROM` are set (`lib/auth/email.ts`); without them the link is only logged and `/recuperar-senha` says so. The new-password screen is `/redefinir-senha`. Personalization is real but narrow: the home's "Para você" tab (`components/home/home-catalog.tsx`) appears only when `cookiePreferences.personalization` is on **and** the visitor actually saved interests (`VisitorState.preferencesSaved` — the defaults in `defaultPreferences` never count). Nothing else in ranking reads `state.preferences`. LGPD self-service lives in `/conta#dados`: `GET /api/v1/me/export` (own data only) and Better Auth's `deleteUser` (enabled in `lib/auth/auth.ts`; password required when the account has one; DB FKs cascade or set null). Google-only accounts delete with a fresh session and no password. There is still no human channel for requests that can't be self-served.

### Operations: catalog freshness, caching, clicks

- **Catalog refresh**: `vercel.json` schedules `GET /api/v1/cron/shopee-import` daily (06:00 UTC). It needs `CRON_SECRET` (Vercel sends it as `Bearer`); without it the route answers 503. It imports via `lib/providers/shopee/import.ts` (same code as `pnpm db:import-shopee`), prunes products outside the selection only when the run covered >=70% of the current catalog, then `revalidateTag('catalog' | 'metrics', 'max')`. A full run takes ~40 s; `maxDuration = 300`.
- **Caching**: `getStoreCatalog()` / `getProductMetrics()` use `unstable_cache` (5 min) and fall back to a direct DB read outside the Next runtime (tests, scripts). Product and category pages use `revalidate = 300`. The client context gets `toClientCatalog()` (no gallery/long description/full price history); the product page reads the full item server-side.
- **Affiliate clicks**: buy buttons stay direct links (`rel=sponsored`). `components/affiliate-click-tracker.tsx` is one delegated listener on `a[data-offer-id]`; with `analytics` consent it POSTs `/api/v1/outbound-clicks` (offer id + slot + a per-tab id, no IP/UA/user). New buy buttons must carry `data-offer-id` and `data-slot`.
- **Collections and guides are real**: computed from the catalog on each revalidation (`lib/catalog/collections.ts`, 16 today in 5 groups — Em alta: viralizou (10k+ sales), mais-vendidos, queridinhos, achadinhos; Preço: em-promocao, desconto-pesado, ate-20/50/100; Qualidade: bem-avaliados, nota-maxima; Por categoria: mais-vendidos-<categoria>; plus manual ones in `lib/catalog/curated.ts`, e.g. `virais-do-tiktok`, hidden until it has >=3 active items. No data source says what is viral on TikTok, so never label a rule-based collection that way; `lib/catalog/guides.ts`: one guide per category with >=3 products, plus a short buying checklist authored in code). They reuse `matchesSignal` so counts match `/buscar`. Pages: `/colecoes`, `/colecoes/[slug]`, `/guias`, `/guias/[slug]`; they appear in the menu, footer, home and sitemap. There is no CMS: manual curation would need tables.
- **Admin is deliberately lean**: `lib/admin-config.ts` only exposes `catalogo`, `analytics` and `funil` (real data). The other ~26 modules (localStorage CRUD, sample numbers) are hidden unless `NEXT_PUBLIC_ADMIN_DEMO_MODULES=1`. `/admin` shows real numbers from `lib/db/repositories/admin-overview.ts`; `/admin/catalogo` lists products and runs the import (`POST /api/v1/admin/catalog-import`, permission `jobs:run`, same `runCatalogImport()` as the cron).
- **RUM**: `components/consented-analytics.tsx` mounts Vercel Analytics and Speed Insights only with `analytics` consent. **Tests DB**: set `TEST_DATABASE_URL` to point `pnpm test` at a separate Neon branch.
- **Site URL**: `lib/site.ts#siteUrl` (`NEXT_PUBLIC_SITE_URL`, else Vercel's production domain, else localhost). Never hard-code a domain.
- **Search/category SSR**: `SearchExperience` takes params by props (no `useSearchParams`) so the grid is in the HTML; `/buscar` reads `searchParams`, `/categorias/[slug]` is static and applies the URL after mount.
- **E2E**: `pnpm test:e2e` (dev server) or `pnpm test:e2e:prod` (build + `next start` on :3100; faster and deterministic).

## Docs

`docs/architecture.md` (Portuguese) is the design doc that anticipated most of this migration (Neon/Drizzle, Better Auth, RBAC via roles) — the real schema (46 tables) turned out more granular than its ERD (normalized `product_attributes`/`product_variants`/`offer_prices`/`price_history`, LGPD tables, `daily_product_metrics`/`hourly_product_metrics` rollups, `anonymous_identities`/`identity_merges`). Also present: `docs/data-dictionary.md`, `docs/events.md`, `docs/SECURITY.md`, `docs/PRIVACY.md`, `docs/DEPLOYMENT.md` — useful for intent/rationale, but check the real `lib/db/schema.ts` for actual field names.

## Notes

- `AGENTS.md` is regenerated by `next dev` on every run (Next 16's agent-rules feature). `CLAUDE.md` imports it via `@AGENTS.md` above — don't inline its content here, and commit it if it changes to keep the tree clean.
- `next.config.mjs`: security headers (report-only CSP) plus image optimization. `images.remotePatterns` is an **allowlist** (`cf.shopee.com.br`, `**.susercontent.com`, Vercel Blob, Unsplash): an image from any other host fails with 400, so a new provider with a different CDN must be added there. WebP only, 7-day cache, `deviceSizes` trimmed to `[640, 828, 1080, 1200]`. `NEXT_IMAGE_UNOPTIMIZED=1` turns the optimizer off (serves originals). No rewrites/redirects/experimental flags.
- Path alias: `@/*` → repo root (`tsconfig.json`).
- `.env` (gitignored) holds live Neon + Vercel Blob + Better Auth secrets; `.env.example` documents the shape. `vitest.config.mts` calls `process.loadEnvFile('.env')` at the top, so `pnpm test` and `pnpm test:watch` load it automatically — `pnpm db:*` scripts pass `--env-file=.env` to `tsx` explicitly (`drizzle-kit` loads `.env` on its own).
- **`tests/integration/**` now hits the real Neon DB** (creates real users/products/etc. with random UUIDs/slugs per run) — there's no test-DB isolation yet. `tests/helpers/auth.ts#createAuthenticatedUser(role)` signs up a real user via `auth.api.signUpEmail` and grants a role directly in `user_roles`, returning a `cookie` header for authenticated route-handler calls.
