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

**Data flow**: `app/layout.tsx` (async Server Component) calls `getStoreCatalog()` (`lib/db/repositories/store-catalog.ts`) once per request, which joins products/offers/providers/categories/brands/images/tags/price_history into shapes that match `lib/types.ts`'s original mock `Product`/`Offer`/`Provider`/`Category` types almost exactly — this was a deliberate adapter-pattern choice so that existing client components didn't need their rendering logic rewritten, only their data *source*. That catalog is passed into `<StoreDataProvider>` (`components/store-data-provider.tsx`), a React Context read by `useStoreData()` — client components (`ProductCard`, `ProductDetail`, `HomeCatalog`, `SearchExperience`, `SavedProducts`, `/comparar`) call this hook instead of importing arrays from `lib/mock-data.ts`. Server Components that need data before/outside the React tree (`generateStaticParams`, `generateMetadata`, `sitemap.ts`) call `getStoreCatalog()` directly. `lib/recommendation/engine.ts#generateRecommendations()` takes a second `catalog: {products, offers, metrics?}` argument; it no longer falls back to `lib/mock-data` — with no catalog it returns zero recommendations. Every caller (`ProductDetail`, `/api/v1/recommendations`, the admin ranking simulator in `components/admin/experience-studio.tsx`) passes the real catalog plus `metrics` from `lib/db/repositories/product-metrics.ts#getProductMetrics()` (views/clicks/favorites/conversions aggregated from `analytics_events` + `affiliate_clicks` + `affiliate_conversions`). `app/layout.tsx` loads those metrics alongside the catalog and passes them to `<StoreDataProvider metrics>`, so client components rank with measured engagement. Where no traffic has been measured yet the engine falls back to the offer's real `soldCount`/`commissionRate` instead of the hashed pseudo-random features it used before (`ALGORITHM_VERSION` is now `garimpo-ranker-3.0.0`).

### Catalog comes from the real Shopee Affiliate API

`lib/providers/shopee/client.ts` talks to `https://open-api.affiliate.shopee.com.br/graphql` (GraphQL, signed with `SHA256(AppId + Timestamp + Payload + Secret)`; credentials in `SHOPEE_AFFILIATE_APP_ID`/`SHOPEE_AFFILIATE_APP_SECRET`, server-only, retries on HTTP 429/5xx and on GraphQL code `10030`). `fetchProductOffers`/`fetchAllProductOffers` wrap `productOfferV2`; `generateShortLink` wraps the mutation (available, not used by the importer yet — `offerLink` from the API is already an attributed affiliate link).

`pnpm db:import-shopee [--per-category=8 --min-rating=4.5 --min-sales=50 --max-per-shop=2 --replace-demo]` (`lib/db/import-shopee.ts`) searches real keywords per storefront category, filters by `isUsableOffer`, caps products per seller, maps via `lib/providers/shopee/mapping.ts` and upserts through `lib/db/repositories/catalog-import.ts` (brand=seller, one primary image, tags derived from the numbers, `price_history` snapshot when the price moved). `--replace-demo` **archives** (status `removed`, never deletes) products with no affiliate offer; `getStoreCatalog()` only reads `status = 'active'` rows.

Gotchas the API imposes, don't "fix" them by inventing data:
- There is no review count and no description — `products.reviewsCount` stays 0 and the UI hides review counts; `description` is generated as "Vendido por {loja} na Shopee.".
- `priceDiscountRate` only reconciles with `priceMin` when `priceMin === priceMax`; otherwise it refers to another variant, so `originalPriceFrom()` returns null (no fake "de/por"). `offers.price_max` (migration `0005_unique_falcon.sql`) stores the range so the UI can say "até R$ X".
- Shipping is not exposed at all: `Offer.shipping` is 0 as a calculation placeholder and no screen claims "Frete grátis".
- `products.editorialScore` ("Índice Garimpo") is computed by `editorialScoreFrom()` from rating + log(sales) + discount; `growthPercentage` has no source and stays 0 (sorting that used it now uses `soldCount`).

**Still mock, deliberately, not an oversight**:
- `app/colecoes/[slug]` and `app/guias*` (curated collections, editorial articles) — no real backing tables exist for these; they're content/CMS concepts, not catalog data.
- `components/admin/module-content.tsx`'s generic per-module CRUD table (`LocalRepository`/browser storage) — spans ~29 unrelated admin modules (SEO, tema, campanhas, LGPD, ...), most without any real table to bind to.
- `components/admin/experience-studio.tsx`'s campaign/segment simulators and `app/admin/page.tsx`'s dashboard numbers (`auditEvents`, `jobs` from `lib/mock-data`) — admin-only demo tooling. The ranking simulator inside it is real now (real catalog + metrics).

### Schema coverage: 47 tables exist, ~22 are actually wired up

Don't assume a table being defined in `lib/db/schema.ts` means something uses it — the DB was introspected whole, and roughly half its tables have zero references outside `schema.ts`/`relations.ts`. Before building a feature, `grep` for the table name first. As of this writing, unused: `affiliateLinks`/`affiliatePrograms` (we call `affiliateClicks`/`affiliateConversions` directly with a bare `providerId`, no link/program layer), `syncJobs`/`syncJobRuns`/`syncErrors` (provider sync uses the generic `jobQueueEntries` instead), `productVariants`, `offerPrices`/`offerAvailability`/`offerCommissions` (fields live directly on `offers` instead of these normalized snapshot tables), `providerAccounts`/`providerCapabilities`, `consentRecords`/`privacyPreferences`/`privacyRequests` (LGPD — cookie consent is still `localStorage`-only), `anonymousIdentities`/`identityMerges`, `dailyProductMetrics`/`hourlyProductMetrics` (rollups are computed on the fly from `analyticsEvents` in `/api/v1/analytics/rollups` instead of precomputed), `auditLogs`, `globalSettings`.

Recently wired up (previously on this unused list): `productAttributes`/`productAttributeValues` (seeded by `pnpm db:seed-catalog`, joined into `Product.specs` by `getStoreCatalog()`), `providerProductMappings` (persisted by `lib/db/repositories/matching.ts#recordProviderProductMapping()` from both `POST /api/v1/matching` and the provider sync route — `productId` is `NOT NULL` on this table, so a mapping is only written when there's at least one match candidate; zero-candidate "new product" cases can't be persisted here until a product exists to point at), `wishlists`/`wishlistItems` (see below).

### Favorites: localStorage for anonymous visitors, `wishlists` table once logged in

`components/mock-provider.tsx`'s `favorites` state is dual-backed. Anonymous: `localStorage` only (`garimpo:favorites`), unchanged from before. Logged in: on session appearing, it fetches `GET /api/v1/wishlist`, merges in any local-only favorites via `POST /api/v1/wishlist` (one-time migration keyed by `syncedUserId` ref so it doesn't repeat), and from then on `toggleFavorite()` calls `POST /api/v1/wishlist/toggle` — the DB (via `lib/db/repositories/wishlist.ts`, one auto-created "Favoritos" wishlist per user) becomes the source of truth until the next full page load. Logging out mid-session doesn't revert the in-memory state to `localStorage` until a reload — a known, low-priority gap.

What's real now:
- **`lib/db/schema.ts`/`lib/db/relations.ts`** — introspected from the live Neon DB (`pnpm db:pull`), not hand-written. The DB had a full 46-table schema with seed data (products, offers, a Shopee provider) before this repo had any Drizzle code — re-pull after any out-of-band schema change instead of hand-editing shape.
- **`lib/db/client.ts`** — Drizzle over `@neondatabase/serverless`'s `Pool` (WebSocket, transaction-capable; required for the outbox-style writes in `docs/architecture.md`, not available on `neon-http`).
- **`lib/auth/auth.ts`** — Better Auth, mapped onto the pre-existing `users`/`sessions`/`accounts`/`verifications` tables (custom `modelName`/`fields`, `advanced.database.generateId: 'uuid'` since those columns are native `uuid`, not Better Auth's default id format). `lib/auth/client.ts` is the React client (`useSession`, `signIn`, `signUp`, `signOut`, `requestPasswordReset`). No email provider is wired — `sendResetPassword` just logs the link server-side.
- **RBAC is DB-driven**, not hardcoded: `roles.permissions` (jsonb) is the source of truth, seeded by `pnpm db:seed-roles` from `lib/auth/rbac.ts`'s `defaultRolePermissions` (role codes: `OWNER/ADMIN/MARKETING/CATALOG_MANAGER/ANALYST/SUPPORT/READ_ONLY`). `lib/auth/permissions.ts#getUserPermissions()` looks up a user's roles via `user_roles` on every `authorize()` call. New signups get **no role** (zero permissions) — grant one with `pnpm db:grant-role <email> <ROLE_CODE>`.
- **`lib/db/repositories/*.ts`** — real Drizzle queries behind the API routes (catalog, offers, providers, jobs, events). `lib/analytics/attribution.ts` and `lib/server/ingestion.ts` (provider matching) are DB-backed too, not `lib/mock-data`-backed — this makes them server-only; don't import them from client components (see `app/api/v1/attribution/route.ts` for the client-safe wrapper pattern used by `components/admin/analytics-studio.tsx`).
- **`lib/storage/blob.ts`** — `rehostProviderImage()` downloads a provider's image and re-uploads it to Vercel Blob; wired into `lib/server/ingestion.ts#normalizeProviderProduct()` when a `RawProviderProduct.imageUrl` is present.
- `pnpm db:generate`/`db:migrate`/`db:pull`/`db:studio`/`db:seed-roles`/`db:grant-role`/`db:seed-catalog`/`db:import-shopee` are all wired. `db:seed-catalog` only matters for the 12 archived demo products; the live catalog comes from `db:import-shopee`. Migration tracking is baselined against the pre-existing schema — `db:migrate` is safe/idempotent.

`lib/server/mock-platform.ts` is deleted. `lib/platform/mock-services.ts` (still the file name) now posts to the real API via `fetch` instead of writing to `localStorage` — `lib/platform/index.ts` re-exports it unchanged, so client components didn't need touching. `lib/platform/local-repository.ts` (`LocalRepository`) is still used, but **only** by `components/admin/module-content.tsx`'s generic per-module CRUD table — that table spans ~29 unrelated admin modules (SEO, tema, campanhas, LGPD, ...) most of which have no real backing table, so it intentionally stays on browser storage.

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

Organized by feature domain, not shadcn's typical flat/atomic layout: `components/{admin,home,product,search,storefront}/`. `components/ui/` is minimal (just `button.tsx`) — most UI is hand-built, not generated shadcn components, even though `components.json` configures shadcn tooling (style `base-nova`, base color `neutral`, aliases `@/components`, `@/components/ui`, `@/lib`, `@/hooks`). There is no `hooks/` directory yet despite the alias.

## Docs

`docs/architecture.md` (Portuguese) is the design doc that anticipated most of this migration (Neon/Drizzle, Better Auth, RBAC via roles) — the real schema (46 tables) turned out more granular than its ERD (normalized `product_attributes`/`product_variants`/`offer_prices`/`price_history`, LGPD tables, `daily_product_metrics`/`hourly_product_metrics` rollups, `anonymous_identities`/`identity_merges`). Also present: `docs/data-dictionary.md`, `docs/events.md`, `docs/SECURITY.md`, `docs/PRIVACY.md`, `docs/DEPLOYMENT.md` — useful for intent/rationale, but check the real `lib/db/schema.ts` for actual field names.

## Notes

- `AGENTS.md` is regenerated by `next dev` on every run (Next 16's agent-rules feature). `CLAUDE.md` imports it via `@AGENTS.md` above — don't inline its content here, and commit it if it changes to keep the tree clean.
- `next.config.mjs` is minimal: `images.unoptimized: true` plus a global `headers()` (security headers + report-only CSP). No rewrites/redirects/experimental flags.
- Path alias: `@/*` → repo root (`tsconfig.json`).
- `.env` (gitignored) holds live Neon + Vercel Blob + Better Auth secrets; `.env.example` documents the shape. `vitest.config.mts` calls `process.loadEnvFile('.env')` at the top, so `pnpm test` and `pnpm test:watch` load it automatically — `pnpm db:*` scripts pass `--env-file=.env` to `tsx` explicitly (`drizzle-kit` loads `.env` on its own).
- **`tests/integration/**` now hits the real Neon DB** (creates real users/products/etc. with random UUIDs/slugs per run) — there's no test-DB isolation yet. `tests/helpers/auth.ts#createAuthenticatedUser(role)` signs up a real user via `auth.api.signUpEmail` and grants a role directly in `user_roles`, returning a `cookie` header for authenticated route-handler calls.
