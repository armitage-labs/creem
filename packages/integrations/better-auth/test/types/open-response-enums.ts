// creem 2.0 passes enum values the API adds later through as strings
// (forward-compatible response enums), and retrieveSubscription and
// searchTransactions return the SDK response as these types. So each field
// fed from an SDK response enum must accept an unknown value, or a caller's
// exhaustive check treats a real value as impossible.
import type {
  SubscriptionData,
  SubscriptionDataStatus,
  SubscriptionItemData,
} from "../../src/retrieve-subscription-types.js";
import type { TransactionData } from "../../src/search-transactions-types.js";

const unknownValue = "added_by_the_api_later" as string;

export const subscriptionStatus: SubscriptionDataStatus = unknownValue;
export const subscriptionMode: SubscriptionData["mode"] = unknownValue;
export const collectionMethod: SubscriptionData["collectionMethod"] = unknownValue;
export const itemMode: SubscriptionItemData["mode"] = unknownValue;
export const transactionMode: TransactionData["mode"] = unknownValue;
export const transactionType: TransactionData["type"] = unknownValue;
export const transactionStatus: TransactionData["status"] = unknownValue;

// The known values keep their literal types.
export const known: SubscriptionDataStatus = "scheduled_cancel";
