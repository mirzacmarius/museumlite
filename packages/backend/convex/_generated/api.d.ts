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
import type * as batchOperations from "../batchOperations.js";
import type * as collectionGroups from "../collectionGroups.js";
import type * as collections from "../collections.js";
import type * as conditionOptions from "../conditionOptions.js";
import type * as conservationTreatments from "../conservationTreatments.js";
import type * as contacts from "../contacts.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as deaccessions from "../deaccessions.js";
import type * as donors from "../donors.js";
import type * as email_index from "../email/index.js";
import type * as email_templates_subscriptionEmail from "../email/templates/subscriptionEmail.js";
import type * as env from "../env.js";
import type * as exhibitions from "../exhibitions.js";
import type * as fineArtDetails from "../fineArtDetails.js";
import type * as http from "../http.js";
import type * as imports from "../imports.js";
import type * as init from "../init.js";
import type * as installations from "../installations.js";
import type * as insurance from "../insurance.js";
import type * as integrations from "../integrations.js";
import type * as library_acquisitions from "../library/acquisitions.js";
import type * as library_circulation from "../library/circulation.js";
import type * as library_copies from "../library/copies.js";
import type * as library_fines from "../library/fines.js";
import type * as library_holds from "../library/holds.js";
import type * as library_isbnLookup from "../library/isbnLookup.js";
import type * as library_items from "../library/items.js";
import type * as library_reports from "../library/reports.js";
import type * as library_settings from "../library/settings.js";
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
import type * as organizations from "../organizations.js";
import type * as reporting from "../reporting.js";
import type * as roles from "../roles.js";
import type * as savedViews from "../savedViews.js";
import type * as search from "../search.js";
import type * as seedMet from "../seedMet.js";
import type * as seedMetAction from "../seedMetAction.js";
import type * as seedSingleOrg from "../seedSingleOrg.js";
import type * as subscriptions from "../subscriptions.js";
import type * as testHelpers from "../testHelpers.js";
import type * as transit from "../transit.js";
import type * as typeOptions from "../typeOptions.js";
import type * as userPreferences from "../userPreferences.js";
import type * as users from "../users.js";
import type * as utils_accessionCounter from "../utils/accessionCounter.js";
import type * as utils_accessionNumberParser from "../utils/accessionNumberParser.js";
import type * as utils_featureGates from "../utils/featureGates.js";
import type * as utils_permissions from "../utils/permissions.js";
import type * as utils_validators from "../utils/validators.js";
import type * as vehicleDetails from "../vehicleDetails.js";
import type * as web from "../web.js";
import type * as webhooks from "../webhooks.js";
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
  batchOperations: typeof batchOperations;
  collectionGroups: typeof collectionGroups;
  collections: typeof collections;
  conditionOptions: typeof conditionOptions;
  conservationTreatments: typeof conservationTreatments;
  contacts: typeof contacts;
  crons: typeof crons;
  dashboard: typeof dashboard;
  deaccessions: typeof deaccessions;
  donors: typeof donors;
  "email/index": typeof email_index;
  "email/templates/subscriptionEmail": typeof email_templates_subscriptionEmail;
  env: typeof env;
  exhibitions: typeof exhibitions;
  fineArtDetails: typeof fineArtDetails;
  http: typeof http;
  imports: typeof imports;
  init: typeof init;
  installations: typeof installations;
  insurance: typeof insurance;
  integrations: typeof integrations;
  "library/acquisitions": typeof library_acquisitions;
  "library/circulation": typeof library_circulation;
  "library/copies": typeof library_copies;
  "library/fines": typeof library_fines;
  "library/holds": typeof library_holds;
  "library/isbnLookup": typeof library_isbnLookup;
  "library/items": typeof library_items;
  "library/reports": typeof library_reports;
  "library/settings": typeof library_settings;
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
  organizations: typeof organizations;
  reporting: typeof reporting;
  roles: typeof roles;
  savedViews: typeof savedViews;
  search: typeof search;
  seedMet: typeof seedMet;
  seedMetAction: typeof seedMetAction;
  seedSingleOrg: typeof seedSingleOrg;
  subscriptions: typeof subscriptions;
  testHelpers: typeof testHelpers;
  transit: typeof transit;
  typeOptions: typeof typeOptions;
  userPreferences: typeof userPreferences;
  users: typeof users;
  "utils/accessionCounter": typeof utils_accessionCounter;
  "utils/accessionNumberParser": typeof utils_accessionNumberParser;
  "utils/featureGates": typeof utils_featureGates;
  "utils/permissions": typeof utils_permissions;
  "utils/validators": typeof utils_validators;
  vehicleDetails: typeof vehicleDetails;
  web: typeof web;
  webhooks: typeof webhooks;
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
  polar: {
    lib: {
      createProduct: FunctionReference<
        "mutation",
        "internal",
        {
          product: {
            createdAt: string;
            description: string | null;
            id: string;
            isArchived: boolean;
            isRecurring: boolean;
            medias: Array<{
              checksumEtag: string | null;
              checksumSha256Base64: string | null;
              checksumSha256Hex: string | null;
              createdAt: string;
              id: string;
              isUploaded: boolean;
              lastModifiedAt: string | null;
              mimeType: string;
              name: string;
              organizationId: string;
              path: string;
              publicUrl: string;
              service?: string;
              size: number;
              sizeReadable: string;
              storageVersion: string | null;
              version: string | null;
            }>;
            modifiedAt: string | null;
            name: string;
            organizationId: string;
            prices: Array<{
              amountType?: string;
              createdAt: string;
              id: string;
              isArchived: boolean;
              modifiedAt: string | null;
              priceAmount?: number;
              priceCurrency?: string;
              productId: string;
              recurringInterval?: "month" | "year" | null;
              type?: string;
            }>;
            recurringInterval?: "month" | "year" | null;
          };
        },
        any
      >;
      createSubscription: FunctionReference<
        "mutation",
        "internal",
        {
          subscription: {
            amount: number | null;
            cancelAtPeriodEnd: boolean;
            checkoutId: string | null;
            createdAt: string;
            currency: string | null;
            currentPeriodEnd: string | null;
            currentPeriodStart: string;
            customerId: string;
            endedAt: string | null;
            id: string;
            metadata: Record<string, any>;
            modifiedAt: string | null;
            priceId: string;
            productId: string;
            recurringInterval: "month" | "year" | null;
            startedAt: string | null;
            status: string;
          };
        },
        any
      >;
      getCurrentSubscription: FunctionReference<
        "query",
        "internal",
        { userId: string },
        {
          amount: number | null;
          cancelAtPeriodEnd: boolean;
          checkoutId: string | null;
          createdAt: string;
          currency: string | null;
          currentPeriodEnd: string | null;
          currentPeriodStart: string;
          customerId: string;
          endedAt: string | null;
          id: string;
          metadata: Record<string, any>;
          modifiedAt: string | null;
          priceId: string;
          product: {
            createdAt: string;
            description: string | null;
            id: string;
            isArchived: boolean;
            isRecurring: boolean;
            medias: Array<{
              checksumEtag: string | null;
              checksumSha256Base64: string | null;
              checksumSha256Hex: string | null;
              createdAt: string;
              id: string;
              isUploaded: boolean;
              lastModifiedAt: string | null;
              mimeType: string;
              name: string;
              organizationId: string;
              path: string;
              publicUrl: string;
              service?: string;
              size: number;
              sizeReadable: string;
              storageVersion: string | null;
              version: string | null;
            }>;
            modifiedAt: string | null;
            name: string;
            organizationId: string;
            prices: Array<{
              amountType?: string;
              createdAt: string;
              id: string;
              isArchived: boolean;
              modifiedAt: string | null;
              priceAmount?: number;
              priceCurrency?: string;
              productId: string;
              recurringInterval?: "month" | "year" | null;
              type?: string;
            }>;
            recurringInterval?: "month" | "year" | null;
          };
          productId: string;
          recurringInterval: "month" | "year" | null;
          startedAt: string | null;
          status: string;
        } | null
      >;
      getCustomerByUserId: FunctionReference<
        "query",
        "internal",
        { userId: string },
        { id: string; userId: string } | null
      >;
      getProduct: FunctionReference<
        "query",
        "internal",
        { id: string },
        {
          createdAt: string;
          description: string | null;
          id: string;
          isArchived: boolean;
          isRecurring: boolean;
          medias: Array<{
            checksumEtag: string | null;
            checksumSha256Base64: string | null;
            checksumSha256Hex: string | null;
            createdAt: string;
            id: string;
            isUploaded: boolean;
            lastModifiedAt: string | null;
            mimeType: string;
            name: string;
            organizationId: string;
            path: string;
            publicUrl: string;
            service?: string;
            size: number;
            sizeReadable: string;
            storageVersion: string | null;
            version: string | null;
          }>;
          modifiedAt: string | null;
          name: string;
          organizationId: string;
          prices: Array<{
            amountType?: string;
            createdAt: string;
            id: string;
            isArchived: boolean;
            modifiedAt: string | null;
            priceAmount?: number;
            priceCurrency?: string;
            productId: string;
            recurringInterval?: "month" | "year" | null;
            type?: string;
          }>;
          recurringInterval?: "month" | "year" | null;
        } | null
      >;
      getSubscription: FunctionReference<
        "query",
        "internal",
        { id: string },
        {
          amount: number | null;
          cancelAtPeriodEnd: boolean;
          checkoutId: string | null;
          createdAt: string;
          currency: string | null;
          currentPeriodEnd: string | null;
          currentPeriodStart: string;
          customerId: string;
          endedAt: string | null;
          id: string;
          metadata: Record<string, any>;
          modifiedAt: string | null;
          priceId: string;
          productId: string;
          recurringInterval: "month" | "year" | null;
          startedAt: string | null;
          status: string;
        } | null
      >;
      insertCustomer: FunctionReference<
        "mutation",
        "internal",
        { id: string; userId: string },
        string
      >;
      listCustomerSubscriptions: FunctionReference<
        "query",
        "internal",
        { customerId: string },
        Array<{
          amount: number | null;
          cancelAtPeriodEnd: boolean;
          checkoutId: string | null;
          createdAt: string;
          currency: string | null;
          currentPeriodEnd: string | null;
          currentPeriodStart: string;
          customerId: string;
          endedAt: string | null;
          id: string;
          metadata: Record<string, any>;
          modifiedAt: string | null;
          priceId: string;
          productId: string;
          recurringInterval: "month" | "year" | null;
          startedAt: string | null;
          status: string;
        }>
      >;
      listProducts: FunctionReference<
        "query",
        "internal",
        { includeArchived?: boolean },
        Array<{
          createdAt: string;
          description: string | null;
          id: string;
          isArchived: boolean;
          isRecurring: boolean;
          medias: Array<{
            checksumEtag: string | null;
            checksumSha256Base64: string | null;
            checksumSha256Hex: string | null;
            createdAt: string;
            id: string;
            isUploaded: boolean;
            lastModifiedAt: string | null;
            mimeType: string;
            name: string;
            organizationId: string;
            path: string;
            publicUrl: string;
            service?: string;
            size: number;
            sizeReadable: string;
            storageVersion: string | null;
            version: string | null;
          }>;
          modifiedAt: string | null;
          name: string;
          organizationId: string;
          priceAmount?: number;
          prices: Array<{
            amountType?: string;
            createdAt: string;
            id: string;
            isArchived: boolean;
            modifiedAt: string | null;
            priceAmount?: number;
            priceCurrency?: string;
            productId: string;
            recurringInterval?: "month" | "year" | null;
            type?: string;
          }>;
          recurringInterval?: "month" | "year" | null;
        }>
      >;
      listUserSubscriptions: FunctionReference<
        "query",
        "internal",
        { userId: string },
        Array<{
          amount: number | null;
          cancelAtPeriodEnd: boolean;
          checkoutId: string | null;
          createdAt: string;
          currency: string | null;
          currentPeriodEnd: string | null;
          currentPeriodStart: string;
          customerId: string;
          endedAt: string | null;
          id: string;
          metadata: Record<string, any>;
          modifiedAt: string | null;
          priceId: string;
          product: {
            createdAt: string;
            description: string | null;
            id: string;
            isArchived: boolean;
            isRecurring: boolean;
            medias: Array<{
              checksumEtag: string | null;
              checksumSha256Base64: string | null;
              checksumSha256Hex: string | null;
              createdAt: string;
              id: string;
              isUploaded: boolean;
              lastModifiedAt: string | null;
              mimeType: string;
              name: string;
              organizationId: string;
              path: string;
              publicUrl: string;
              service?: string;
              size: number;
              sizeReadable: string;
              storageVersion: string | null;
              version: string | null;
            }>;
            modifiedAt: string | null;
            name: string;
            organizationId: string;
            prices: Array<{
              amountType?: string;
              createdAt: string;
              id: string;
              isArchived: boolean;
              modifiedAt: string | null;
              priceAmount?: number;
              priceCurrency?: string;
              productId: string;
              recurringInterval?: "month" | "year" | null;
              type?: string;
            }>;
            recurringInterval?: "month" | "year" | null;
          } | null;
          productId: string;
          recurringInterval: "month" | "year" | null;
          startedAt: string | null;
          status: string;
        }>
      >;
      updateProduct: FunctionReference<
        "mutation",
        "internal",
        {
          product: {
            createdAt: string;
            description: string | null;
            id: string;
            isArchived: boolean;
            isRecurring: boolean;
            medias: Array<{
              checksumEtag: string | null;
              checksumSha256Base64: string | null;
              checksumSha256Hex: string | null;
              createdAt: string;
              id: string;
              isUploaded: boolean;
              lastModifiedAt: string | null;
              mimeType: string;
              name: string;
              organizationId: string;
              path: string;
              publicUrl: string;
              service?: string;
              size: number;
              sizeReadable: string;
              storageVersion: string | null;
              version: string | null;
            }>;
            modifiedAt: string | null;
            name: string;
            organizationId: string;
            prices: Array<{
              amountType?: string;
              createdAt: string;
              id: string;
              isArchived: boolean;
              modifiedAt: string | null;
              priceAmount?: number;
              priceCurrency?: string;
              productId: string;
              recurringInterval?: "month" | "year" | null;
              type?: string;
            }>;
            recurringInterval?: "month" | "year" | null;
          };
        },
        any
      >;
      updateSubscription: FunctionReference<
        "mutation",
        "internal",
        {
          subscription: {
            amount: number | null;
            cancelAtPeriodEnd: boolean;
            checkoutId: string | null;
            createdAt: string;
            currency: string | null;
            currentPeriodEnd: string | null;
            currentPeriodStart: string;
            customerId: string;
            endedAt: string | null;
            id: string;
            metadata: Record<string, any>;
            modifiedAt: string | null;
            priceId: string;
            productId: string;
            recurringInterval: "month" | "year" | null;
            startedAt: string | null;
            status: string;
          };
        },
        any
      >;
      upsertCustomer: FunctionReference<
        "mutation",
        "internal",
        { customerId: string; userId: string },
        string
      >;
    };
  };
};
