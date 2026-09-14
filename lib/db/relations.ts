import { relations } from "drizzle-orm/relations";
import { brands, products, productAttributes, productAttributeValues, productImages, productVariants, providers, providerAccounts, offers, offerAvailability, offerCommissions, offerPrices, priceHistory, providerProductMappings, affiliateLinks, affiliateClicks, users, affiliatePrograms, affiliateConversions, commissionTransactions, accounts, anonymousIdentities, identityMerges, sessions, wishlists, wishlistItems, auditLogs, syncJobs, syncJobRuns, syncErrors, consentRecords, privacyPreferences, privacyRequests, productTags, tags, roles, userRoles, categories, productCategories, providerCapabilities } from "./schema";

export const productsRelations = relations(products, ({one, many}) => ({
	brand: one(brands, {
		fields: [products.brandId],
		references: [brands.id]
	}),
	productAttributeValues: many(productAttributeValues),
	productImages: many(productImages),
	productVariants: many(productVariants),
	offers: many(offers),
	providerProductMappings: many(providerProductMappings),
	wishlistItems: many(wishlistItems),
	productTags: many(productTags),
	productCategories: many(productCategories),
}));

export const brandsRelations = relations(brands, ({many}) => ({
	products: many(products),
}));

export const productAttributeValuesRelations = relations(productAttributeValues, ({one}) => ({
	productAttribute: one(productAttributes, {
		fields: [productAttributeValues.attributeId],
		references: [productAttributes.id]
	}),
	product: one(products, {
		fields: [productAttributeValues.productId],
		references: [products.id]
	}),
}));

export const productAttributesRelations = relations(productAttributes, ({many}) => ({
	productAttributeValues: many(productAttributeValues),
}));

export const productImagesRelations = relations(productImages, ({one}) => ({
	product: one(products, {
		fields: [productImages.productId],
		references: [products.id]
	}),
}));

export const productVariantsRelations = relations(productVariants, ({one}) => ({
	product: one(products, {
		fields: [productVariants.productId],
		references: [products.id]
	}),
}));

export const providerAccountsRelations = relations(providerAccounts, ({one}) => ({
	provider: one(providers, {
		fields: [providerAccounts.providerId],
		references: [providers.id]
	}),
}));

export const providersRelations = relations(providers, ({many}) => ({
	providerAccounts: many(providerAccounts),
	offers: many(offers),
	providerProductMappings: many(providerProductMappings),
	affiliateConversions: many(affiliateConversions),
	affiliatePrograms: many(affiliatePrograms),
	syncJobs: many(syncJobs),
	providerCapabilities: many(providerCapabilities),
}));

export const offersRelations = relations(offers, ({one, many}) => ({
	product: one(products, {
		fields: [offers.productId],
		references: [products.id]
	}),
	provider: one(providers, {
		fields: [offers.providerId],
		references: [providers.id]
	}),
	offerAvailabilities: many(offerAvailability),
	offerCommissions: many(offerCommissions),
	offerPrices: many(offerPrices),
	priceHistories: many(priceHistory),
	providerProductMappings: many(providerProductMappings),
	affiliateClicks: many(affiliateClicks),
	affiliateLinks: many(affiliateLinks),
}));

export const offerAvailabilityRelations = relations(offerAvailability, ({one}) => ({
	offer: one(offers, {
		fields: [offerAvailability.offerId],
		references: [offers.id]
	}),
}));

export const offerCommissionsRelations = relations(offerCommissions, ({one}) => ({
	offer: one(offers, {
		fields: [offerCommissions.offerId],
		references: [offers.id]
	}),
}));

export const offerPricesRelations = relations(offerPrices, ({one}) => ({
	offer: one(offers, {
		fields: [offerPrices.offerId],
		references: [offers.id]
	}),
}));

export const priceHistoryRelations = relations(priceHistory, ({one}) => ({
	offer: one(offers, {
		fields: [priceHistory.offerId],
		references: [offers.id]
	}),
}));

export const providerProductMappingsRelations = relations(providerProductMappings, ({one}) => ({
	offer: one(offers, {
		fields: [providerProductMappings.offerId],
		references: [offers.id]
	}),
	product: one(products, {
		fields: [providerProductMappings.productId],
		references: [products.id]
	}),
	provider: one(providers, {
		fields: [providerProductMappings.providerId],
		references: [providers.id]
	}),
}));

export const affiliateClicksRelations = relations(affiliateClicks, ({one, many}) => ({
	affiliateLink: one(affiliateLinks, {
		fields: [affiliateClicks.affiliateLinkId],
		references: [affiliateLinks.id]
	}),
	offer: one(offers, {
		fields: [affiliateClicks.offerId],
		references: [offers.id]
	}),
	user: one(users, {
		fields: [affiliateClicks.userId],
		references: [users.id]
	}),
	affiliateConversions: many(affiliateConversions),
}));

export const affiliateLinksRelations = relations(affiliateLinks, ({one, many}) => ({
	affiliateClicks: many(affiliateClicks),
	offer: one(offers, {
		fields: [affiliateLinks.offerId],
		references: [offers.id]
	}),
	affiliateProgram: one(affiliatePrograms, {
		fields: [affiliateLinks.programId],
		references: [affiliatePrograms.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	affiliateClicks: many(affiliateClicks),
	accounts: many(accounts),
	identityMerges: many(identityMerges),
	sessions: many(sessions),
	wishlists: many(wishlists),
	auditLogs: many(auditLogs),
	consentRecords: many(consentRecords),
	privacyPreferences: many(privacyPreferences),
	privacyRequests: many(privacyRequests),
	userRoles: many(userRoles),
}));

export const affiliateProgramsRelations = relations(affiliatePrograms, ({one, many}) => ({
	affiliateLinks: many(affiliateLinks),
	provider: one(providers, {
		fields: [affiliatePrograms.providerId],
		references: [providers.id]
	}),
}));

export const affiliateConversionsRelations = relations(affiliateConversions, ({one, many}) => ({
	affiliateClick: one(affiliateClicks, {
		fields: [affiliateConversions.clickId],
		references: [affiliateClicks.clickId]
	}),
	provider: one(providers, {
		fields: [affiliateConversions.providerId],
		references: [providers.id]
	}),
	commissionTransactions: many(commissionTransactions),
}));

export const commissionTransactionsRelations = relations(commissionTransactions, ({one}) => ({
	affiliateConversion: one(affiliateConversions, {
		fields: [commissionTransactions.conversionId],
		references: [affiliateConversions.id]
	}),
}));

export const accountsRelations = relations(accounts, ({one}) => ({
	user: one(users, {
		fields: [accounts.userId],
		references: [users.id]
	}),
}));

export const identityMergesRelations = relations(identityMerges, ({one}) => ({
	anonymousIdentity: one(anonymousIdentities, {
		fields: [identityMerges.anonymousId],
		references: [anonymousIdentities.id]
	}),
	user: one(users, {
		fields: [identityMerges.userId],
		references: [users.id]
	}),
}));

export const anonymousIdentitiesRelations = relations(anonymousIdentities, ({many}) => ({
	identityMerges: many(identityMerges),
}));

export const sessionsRelations = relations(sessions, ({one}) => ({
	user: one(users, {
		fields: [sessions.userId],
		references: [users.id]
	}),
}));

export const wishlistsRelations = relations(wishlists, ({one, many}) => ({
	user: one(users, {
		fields: [wishlists.userId],
		references: [users.id]
	}),
	wishlistItems: many(wishlistItems),
}));

export const wishlistItemsRelations = relations(wishlistItems, ({one}) => ({
	product: one(products, {
		fields: [wishlistItems.productId],
		references: [products.id]
	}),
	wishlist: one(wishlists, {
		fields: [wishlistItems.wishlistId],
		references: [wishlists.id]
	}),
}));

export const auditLogsRelations = relations(auditLogs, ({one}) => ({
	user: one(users, {
		fields: [auditLogs.actorUserId],
		references: [users.id]
	}),
}));

export const syncJobRunsRelations = relations(syncJobRuns, ({one, many}) => ({
	syncJob: one(syncJobs, {
		fields: [syncJobRuns.syncJobId],
		references: [syncJobs.id]
	}),
	syncErrors: many(syncErrors),
}));

export const syncJobsRelations = relations(syncJobs, ({one, many}) => ({
	syncJobRuns: many(syncJobRuns),
	provider: one(providers, {
		fields: [syncJobs.providerId],
		references: [providers.id]
	}),
}));

export const syncErrorsRelations = relations(syncErrors, ({one}) => ({
	syncJobRun: one(syncJobRuns, {
		fields: [syncErrors.syncJobRunId],
		references: [syncJobRuns.id]
	}),
}));

export const consentRecordsRelations = relations(consentRecords, ({one}) => ({
	user: one(users, {
		fields: [consentRecords.userId],
		references: [users.id]
	}),
}));

export const privacyPreferencesRelations = relations(privacyPreferences, ({one}) => ({
	user: one(users, {
		fields: [privacyPreferences.userId],
		references: [users.id]
	}),
}));

export const privacyRequestsRelations = relations(privacyRequests, ({one}) => ({
	user: one(users, {
		fields: [privacyRequests.userId],
		references: [users.id]
	}),
}));

export const productTagsRelations = relations(productTags, ({one}) => ({
	product: one(products, {
		fields: [productTags.productId],
		references: [products.id]
	}),
	tag: one(tags, {
		fields: [productTags.tagId],
		references: [tags.id]
	}),
}));

export const tagsRelations = relations(tags, ({many}) => ({
	productTags: many(productTags),
}));

export const userRolesRelations = relations(userRoles, ({one}) => ({
	role: one(roles, {
		fields: [userRoles.roleId],
		references: [roles.id]
	}),
	user: one(users, {
		fields: [userRoles.userId],
		references: [users.id]
	}),
}));

export const rolesRelations = relations(roles, ({many}) => ({
	userRoles: many(userRoles),
}));

export const productCategoriesRelations = relations(productCategories, ({one}) => ({
	category: one(categories, {
		fields: [productCategories.categoryId],
		references: [categories.id]
	}),
	product: one(products, {
		fields: [productCategories.productId],
		references: [products.id]
	}),
}));

export const categoriesRelations = relations(categories, ({many}) => ({
	productCategories: many(productCategories),
}));

export const providerCapabilitiesRelations = relations(providerCapabilities, ({one}) => ({
	provider: one(providers, {
		fields: [providerCapabilities.providerId],
		references: [providers.id]
	}),
}));