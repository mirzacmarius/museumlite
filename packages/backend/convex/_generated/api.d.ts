/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accessionTemplates from "../accessionTemplates.js";
import type * as accessions from "../accessions.js";
import type * as accountDocuments from "../accountDocuments.js";
import type * as accountRelationships from "../accountRelationships.js";
import type * as accountSegments from "../accountSegments.js";
import type * as accounts from "../accounts.js";
import type * as apiKeys from "../apiKeys.js";
import type * as appraisals from "../appraisals.js";
import type * as archiveDetails from "../archiveDetails.js";
import type * as assignments from "../assignments.js";
import type * as audit from "../audit.js";
import type * as auditLog from "../auditLog.js";
import type * as auth from "../auth.js";
import type * as authLookup from "../authLookup.js";
import type * as batchOperations from "../batchOperations.js";
import type * as coinsStampsDetails from "../coinsStampsDetails.js";
import type * as collectionGroups from "../collectionGroups.js";
import type * as collections from "../collections.js";
import type * as conditionOptions from "../conditionOptions.js";
import type * as conservationTreatments from "../conservationTreatments.js";
import type * as contacts from "../contacts.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as deaccessions from "../deaccessions.js";
import type * as donors from "../donors.js";
import type * as email_actions from "../email/actions.js";
import type * as email_index from "../email/index.js";
import type * as email_senders from "../email/senders.js";
import type * as email_styles from "../email/styles.js";
import type * as env from "../env.js";
import type * as exhibitions from "../exhibitions.js";
import type * as fineArtDetails from "../fineArtDetails.js";
import type * as http from "../http.js";
import type * as importValidation from "../importValidation.js";
import type * as imports from "../imports.js";
import type * as init from "../init.js";
import type * as installations from "../installations.js";
import type * as insurance from "../insurance.js";
import type * as integrations from "../integrations.js";
import type * as invitations from "../invitations.js";
import type * as library_acquisitions from "../library/acquisitions.js";
import type * as library_circulation from "../library/circulation.js";
import type * as library_copies from "../library/copies.js";
import type * as library_fines from "../library/fines.js";
import type * as library_holds from "../library/holds.js";
import type * as library_isbnLookup from "../library/isbnLookup.js";
import type * as library_items from "../library/items.js";
import type * as library_reports from "../library/reports.js";
import type * as library_settings from "../library/settings.js";
import type * as library_utils_circulationRules from "../library/utils/circulationRules.js";
import type * as library_utils_permissions from "../library/utils/permissions.js";
import type * as library_utils_tenantIntegrity from "../library/utils/tenantIntegrity.js";
import type * as library_vendors from "../library/vendors.js";
import type * as loans from "../loans.js";
import type * as locations from "../locations.js";
import type * as materialOptions from "../materialOptions.js";
import type * as media from "../media.js";
import type * as mediaEdits from "../mediaEdits.js";
import type * as mediaImports from "../mediaImports.js";
import type * as mediaThumbnails from "../mediaThumbnails.js";
import type * as mediaVersions from "../mediaVersions.js";
import type * as migrations from "../migrations.js";
import type * as naturalHistoryDetails from "../naturalHistoryDetails.js";
import type * as notifications from "../notifications.js";
import type * as objectComments from "../objectComments.js";
import type * as objectMoves from "../objectMoves.js";
import type * as onboardingAi from "../onboardingAi.js";
import type * as onboardingAiMutations from "../onboardingAiMutations.js";
import type * as organizationCleanup from "../organizationCleanup.js";
import type * as organizationDeletion from "../organizationDeletion.js";
import type * as organizationOwnershipTransfer from "../organizationOwnershipTransfer.js";
import type * as organizationUsage from "../organizationUsage.js";
import type * as organizations from "../organizations.js";
import type * as otp_ResendOTP from "../otp/ResendOTP.js";
import type * as passwordReset_ResendOTPPasswordReset from "../passwordReset/ResendOTPPasswordReset.js";
import type * as qrCodes from "../qrCodes.js";
import type * as reporting from "../reporting.js";
import type * as roles from "../roles.js";
import type * as savedViews from "../savedViews.js";
import type * as search from "../search.js";
import type * as searchHistory from "../searchHistory.js";
import type * as seedMet from "../seedMet.js";
import type * as seedMetAction from "../seedMetAction.js";
import type * as seedSingleOrg from "../seedSingleOrg.js";
import type * as sites from "../sites.js";
import type * as subscriptions from "../subscriptions.js";
import type * as testHelpers from "../testHelpers.js";
import type * as transit from "../transit.js";
import type * as typeOptions from "../typeOptions.js";
import type * as userPreferences from "../userPreferences.js";
import type * as users from "../users.js";
import type * as usersMutations from "../usersMutations.js";
import type * as utils_accessionCounter from "../utils/accessionCounter.js";
import type * as utils_accessionNumberParser from "../utils/accessionNumberParser.js";
import type * as utils_accessionObjectDraftPublication from "../utils/accessionObjectDraftPublication.js";
import type * as utils_accountAdministration from "../utils/accountAdministration.js";
import type * as utils_accountProfile from "../utils/accountProfile.js";
import type * as utils_authorizationContext from "../utils/authorizationContext.js";
import type * as utils_batchLookup from "../utils/batchLookup.js";
import type * as utils_collectionDetailLifecycle from "../utils/collectionDetailLifecycle.js";
import type * as utils_collectionDisplayHelpers from "../utils/collectionDisplayHelpers.js";
import type * as utils_collectionDisposition from "../utils/collectionDisposition.js";
import type * as utils_collectionLifecycle from "../utils/collectionLifecycle.js";
import type * as utils_collectionListHelpers from "../utils/collectionListHelpers.js";
import type * as utils_collectionOptionUsages from "../utils/collectionOptionUsages.js";
import type * as utils_convexAuth from "../utils/convexAuth.js";
import type * as utils_customerNumber from "../utils/customerNumber.js";
import type * as utils_dashboardAnalytics from "../utils/dashboardAnalytics.js";
import type * as utils_dublinCore from "../utils/dublinCore.js";
import type * as utils_exhibitionAccess from "../utils/exhibitionAccess.js";
import type * as utils_exhibitionContext from "../utils/exhibitionContext.js";
import type * as utils_exhibitionCrud from "../utils/exhibitionCrud.js";
import type * as utils_exhibitionDocuments from "../utils/exhibitionDocuments.js";
import type * as utils_exhibitionInstallation from "../utils/exhibitionInstallation.js";
import type * as utils_exhibitionObjectLocation from "../utils/exhibitionObjectLocation.js";
import type * as utils_exhibitionWorkflow from "../utils/exhibitionWorkflow.js";
import type * as utils_featureGates from "../utils/featureGates.js";
import type * as utils_featurePolicy from "../utils/featurePolicy.js";
import type * as utils_formatConverters from "../utils/formatConverters.js";
import type * as utils_importRows from "../utils/importRows.js";
import type * as utils_indexedCounts from "../utils/indexedCounts.js";
import type * as utils_insuranceCoverageAlerts from "../utils/insuranceCoverageAlerts.js";
import type * as utils_insuranceStats from "../utils/insuranceStats.js";
import type * as utils_legacyTemplates from "../utils/legacyTemplates.js";
import type * as utils_loanAccess from "../utils/loanAccess.js";
import type * as utils_loanDocuments from "../utils/loanDocuments.js";
import type * as utils_loanExtensions from "../utils/loanExtensions.js";
import type * as utils_loanLifecycle from "../utils/loanLifecycle.js";
import type * as utils_loanMovement from "../utils/loanMovement.js";
import type * as utils_loanOccupancy from "../utils/loanOccupancy.js";
import type * as utils_loanStatusTransitions from "../utils/loanStatusTransitions.js";
import type * as utils_loanWorkflow from "../utils/loanWorkflow.js";
import type * as utils_mediaAssets from "../utils/mediaAssets.js";
import type * as utils_moduleCatalog from "../utils/moduleCatalog.js";
import type * as utils_moduleValidators from "../utils/moduleValidators.js";
import type * as utils_notificationRecipients from "../utils/notificationRecipients.js";
import type * as utils_numberGenerator from "../utils/numberGenerator.js";
import type * as utils_objectDraftData from "../utils/objectDraftData.js";
import type * as utils_onboardingCollectionSuggestions from "../utils/onboardingCollectionSuggestions.js";
import type * as utils_operationalKpis from "../utils/operationalKpis.js";
import type * as utils_organizationAudit from "../utils/organizationAudit.js";
import type * as utils_organizationDeletionTimings from "../utils/organizationDeletionTimings.js";
import type * as utils_organizationTransferRegistry from "../utils/organizationTransferRegistry.js";
import type * as utils_organizationUsageCounters from "../utils/organizationUsageCounters.js";
import type * as utils_permissions from "../utils/permissions.js";
import type * as utils_polarBilling from "../utils/polarBilling.js";
import type * as utils_polarComponentSync from "../utils/polarComponentSync.js";
import type * as utils_publicPortal from "../utils/publicPortal.js";
import type * as utils_reportingCatalogAnalytics from "../utils/reportingCatalogAnalytics.js";
import type * as utils_spectrum from "../utils/spectrum.js";
import type * as utils_storageUsage from "../utils/storageUsage.js";
import type * as utils_superAdmins from "../utils/superAdmins.js";
import type * as utils_systemRoles from "../utils/systemRoles.js";
import type * as utils_validators from "../utils/validators.js";
import type * as utils_verificationCode from "../utils/verificationCode.js";
import type * as utils_webhookEvents from "../utils/webhookEvents.js";
import type * as utils_workflowConfigs from "../utils/workflowConfigs.js";
import type * as utils_workflowExecution from "../utils/workflowExecution.js";
import type * as utils_workflowSteps from "../utils/workflowSteps.js";
import type * as vehicleDetails from "../vehicleDetails.js";
import type * as web from "../web.js";
import type * as webhooks from "../webhooks.js";
import type * as webhooksActions from "../webhooksActions.js";
import type * as wineDetails from "../wineDetails.js";
import type * as workflowSla from "../workflowSla.js";
import type * as workflows from "../workflows.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accessionTemplates: typeof accessionTemplates;
  accessions: typeof accessions;
  accountDocuments: typeof accountDocuments;
  accountRelationships: typeof accountRelationships;
  accountSegments: typeof accountSegments;
  accounts: typeof accounts;
  apiKeys: typeof apiKeys;
  appraisals: typeof appraisals;
  archiveDetails: typeof archiveDetails;
  assignments: typeof assignments;
  audit: typeof audit;
  auditLog: typeof auditLog;
  auth: typeof auth;
  authLookup: typeof authLookup;
  batchOperations: typeof batchOperations;
  coinsStampsDetails: typeof coinsStampsDetails;
  collectionGroups: typeof collectionGroups;
  collections: typeof collections;
  conditionOptions: typeof conditionOptions;
  conservationTreatments: typeof conservationTreatments;
  contacts: typeof contacts;
  crons: typeof crons;
  dashboard: typeof dashboard;
  deaccessions: typeof deaccessions;
  donors: typeof donors;
  "email/actions": typeof email_actions;
  "email/index": typeof email_index;
  "email/senders": typeof email_senders;
  "email/styles": typeof email_styles;
  env: typeof env;
  exhibitions: typeof exhibitions;
  fineArtDetails: typeof fineArtDetails;
  http: typeof http;
  importValidation: typeof importValidation;
  imports: typeof imports;
  init: typeof init;
  installations: typeof installations;
  insurance: typeof insurance;
  integrations: typeof integrations;
  invitations: typeof invitations;
  "library/acquisitions": typeof library_acquisitions;
  "library/circulation": typeof library_circulation;
  "library/copies": typeof library_copies;
  "library/fines": typeof library_fines;
  "library/holds": typeof library_holds;
  "library/isbnLookup": typeof library_isbnLookup;
  "library/items": typeof library_items;
  "library/reports": typeof library_reports;
  "library/settings": typeof library_settings;
  "library/utils/circulationRules": typeof library_utils_circulationRules;
  "library/utils/permissions": typeof library_utils_permissions;
  "library/utils/tenantIntegrity": typeof library_utils_tenantIntegrity;
  "library/vendors": typeof library_vendors;
  loans: typeof loans;
  locations: typeof locations;
  materialOptions: typeof materialOptions;
  media: typeof media;
  mediaEdits: typeof mediaEdits;
  mediaImports: typeof mediaImports;
  mediaThumbnails: typeof mediaThumbnails;
  mediaVersions: typeof mediaVersions;
  migrations: typeof migrations;
  naturalHistoryDetails: typeof naturalHistoryDetails;
  notifications: typeof notifications;
  objectComments: typeof objectComments;
  objectMoves: typeof objectMoves;
  onboardingAi: typeof onboardingAi;
  onboardingAiMutations: typeof onboardingAiMutations;
  organizationCleanup: typeof organizationCleanup;
  organizationDeletion: typeof organizationDeletion;
  organizationOwnershipTransfer: typeof organizationOwnershipTransfer;
  organizationUsage: typeof organizationUsage;
  organizations: typeof organizations;
  "otp/ResendOTP": typeof otp_ResendOTP;
  "passwordReset/ResendOTPPasswordReset": typeof passwordReset_ResendOTPPasswordReset;
  qrCodes: typeof qrCodes;
  reporting: typeof reporting;
  roles: typeof roles;
  savedViews: typeof savedViews;
  search: typeof search;
  searchHistory: typeof searchHistory;
  seedMet: typeof seedMet;
  seedMetAction: typeof seedMetAction;
  seedSingleOrg: typeof seedSingleOrg;
  sites: typeof sites;
  subscriptions: typeof subscriptions;
  testHelpers: typeof testHelpers;
  transit: typeof transit;
  typeOptions: typeof typeOptions;
  userPreferences: typeof userPreferences;
  users: typeof users;
  usersMutations: typeof usersMutations;
  "utils/accessionCounter": typeof utils_accessionCounter;
  "utils/accessionNumberParser": typeof utils_accessionNumberParser;
  "utils/accessionObjectDraftPublication": typeof utils_accessionObjectDraftPublication;
  "utils/accountAdministration": typeof utils_accountAdministration;
  "utils/accountProfile": typeof utils_accountProfile;
  "utils/authorizationContext": typeof utils_authorizationContext;
  "utils/batchLookup": typeof utils_batchLookup;
  "utils/collectionDetailLifecycle": typeof utils_collectionDetailLifecycle;
  "utils/collectionDisplayHelpers": typeof utils_collectionDisplayHelpers;
  "utils/collectionDisposition": typeof utils_collectionDisposition;
  "utils/collectionLifecycle": typeof utils_collectionLifecycle;
  "utils/collectionListHelpers": typeof utils_collectionListHelpers;
  "utils/collectionOptionUsages": typeof utils_collectionOptionUsages;
  "utils/convexAuth": typeof utils_convexAuth;
  "utils/customerNumber": typeof utils_customerNumber;
  "utils/dashboardAnalytics": typeof utils_dashboardAnalytics;
  "utils/dublinCore": typeof utils_dublinCore;
  "utils/exhibitionAccess": typeof utils_exhibitionAccess;
  "utils/exhibitionContext": typeof utils_exhibitionContext;
  "utils/exhibitionCrud": typeof utils_exhibitionCrud;
  "utils/exhibitionDocuments": typeof utils_exhibitionDocuments;
  "utils/exhibitionInstallation": typeof utils_exhibitionInstallation;
  "utils/exhibitionObjectLocation": typeof utils_exhibitionObjectLocation;
  "utils/exhibitionWorkflow": typeof utils_exhibitionWorkflow;
  "utils/featureGates": typeof utils_featureGates;
  "utils/featurePolicy": typeof utils_featurePolicy;
  "utils/formatConverters": typeof utils_formatConverters;
  "utils/importRows": typeof utils_importRows;
  "utils/indexedCounts": typeof utils_indexedCounts;
  "utils/insuranceCoverageAlerts": typeof utils_insuranceCoverageAlerts;
  "utils/insuranceStats": typeof utils_insuranceStats;
  "utils/legacyTemplates": typeof utils_legacyTemplates;
  "utils/loanAccess": typeof utils_loanAccess;
  "utils/loanDocuments": typeof utils_loanDocuments;
  "utils/loanExtensions": typeof utils_loanExtensions;
  "utils/loanLifecycle": typeof utils_loanLifecycle;
  "utils/loanMovement": typeof utils_loanMovement;
  "utils/loanOccupancy": typeof utils_loanOccupancy;
  "utils/loanStatusTransitions": typeof utils_loanStatusTransitions;
  "utils/loanWorkflow": typeof utils_loanWorkflow;
  "utils/mediaAssets": typeof utils_mediaAssets;
  "utils/moduleCatalog": typeof utils_moduleCatalog;
  "utils/moduleValidators": typeof utils_moduleValidators;
  "utils/notificationRecipients": typeof utils_notificationRecipients;
  "utils/numberGenerator": typeof utils_numberGenerator;
  "utils/objectDraftData": typeof utils_objectDraftData;
  "utils/onboardingCollectionSuggestions": typeof utils_onboardingCollectionSuggestions;
  "utils/operationalKpis": typeof utils_operationalKpis;
  "utils/organizationAudit": typeof utils_organizationAudit;
  "utils/organizationDeletionTimings": typeof utils_organizationDeletionTimings;
  "utils/organizationTransferRegistry": typeof utils_organizationTransferRegistry;
  "utils/organizationUsageCounters": typeof utils_organizationUsageCounters;
  "utils/permissions": typeof utils_permissions;
  "utils/polarBilling": typeof utils_polarBilling;
  "utils/polarComponentSync": typeof utils_polarComponentSync;
  "utils/publicPortal": typeof utils_publicPortal;
  "utils/reportingCatalogAnalytics": typeof utils_reportingCatalogAnalytics;
  "utils/spectrum": typeof utils_spectrum;
  "utils/storageUsage": typeof utils_storageUsage;
  "utils/superAdmins": typeof utils_superAdmins;
  "utils/systemRoles": typeof utils_systemRoles;
  "utils/validators": typeof utils_validators;
  "utils/verificationCode": typeof utils_verificationCode;
  "utils/webhookEvents": typeof utils_webhookEvents;
  "utils/workflowConfigs": typeof utils_workflowConfigs;
  "utils/workflowExecution": typeof utils_workflowExecution;
  "utils/workflowSteps": typeof utils_workflowSteps;
  vehicleDetails: typeof vehicleDetails;
  web: typeof web;
  webhooks: typeof webhooks;
  webhooksActions: typeof webhooksActions;
  wineDetails: typeof wineDetails;
  workflowSla: typeof workflowSla;
  workflows: typeof workflows;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  polar: import("@convex-dev/polar/_generated/component.js").ComponentApi<"polar">;
};
