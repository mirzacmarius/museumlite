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
import type * as organizationCleanup from "../organizationCleanup.js";
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
import type * as utils_accountProfile from "../utils/accountProfile.js";
import type * as utils_authorizationContext from "../utils/authorizationContext.js";
import type * as utils_batchLookup from "../utils/batchLookup.js";
import type * as utils_collectionLifecycle from "../utils/collectionLifecycle.js";
import type * as utils_dublinCore from "../utils/dublinCore.js";
import type * as utils_featureGates from "../utils/featureGates.js";
import type * as utils_featurePolicy from "../utils/featurePolicy.js";
import type * as utils_formatConverters from "../utils/formatConverters.js";
import type * as utils_importRows from "../utils/importRows.js";
import type * as utils_legacyTemplates from "../utils/legacyTemplates.js";
import type * as utils_mediaAssets from "../utils/mediaAssets.js";
import type * as utils_numberGenerator from "../utils/numberGenerator.js";
import type * as utils_objectDraftData from "../utils/objectDraftData.js";
import type * as utils_organizationUsageCounters from "../utils/organizationUsageCounters.js";
import type * as utils_permissions from "../utils/permissions.js";
import type * as utils_polarBilling from "../utils/polarBilling.js";
import type * as utils_spectrum from "../utils/spectrum.js";
import type * as utils_storageUsage from "../utils/storageUsage.js";
import type * as utils_validators from "../utils/validators.js";
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
  organizationCleanup: typeof organizationCleanup;
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
  "utils/accountProfile": typeof utils_accountProfile;
  "utils/authorizationContext": typeof utils_authorizationContext;
  "utils/batchLookup": typeof utils_batchLookup;
  "utils/collectionLifecycle": typeof utils_collectionLifecycle;
  "utils/dublinCore": typeof utils_dublinCore;
  "utils/featureGates": typeof utils_featureGates;
  "utils/featurePolicy": typeof utils_featurePolicy;
  "utils/formatConverters": typeof utils_formatConverters;
  "utils/importRows": typeof utils_importRows;
  "utils/legacyTemplates": typeof utils_legacyTemplates;
  "utils/mediaAssets": typeof utils_mediaAssets;
  "utils/numberGenerator": typeof utils_numberGenerator;
  "utils/objectDraftData": typeof utils_objectDraftData;
  "utils/organizationUsageCounters": typeof utils_organizationUsageCounters;
  "utils/permissions": typeof utils_permissions;
  "utils/polarBilling": typeof utils_polarBilling;
  "utils/spectrum": typeof utils_spectrum;
  "utils/storageUsage": typeof utils_storageUsage;
  "utils/validators": typeof utils_validators;
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
