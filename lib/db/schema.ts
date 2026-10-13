import { pgTable, index, uuid, text, integer, timestamp, jsonb, numeric, boolean, foreignKey, unique, primaryKey, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const attributeDataType = pgEnum("attribute_data_type", ['text', 'number', 'boolean', 'enum'])
export const commissionTransactionStatus = pgEnum("commission_transaction_status", ['pending', 'approved', 'paid', 'reversed'])
export const consentCategory = pgEnum("consent_category", ['necessary', 'analytics', 'personalization', 'marketing'])
export const conversionStatus = pgEnum("conversion_status", ['pending', 'approved', 'rejected', 'cancelled', 'paid'])
export const jobQueueStatus = pgEnum("job_queue_status", ['pending', 'processing', 'succeeded', 'failed', 'dead_letter'])
export const matchStatus = pgEnum("match_status", ['auto_merged', 'pending_review', 'separate'])
export const offerAvailabilityStatus = pgEnum("offer_availability_status", ['in_stock', 'out_of_stock', 'unknown'])
export const offerStatus = pgEnum("offer_status", ['active', 'inactive', 'removed'])
export const privacyRequestStatus = pgEnum("privacy_request_status", ['pending', 'processing', 'completed', 'rejected'])
export const privacyRequestType = pgEnum("privacy_request_type", ['export', 'deletion', 'access', 'correction', 'information', 'revocation', 'other'])
export const productStatus = pgEnum("product_status", ['active', 'unavailable', 'discontinued', 'removed'])
export const providerAccountStatus = pgEnum("provider_account_status", ['active', 'revoked'])
export const providerStatus = pgEnum("provider_status", ['active', 'disabled', 'degraded'])
export const roleCode = pgEnum("role_code", ['OWNER', 'ADMIN', 'MARKETING', 'CATALOG_MANAGER', 'ANALYST', 'SUPPORT', 'READ_ONLY'])
export const syncRunStatus = pgEnum("sync_run_status", ['running', 'succeeded', 'failed', 'partial'])


export const analyticsEvents = pgTable("analytics_events", {
	eventId: uuid("event_id").defaultRandom().primaryKey().notNull(),
	eventName: text("event_name").notNull(),
	eventVersion: integer("event_version").default(1).notNull(),
	timestamp: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	anonymousId: text("anonymous_id").notNull(),
	sessionId: text("session_id").notNull(),
	userId: uuid("user_id"),
	page: text(),
	referrer: text(),
	utmSource: text("utm_source"),
	utmMedium: text("utm_medium"),
	utmCampaign: text("utm_campaign"),
	utmContent: text("utm_content"),
	utmTerm: text("utm_term"),
	device: text(),
	productId: uuid("product_id"),
	offerId: uuid("offer_id"),
	providerId: uuid("provider_id"),
	recommendationSlotId: text("recommendation_slot_id"),
	campaignId: text("campaign_id"),
	experimentId: text("experiment_id"),
	variantId: text("variant_id"),
	metadata: jsonb().default({}).notNull(),
}, (table) => [
	index("analytics_events_anonymous_idx").using("btree", table.anonymousId.asc().nullsLast().op("timestamptz_ops"), table.timestamp.asc().nullsLast().op("text_ops")),
	index("analytics_events_created_idx").using("btree", table.timestamp.asc().nullsLast().op("timestamptz_ops")),
	index("analytics_events_product_idx").using("btree", table.productId.asc().nullsLast().op("uuid_ops"), table.timestamp.asc().nullsLast().op("timestamptz_ops")),
	index("analytics_events_user_idx").using("btree", table.userId.asc().nullsLast().op("timestamptz_ops"), table.timestamp.asc().nullsLast().op("uuid_ops")),
]);

export const dailyProductMetrics = pgTable("daily_product_metrics", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	productId: uuid("product_id").notNull(),
	windowStart: timestamp("window_start", { withTimezone: true, mode: 'string' }).notNull(),
	windowEnd: timestamp("window_end", { withTimezone: true, mode: 'string' }).notNull(),
	impressions: integer().default(0).notNull(),
	views: integer().default(0).notNull(),
	clicks: integer().default(0).notNull(),
	affiliateClicks: integer("affiliate_clicks").default(0).notNull(),
	favorites: integer().default(0).notNull(),
	conversions: integer().default(0).notNull(),
	commission: numeric({ precision: 12, scale:  2 }).default('0').notNull(),
	ctr: numeric({ precision: 6, scale:  4 }),
	outboundCtr: numeric("outbound_ctr", { precision: 6, scale:  4 }),
}, (table) => [
	index("daily_product_metrics_product_idx").using("btree", table.productId.asc().nullsLast().op("timestamptz_ops"), table.windowStart.asc().nullsLast().op("timestamptz_ops")),
]);

export const hourlyProductMetrics = pgTable("hourly_product_metrics", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	productId: uuid("product_id").notNull(),
	windowStart: timestamp("window_start", { withTimezone: true, mode: 'string' }).notNull(),
	windowEnd: timestamp("window_end", { withTimezone: true, mode: 'string' }).notNull(),
	impressions: integer().default(0).notNull(),
	views: integer().default(0).notNull(),
	clicks: integer().default(0).notNull(),
	affiliateClicks: integer("affiliate_clicks").default(0).notNull(),
	favorites: integer().default(0).notNull(),
}, (table) => [
	index("hourly_product_metrics_product_idx").using("btree", table.productId.asc().nullsLast().op("timestamptz_ops"), table.windowStart.asc().nullsLast().op("timestamptz_ops")),
]);

export const featureFlags = pgTable("feature_flags", {
	key: text().primaryKey().notNull(),
	enabled: boolean().default(false).notNull(),
	description: text(),
	rolloutPercentage: integer("rollout_percentage").default(100).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const globalSettings = pgTable("global_settings", {
	key: text().primaryKey().notNull(),
	value: jsonb().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const jobQueueEntries = pgTable("job_queue_entries", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	jobType: text("job_type").notNull(),
	payload: jsonb().notNull(),
	status: jobQueueStatus().default('pending').notNull(),
	attempts: integer().default(0).notNull(),
	maxAttempts: integer("max_attempts").default(5).notNull(),
	runAfter: timestamp("run_after", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lastError: text("last_error"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const products = pgTable("products", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	slug: text().notNull(),
	name: text().notNull(),
	brandId: uuid("brand_id"),
	description: text(),
	status: productStatus().default('active').notNull(),
	canonicalImageId: uuid("canonical_image_id"),
	rating: numeric({ precision: 3, scale: 2 }).default('0').notNull(),
	reviewsCount: integer("reviews_count").default(0).notNull(),
	editorialScore: numeric("editorial_score", { precision: 5, scale: 2 }).default('0').notNull(),
	growthPercentage: numeric("growth_percentage", { precision: 6, scale: 2 }).default('0').notNull(),
	/** Verdadeiro depois de uma edição pelo painel: a importação não sobrescreve nome, status, categoria e tags. */
	editorialLocked: boolean("editorial_locked").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("products_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.brandId],
			foreignColumns: [brands.id],
			name: "products_brand_id_brands_id_fk"
		}),
	unique("products_slug_unique").on(table.slug),
]);

export const productAttributeValues = pgTable("product_attribute_values", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	productId: uuid("product_id").notNull(),
	attributeId: uuid("attribute_id").notNull(),
	valueText: text("value_text"),
	valueNumber: numeric("value_number", { precision: 14, scale:  4 }),
	valueBoolean: boolean("value_boolean"),
}, (table) => [
	index("product_attribute_values_product_idx").using("btree", table.productId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.attributeId],
			foreignColumns: [productAttributes.id],
			name: "product_attribute_values_attribute_id_product_attributes_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "product_attribute_values_product_id_products_id_fk"
		}).onDelete("cascade"),
]);

export const productAttributes = pgTable("product_attributes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	code: text().notNull(),
	label: text().notNull(),
	dataType: attributeDataType("data_type").notNull(),
}, (table) => [
	unique("product_attributes_code_unique").on(table.code),
]);

export const categories = pgTable("categories", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	parentId: uuid("parent_id"),
	name: text().notNull(),
	slug: text().notNull(),
	path: text().notNull(),
	depth: integer().default(0).notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("categories_parent_idx").using("btree", table.parentId.asc().nullsLast().op("uuid_ops")),
	index("categories_path_idx").using("btree", table.path.asc().nullsLast().op("text_ops")),
]);

export const productImages = pgTable("product_images", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	productId: uuid("product_id").notNull(),
	providerId: uuid("provider_id"),
	sourceUrl: text("source_url").notNull(),
	width: integer(),
	height: integer(),
	position: integer().default(0).notNull(),
	isPrimary: boolean("is_primary").default(false).notNull(),
	contentHash: text("content_hash"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("product_images_product_idx").using("btree", table.productId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "product_images_product_id_products_id_fk"
		}).onDelete("cascade"),
]);

export const tags = pgTable("tags", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	code: text().notNull(),
	label: text().notNull(),
}, (table) => [
	unique("tags_code_unique").on(table.code),
]);

export const productVariants = pgTable("product_variants", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	productId: uuid("product_id").notNull(),
	name: text().notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "product_variants_product_id_products_id_fk"
		}).onDelete("cascade"),
]);

export const brands = pgTable("brands", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("brands_slug_unique").on(table.slug),
]);

export const providers = pgTable("providers", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	code: text().notNull(),
	displayName: text("display_name").notNull(),
	status: providerStatus().default('active').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("providers_code_unique").on(table.code),
]);

export const providerAccounts = pgTable("provider_accounts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	providerId: uuid("provider_id").notNull(),
	label: text().notNull(),
	encryptedCredentials: jsonb("encrypted_credentials").notNull(),
	credentialsVersion: integer("credentials_version").default(1).notNull(),
	status: providerAccountStatus().default('active').notNull(),
	lastValidatedAt: timestamp("last_validated_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.providerId],
			foreignColumns: [providers.id],
			name: "provider_accounts_provider_id_providers_id_fk"
		}).onDelete("cascade"),
]);

export const offers = pgTable("offers", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	productId: uuid("product_id").notNull(),
	providerId: uuid("provider_id").notNull(),
	externalId: text("external_id").notNull(),
	externalUrl: text("external_url").notNull(),
	affiliateUrl: text("affiliate_url"),
	/** Etiquetas (sub ids) embutidas em `affiliate_url`, ex.: "site-tecnologia". Nulo quando o link é o `offerLink` bruto da API. */
	affiliateSubIds: text("affiliate_sub_ids"),
	currency: text().default('BRL').notNull(),
	price: numeric({ precision: 12, scale:  2 }).notNull(),
	priceMax: numeric("price_max", { precision: 12, scale:  2 }),
	originalPrice: numeric("original_price", { precision: 12, scale:  2 }),
	discountPercentage: numeric("discount_percentage", { precision: 5, scale:  2 }),
	commissionRate: numeric("commission_rate", { precision: 6, scale:  4 }),
	estimatedCommission: numeric("estimated_commission", { precision: 12, scale:  2 }),
	availability: offerAvailabilityStatus().default('unknown').notNull(),
	sellerName: text("seller_name"),
	rating: numeric({ precision: 3, scale:  2 }),
	ratingCount: integer("rating_count"),
	soldCount: integer("sold_count"),
	lastSyncedAt: timestamp("last_synced_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	status: offerStatus().default('active').notNull(),
}, (table) => [
	index("offers_product_idx").using("btree", table.productId.asc().nullsLast().op("uuid_ops")),
	index("offers_status_price_idx").using("btree", table.status.asc().nullsLast().op("enum_ops"), table.price.asc().nullsLast().op("numeric_ops")),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "offers_product_id_products_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.providerId],
			foreignColumns: [providers.id],
			name: "offers_provider_id_providers_id_fk"
		}).onDelete("cascade"),
	unique("offers_provider_external_id_uq").on(table.externalId, table.providerId),
]);

export const offerAvailability = pgTable("offer_availability", {
	offerId: uuid("offer_id").primaryKey().notNull(),
	availability: offerAvailabilityStatus().default('unknown').notNull(),
	checkedAt: timestamp("checked_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.offerId],
			foreignColumns: [offers.id],
			name: "offer_availability_offer_id_offers_id_fk"
		}).onDelete("cascade"),
]);

export const offerCommissions = pgTable("offer_commissions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	offerId: uuid("offer_id").notNull(),
	commissionRate: numeric("commission_rate", { precision: 6, scale:  4 }).notNull(),
	effectiveFrom: timestamp("effective_from", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	effectiveTo: timestamp("effective_to", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.offerId],
			foreignColumns: [offers.id],
			name: "offer_commissions_offer_id_offers_id_fk"
		}).onDelete("cascade"),
]);

export const offerPrices = pgTable("offer_prices", {
	offerId: uuid("offer_id").primaryKey().notNull(),
	price: numeric({ precision: 12, scale:  2 }).notNull(),
	originalPrice: numeric("original_price", { precision: 12, scale:  2 }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.offerId],
			foreignColumns: [offers.id],
			name: "offer_prices_offer_id_offers_id_fk"
		}).onDelete("cascade"),
]);

export const priceHistory = pgTable("price_history", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	offerId: uuid("offer_id").notNull(),
	price: numeric({ precision: 12, scale:  2 }).notNull(),
	originalPrice: numeric("original_price", { precision: 12, scale:  2 }),
	soldCount: integer("sold_count"),
	capturedAt: timestamp("captured_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("price_history_offer_idx").using("btree", table.offerId.asc().nullsLast().op("timestamptz_ops"), table.capturedAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.offerId],
			foreignColumns: [offers.id],
			name: "price_history_offer_id_offers_id_fk"
		}).onDelete("cascade"),
]);

export const providerProductMappings = pgTable("provider_product_mappings", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	providerId: uuid("provider_id").notNull(),
	externalProductId: text("external_product_id").notNull(),
	productId: uuid("product_id").notNull(),
	offerId: uuid("offer_id"),
	confidenceScore: numeric("confidence_score", { precision: 4, scale:  3 }).notNull(),
	matchStatus: matchStatus("match_status").default('separate').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.offerId],
			foreignColumns: [offers.id],
			name: "provider_product_mappings_offer_id_offers_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "provider_product_mappings_product_id_products_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.providerId],
			foreignColumns: [providers.id],
			name: "provider_product_mappings_provider_id_providers_id_fk"
		}).onDelete("cascade"),
	unique("provider_product_mappings_uq").on(table.externalProductId, table.providerId),
]);

export const affiliateClicks = pgTable("affiliate_clicks", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	clickId: text("click_id").notNull(),
	offerId: uuid("offer_id").notNull(),
	affiliateLinkId: uuid("affiliate_link_id"),
	anonymousId: text("anonymous_id").notNull(),
	sessionId: text("session_id").notNull(),
	userId: uuid("user_id"),
	subId: text("sub_id").notNull(),
	recommendationSlotId: text("recommendation_slot_id"),
	experimentVariantId: uuid("experiment_variant_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("affiliate_clicks_offer_idx").using("btree", table.offerId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.affiliateLinkId],
			foreignColumns: [affiliateLinks.id],
			name: "affiliate_clicks_affiliate_link_id_affiliate_links_id_fk"
		}),
	foreignKey({
			columns: [table.offerId],
			foreignColumns: [offers.id],
			name: "affiliate_clicks_offer_id_offers_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "affiliate_clicks_user_id_users_id_fk"
		}).onDelete("set null"),
	unique("affiliate_clicks_click_id_unique").on(table.clickId),
]);

export const affiliateLinks = pgTable("affiliate_links", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	offerId: uuid("offer_id").notNull(),
	programId: uuid("program_id").notNull(),
	baseUrl: text("base_url").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.offerId],
			foreignColumns: [offers.id],
			name: "affiliate_links_offer_id_offers_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.programId],
			foreignColumns: [affiliatePrograms.id],
			name: "affiliate_links_program_id_affiliate_programs_id_fk"
		}).onDelete("cascade"),
]);

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: text().notNull(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	name: text(),
	image: text(),
	defaultLocale: text("default_locale").default('pt-BR').notNull(),
	personalizationEnabled: boolean("personalization_enabled").default(true).notNull(),
	/** Verificação em duas etapas (TOTP) ativa. Gerenciada pelo plugin `twoFactor` do Better Auth. */
	twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("users_email_unique").on(table.email),
]);

/** Segredo TOTP e códigos de recuperação (cifrados pelo Better Auth). Uma linha por usuário com 2FA. */
export const twoFactor = pgTable("two_factor", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	secret: text().notNull(),
	backupCodes: text("backup_codes").notNull(),
	userId: uuid("user_id").notNull(),
	/** Falso entre gerar o segredo e confirmar o primeiro código: só então a proteção passa a valer. */
	verified: boolean().default(true).notNull(),
	failedVerificationCount: integer("failed_verification_count").default(0).notNull(),
	lockedUntil: timestamp("locked_until", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("two_factor_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "two_factor_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const affiliateConversions = pgTable("affiliate_conversions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	providerConversionId: text("provider_conversion_id").notNull(),
	clickId: text("click_id"),
	providerId: uuid("provider_id").notNull(),
	orderReferenceHash: text("order_reference_hash").notNull(),
	amount: numeric({ precision: 12, scale:  2 }).notNull(),
	commission: numeric({ precision: 12, scale:  2 }).notNull(),
	currency: text().default('BRL').notNull(),
	status: conversionStatus().default('pending').notNull(),
	clickedAt: timestamp("clicked_at", { withTimezone: true, mode: 'string' }),
	convertedAt: timestamp("converted_at", { withTimezone: true, mode: 'string' }),
	validatedAt: timestamp("validated_at", { withTimezone: true, mode: 'string' }),
	/** Origem do clique, vinda do relatório da Shopee (`utmContent`), ex.: "site-tecnologia" ou "telegram-ofertasdodia". */
	subIds: text("sub_ids"),
	/** `new` ou `existing`: a Shopee paga comissões diferentes para comprador novo e recorrente. */
	buyerType: text("buyer_type"),
	syncedAt: timestamp("synced_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.clickId],
			foreignColumns: [affiliateClicks.clickId],
			name: "affiliate_conversions_click_id_affiliate_clicks_click_id_fk"
		}),
	foreignKey({
			columns: [table.providerId],
			foreignColumns: [providers.id],
			name: "affiliate_conversions_provider_id_providers_id_fk"
		}).onDelete("cascade"),
	index("affiliate_conversions_converted_idx").using("btree", table.convertedAt.desc().nullsLast().op("timestamptz_ops")),
	unique("affiliate_conversions_provider_uq").on(table.providerConversionId, table.providerId),
]);

/** Itens de cada conversão importada da Shopee: ligam a comissão ao produto (via `offers.external_id`). */
export const affiliateConversionItems = pgTable("affiliate_conversion_items", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	conversionId: uuid("conversion_id").notNull(),
	offerId: uuid("offer_id"),
	externalItemId: text("external_item_id").notNull(),
	itemName: text("item_name").notNull(),
	quantity: integer().default(1).notNull(),
	amount: numeric({ precision: 12, scale:  2 }).default('0').notNull(),
	refundAmount: numeric("refund_amount", { precision: 12, scale:  2 }).default('0').notNull(),
	commission: numeric({ precision: 12, scale:  2 }).default('0').notNull(),
	itemStatus: text("item_status"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("affiliate_conversion_items_conversion_idx").using("btree", table.conversionId.asc().nullsLast().op("uuid_ops")),
	index("affiliate_conversion_items_offer_idx").using("btree", table.offerId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.conversionId],
			foreignColumns: [affiliateConversions.id],
			name: "affiliate_conversion_items_conversion_id_affiliate_conversions_"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.offerId],
			foreignColumns: [offers.id],
			name: "affiliate_conversion_items_offer_id_offers_id_fk"
		}).onDelete("set null"),
]);

export const affiliatePrograms = pgTable("affiliate_programs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	providerId: uuid("provider_id").notNull(),
	programCode: text("program_code").notNull(),
	termsUrl: text("terms_url"),
}, (table) => [
	foreignKey({
			columns: [table.providerId],
			foreignColumns: [providers.id],
			name: "affiliate_programs_provider_id_providers_id_fk"
		}).onDelete("cascade"),
]);

export const commissionTransactions = pgTable("commission_transactions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	conversionId: uuid("conversion_id").notNull(),
	amount: numeric({ precision: 12, scale:  2 }).notNull(),
	status: commissionTransactionStatus().default('pending').notNull(),
	paidAt: timestamp("paid_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.conversionId],
			foreignColumns: [affiliateConversions.id],
			name: "commission_transactions_conversion_id_affiliate_conversions_id_"
		}).onDelete("cascade"),
]);

export const accounts = pgTable("accounts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	issuer: text().notNull(),
	providerId: text("provider_id").notNull(),
	accountId: text("account_id").notNull(),
	accessTokenEncrypted: text("access_token_encrypted"),
	refreshTokenEncrypted: text("refresh_token_encrypted"),
	idToken: text("id_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true, mode: 'string' }),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true, mode: 'string' }),
	scope: text(),
	passwordHash: text("password_hash"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "accounts_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("accounts_issuer_account_id_uq").on(table.issuer, table.accountId),
]);

export const anonymousIdentities = pgTable("anonymous_identities", {
	id: text().primaryKey().notNull(),
	firstSeenAt: timestamp("first_seen_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const identityMerges = pgTable("identity_merges", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	anonymousId: text("anonymous_id").notNull(),
	userId: uuid("user_id").notNull(),
	mergedAt: timestamp("merged_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	mergeReason: text("merge_reason").default('login').notNull(),
}, (table) => [
	foreignKey({
			columns: [table.anonymousId],
			foreignColumns: [anonymousIdentities.id],
			name: "identity_merges_anonymous_id_anonymous_identities_id_fk"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "identity_merges_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const sessions = pgTable("sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	token: text().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "sessions_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("sessions_token_unique").on(table.token),
]);

export const roles = pgTable("roles", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	code: roleCode().notNull(),
	permissions: jsonb().default([]).notNull(),
}, (table) => [
	unique("roles_code_unique").on(table.code),
]);

export const wishlists = pgTable("wishlists", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	name: text().default('Favoritos').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "wishlists_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const wishlistItems = pgTable("wishlist_items", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	wishlistId: uuid("wishlist_id").notNull(),
	productId: uuid("product_id").notNull(),
	addedAt: timestamp("added_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	note: text(),
}, (table) => [
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "wishlist_items_product_id_products_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.wishlistId],
			foreignColumns: [wishlists.id],
			name: "wishlist_items_wishlist_id_wishlists_id_fk"
		}).onDelete("cascade"),
]);

export const auditLogs = pgTable("audit_logs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	actorUserId: uuid("actor_user_id"),
	action: text().notNull(),
	entityType: text("entity_type").notNull(),
	entityId: text("entity_id").notNull(),
	before: jsonb(),
	after: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.actorUserId],
			foreignColumns: [users.id],
			name: "audit_logs_actor_user_id_users_id_fk"
		}).onDelete("set null"),
]);

export const syncJobRuns = pgTable("sync_job_runs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	syncJobId: uuid("sync_job_id").notNull(),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	finishedAt: timestamp("finished_at", { withTimezone: true, mode: 'string' }),
	status: syncRunStatus().default('running').notNull(),
	processedCount: integer("processed_count").default(0).notNull(),
	createdCount: integer("created_count").default(0).notNull(),
	updatedCount: integer("updated_count").default(0).notNull(),
	rejectedCount: integer("rejected_count").default(0).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.syncJobId],
			foreignColumns: [syncJobs.id],
			name: "sync_job_runs_sync_job_id_sync_jobs_id_fk"
		}).onDelete("cascade"),
]);

export const syncErrors = pgTable("sync_errors", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	syncJobRunId: uuid("sync_job_run_id").notNull(),
	externalId: text("external_id"),
	errorMessage: text("error_message").notNull(),
	payloadRef: text("payload_ref"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.syncJobRunId],
			foreignColumns: [syncJobRuns.id],
			name: "sync_errors_sync_job_run_id_sync_job_runs_id_fk"
		}).onDelete("cascade"),
]);

export const syncJobs = pgTable("sync_jobs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	providerId: uuid("provider_id").notNull(),
	jobType: text("job_type").notNull(),
	scheduleCron: text("schedule_cron").notNull(),
	enabled: boolean().default(true).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.providerId],
			foreignColumns: [providers.id],
			name: "sync_jobs_provider_id_providers_id_fk"
		}).onDelete("cascade"),
]);

export const consentRecords = pgTable("consent_records", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	anonymousId: text("anonymous_id"),
	category: consentCategory().notNull(),
	granted: text().notNull(),
	legalBasis: text("legal_basis"),
	recordedAt: timestamp("recorded_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "consent_records_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const privacyPreferences = pgTable("privacy_preferences", {
	userId: uuid("user_id").primaryKey().notNull(),
	personalizationEnabled: text("personalization_enabled").default('true').notNull(),
	marketingCommunicationsEnabled: text("marketing_communications_enabled").default('false').notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "privacy_preferences_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const privacyRequests = pgTable("privacy_requests", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	/** Nulo quando o pedido veio do formulário público, de quem não tem conta. */
	userId: uuid("user_id"),
	type: privacyRequestType().notNull(),
	status: privacyRequestStatus().default('pending').notNull(),
	requestedAt: timestamp("requested_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	resultRef: jsonb("result_ref"),
	/** E-mail informado no formulário público (para responder a quem não tem conta). */
	email: text(),
	message: text(),
	/** `portal` (formulário em /privacidade) ou `account` (autoatendimento em /conta). */
	source: text(),
	/** Anotação interna da equipe sobre o atendimento. */
	responseNote: text("response_note"),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "privacy_requests_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const productTags = pgTable("product_tags", {
	productId: uuid("product_id").notNull(),
	tagId: uuid("tag_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "product_tags_product_id_products_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.tagId],
			foreignColumns: [tags.id],
			name: "product_tags_tag_id_tags_id_fk"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.productId, table.tagId], name: "product_tags_product_id_tag_id_pk"}),
]);

export const userRoles = pgTable("user_roles", {
	userId: uuid("user_id").notNull(),
	roleId: uuid("role_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.roleId],
			foreignColumns: [roles.id],
			name: "user_roles_role_id_roles_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_roles_user_id_users_id_fk"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.roleId, table.userId], name: "user_roles_user_id_role_id_pk"}),
]);

export const productCategories = pgTable("product_categories", {
	productId: uuid("product_id").notNull(),
	categoryId: uuid("category_id").notNull(),
	isPrimary: boolean("is_primary").default(false).notNull(),
}, (table) => [
	index("product_categories_category_idx").using("btree", table.categoryId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [categories.id],
			name: "product_categories_category_id_categories_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "product_categories_product_id_products_id_fk"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.categoryId, table.productId], name: "product_categories_product_id_category_id_pk"}),
]);

export const idempotencyKeys = pgTable("idempotency_keys", {
	key: text().primaryKey().notNull(),
	value: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
})

export const verifications = pgTable("verifications", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	identifier: text().notNull(),
	value: text().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("verifications_identifier_idx").using("btree", table.identifier.asc().nullsLast().op("text_ops")),
]);

export const providerCapabilities = pgTable("provider_capabilities", {
	providerId: uuid("provider_id").notNull(),
	capability: text().notNull(),
	enabled: boolean().default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.providerId],
			foreignColumns: [providers.id],
			name: "provider_capabilities_provider_id_providers_id_fk"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.capability, table.providerId], name: "provider_capabilities_provider_id_capability_pk"}),
]);

/** Cupons e campanhas de desconto. A API de afiliados da Shopee não expõe cupons: entram à mão ou de `shopeeOfferV2`. */
export const coupons = pgTable("coupons", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	title: text().notNull(),
	code: text(),
	description: text(),
	discountLabel: text("discount_label"),
	minSpend: numeric("min_spend", { precision: 12, scale: 2 }),
	url: text().notNull(),
	imageUrl: text("image_url"),
	/** `manual` (cadastrado pela equipe) ou `shopee_campaign` (vem de shopeeOfferV2). */
	source: text().default('manual').notNull(),
	externalId: text("external_id"),
	isActive: boolean("is_active").default(true).notNull(),
	startsAt: timestamp("starts_at", { withTimezone: true, mode: 'string' }),
	endsAt: timestamp("ends_at", { withTimezone: true, mode: 'string' }),
	lastSyncedAt: timestamp("last_synced_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("coupons_active_idx").using("btree", table.isActive.asc().nullsLast().op("bool_ops"), table.endsAt.asc().nullsLast().op("timestamptz_ops")),
	unique("coupons_source_external_unique").on(table.source, table.externalId),
]);

/** Faixas editoriais exibidas na home, com janela de exibição. */
export const campaigns = pgTable("campaigns", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	slug: text().notNull(),
	title: text().notNull(),
	headline: text().notNull(),
	description: text(),
	ctaLabel: text("cta_label").default('Ver agora').notNull(),
	ctaUrl: text("cta_url").notNull(),
	imageUrl: text("image_url"),
	status: text().default('draft').notNull(),
	startsAt: timestamp("starts_at", { withTimezone: true, mode: 'string' }),
	endsAt: timestamp("ends_at", { withTimezone: true, mode: 'string' }),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("campaigns_slug_unique").on(table.slug),
]);

/** Artigos (`/artigos/...`) e páginas institucionais (`/p/...`) editados pelo painel. */
export const contentPages = pgTable("content_pages", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	kind: text().default('article').notNull(),
	slug: text().notNull(),
	title: text().notNull(),
	summary: text(),
	body: text().default('').notNull(),
	status: text().default('draft').notNull(),
	seoTitle: text("seo_title"),
	seoDescription: text("seo_description"),
	coverImageUrl: text("cover_image_url"),
	authorId: uuid("author_id"),
	publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("content_pages_kind_slug_unique").on(table.kind, table.slug),
	index("content_pages_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops"), table.publishedAt.desc().nullsLast().op("timestamptz_ops")),
]);

/** Coleções montadas à mão: lista ordenada de produtos (uuid). */
export const curatedCollections = pgTable("curated_collections", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	slug: text().notNull(),
	title: text().notNull(),
	tone: text().default('Selecionados pela nossa equipe').notNull(),
	description: text().default('').notNull(),
	status: text().default('draft').notNull(),
	productIds: jsonb("product_ids").default([]).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("curated_collections_slug_unique").on(table.slug),
]);

/** Audiências salvas, com regras sobre `analytics_events` (o alcance é calculado na hora). */
export const segments = pgTable("segments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	match: text().default('all').notNull(),
	rules: jsonb().default([]).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

/** Convite para a equipe: a pessoa cria a conta (ou entra) e aceita; o papel é concedido ao aceitar. O token só existe em hash. */
export const adminInvites = pgTable("admin_invites", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: text().notNull(),
	roleId: uuid("role_id").notNull(),
	tokenHash: text("token_hash").notNull(),
	invitedBy: uuid("invited_by"),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: 'string' }),
	acceptedUserId: uuid("accepted_user_id"),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("admin_invites_email_idx").using("btree", table.email.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.roleId],
			foreignColumns: [roles.id],
			name: "admin_invites_role_id_roles_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.invitedBy],
			foreignColumns: [users.id],
			name: "admin_invites_invited_by_users_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.acceptedUserId],
			foreignColumns: [users.id],
			name: "admin_invites_accepted_user_id_users_id_fk"
		}).onDelete("set null"),
	unique("admin_invites_token_hash_unique").on(table.tokenHash),
]);

/**
 * Páginas montadas por seções e blocos no editor visual do painel. Uma linha por página (`key`, hoje só `home`).
 * `draft` é o que a equipe edita; `published` é o que o site mostra; `history` guarda as últimas publicações.
 * Sem linha (ou sem `published`), o site usa o documento padrão derivado das configurações da home.
 */
export const siteDocuments = pgTable("site_documents", {
	key: text().primaryKey().notNull(),
	draft: jsonb(),
	published: jsonb(),
	history: jsonb().default([]).notNull(),
	draftUpdatedAt: timestamp("draft_updated_at", { withTimezone: true, mode: 'string' }),
	publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }),
	updatedBy: uuid("updated_by"),
}, (table) => [
	foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [users.id],
			name: "site_documents_updated_by_users_id_fk"
		}).onDelete("set null"),
]);
