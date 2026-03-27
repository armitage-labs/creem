/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    lib: {
      createOrder: FunctionReference<
        "mutation",
        "internal",
        {
          order: {
            affiliate?: string | null;
            amount: number;
            amountDue?: number;
            amountPaid?: number;
            checkoutId?: string | null;
            createdAt: string;
            currency: string;
            customerId: string;
            discountAmount?: number;
            discountId?: string | null;
            id: string;
            metadata?: Record<string, any>;
            mode?: string;
            productId: string;
            status: string;
            subTotal?: number;
            taxAmount?: number;
            transactionId?: string | null;
            type: string;
            updatedAt: string;
          };
        },
        any,
        Name
      >;
      createProduct: FunctionReference<
        "mutation",
        "internal",
        {
          product: {
            billingPeriod?: string;
            billingType: string;
            createdAt: string;
            currency: string;
            defaultSuccessUrl?: string | null;
            description: string | null;
            features?: Array<{ description: string; id: string }>;
            id: string;
            imageUrl?: string;
            metadata?: Record<string, any>;
            mode?: string;
            modifiedAt: string | null;
            name: string;
            price: number;
            productUrl?: string;
            status: string;
            taxCategory?: string;
            taxMode?: string;
          };
        },
        any,
        Name
      >;
      createSubscription: FunctionReference<
        "mutation",
        "internal",
        {
          subscription: {
            amount: number | null;
            cancelAtPeriodEnd: boolean;
            canceledAt?: string | null;
            checkoutId: string | null;
            collectionMethod?: string;
            createdAt: string;
            currency: string | null;
            currentPeriodEnd: string | null;
            currentPeriodStart: string;
            customerId: string;
            discountId?: string | null;
            endedAt: string | null;
            endsAt?: string | null;
            id: string;
            lastTransactionId?: string | null;
            metadata: Record<string, any>;
            mode?: string;
            modifiedAt: string | null;
            nextTransactionDate?: string | null;
            priceId?: string;
            productId: string;
            recurringInterval: string | null;
            seats?: number | null;
            startedAt: string | null;
            status: string;
            trialEnd?: string | null;
            trialStart?: string | null;
          };
        },
        any,
        Name
      >;
      executeSubscriptionLifecycle: FunctionReference<
        "action",
        "internal",
        {
          apiKey: string;
          cancelMode?: string;
          operation: "cancel" | "resume" | "pause";
          previousCancelAtPeriodEnd?: boolean;
          previousStatus?: string;
          serverIdx?: number;
          serverURL?: string;
          subscriptionId: string;
        },
        any,
        Name
      >;
      executeSubscriptionUpdate: FunctionReference<
        "action",
        "internal",
        {
          apiKey: string;
          previousProductId?: string;
          previousSeats?: number | null;
          productId?: string;
          serverIdx?: number;
          serverURL?: string;
          subscriptionId: string;
          units?: number;
          updateBehavior?: string;
        },
        any,
        Name
      >;
      getCurrentSubscription: FunctionReference<
        "query",
        "internal",
        { entityId: string },
        {
          amount: number | null;
          cancelAtPeriodEnd: boolean;
          canceledAt?: string | null;
          checkoutId: string | null;
          collectionMethod?: string;
          createdAt: string;
          currency: string | null;
          currentPeriodEnd: string | null;
          currentPeriodStart: string;
          customerId: string;
          discountId?: string | null;
          endedAt: string | null;
          endsAt?: string | null;
          id: string;
          lastTransactionId?: string | null;
          metadata: Record<string, any>;
          mode?: string;
          modifiedAt: string | null;
          nextTransactionDate?: string | null;
          priceId?: string;
          product: {
            billingPeriod?: string;
            billingType: string;
            createdAt: string;
            currency: string;
            defaultSuccessUrl?: string | null;
            description: string | null;
            features?: Array<{ description: string; id: string }>;
            id: string;
            imageUrl?: string;
            metadata?: Record<string, any>;
            mode?: string;
            modifiedAt: string | null;
            name: string;
            price: number;
            productUrl?: string;
            status: string;
            taxCategory?: string;
            taxMode?: string;
          };
          productId: string;
          recurringInterval: string | null;
          seats?: number | null;
          startedAt: string | null;
          status: string;
          trialEnd?: string | null;
          trialStart?: string | null;
        } | null,
        Name
      >;
      getCustomerByEntityId: FunctionReference<
        "query",
        "internal",
        { entityId: string },
        {
          country?: string;
          createdAt?: string;
          email?: string;
          entityId: string;
          id: string;
          metadata?: Record<string, any>;
          mode?: string;
          name?: string | null;
          updatedAt?: string;
        } | null,
        Name
      >;
      getProduct: FunctionReference<
        "query",
        "internal",
        { id: string },
        {
          billingPeriod?: string;
          billingType: string;
          createdAt: string;
          currency: string;
          defaultSuccessUrl?: string | null;
          description: string | null;
          features?: Array<{ description: string; id: string }>;
          id: string;
          imageUrl?: string;
          metadata?: Record<string, any>;
          mode?: string;
          modifiedAt: string | null;
          name: string;
          price: number;
          productUrl?: string;
          status: string;
          taxCategory?: string;
          taxMode?: string;
        } | null,
        Name
      >;
      getSubscription: FunctionReference<
        "query",
        "internal",
        { id: string },
        {
          amount: number | null;
          cancelAtPeriodEnd: boolean;
          canceledAt?: string | null;
          checkoutId: string | null;
          collectionMethod?: string;
          createdAt: string;
          currency: string | null;
          currentPeriodEnd: string | null;
          currentPeriodStart: string;
          customerId: string;
          discountId?: string | null;
          endedAt: string | null;
          endsAt?: string | null;
          id: string;
          lastTransactionId?: string | null;
          metadata: Record<string, any>;
          mode?: string;
          modifiedAt: string | null;
          nextTransactionDate?: string | null;
          priceId?: string;
          productId: string;
          recurringInterval: string | null;
          seats?: number | null;
          startedAt: string | null;
          status: string;
          trialEnd?: string | null;
          trialStart?: string | null;
        } | null,
        Name
      >;
      insertCustomer: FunctionReference<
        "mutation",
        "internal",
        {
          country?: string;
          createdAt?: string;
          email?: string;
          entityId: string;
          id: string;
          metadata?: Record<string, any>;
          mode?: string;
          name?: string | null;
          updatedAt?: string;
        },
        string,
        Name
      >;
      listAllUserSubscriptions: FunctionReference<
        "query",
        "internal",
        { entityId: string },
        Array<{
          amount: number | null;
          cancelAtPeriodEnd: boolean;
          canceledAt?: string | null;
          checkoutId: string | null;
          collectionMethod?: string;
          createdAt: string;
          currency: string | null;
          currentPeriodEnd: string | null;
          currentPeriodStart: string;
          customerId: string;
          discountId?: string | null;
          endedAt: string | null;
          endsAt?: string | null;
          id: string;
          lastTransactionId?: string | null;
          metadata: Record<string, any>;
          mode?: string;
          modifiedAt: string | null;
          nextTransactionDate?: string | null;
          priceId?: string;
          product: {
            billingPeriod?: string;
            billingType: string;
            createdAt: string;
            currency: string;
            defaultSuccessUrl?: string | null;
            description: string | null;
            features?: Array<{ description: string; id: string }>;
            id: string;
            imageUrl?: string;
            metadata?: Record<string, any>;
            mode?: string;
            modifiedAt: string | null;
            name: string;
            price: number;
            productUrl?: string;
            status: string;
            taxCategory?: string;
            taxMode?: string;
          } | null;
          productId: string;
          recurringInterval: string | null;
          seats?: number | null;
          startedAt: string | null;
          status: string;
          trialEnd?: string | null;
          trialStart?: string | null;
        }>,
        Name
      >;
      listCustomerSubscriptions: FunctionReference<
        "query",
        "internal",
        { customerId: string },
        Array<{
          amount: number | null;
          cancelAtPeriodEnd: boolean;
          canceledAt?: string | null;
          checkoutId: string | null;
          collectionMethod?: string;
          createdAt: string;
          currency: string | null;
          currentPeriodEnd: string | null;
          currentPeriodStart: string;
          customerId: string;
          discountId?: string | null;
          endedAt: string | null;
          endsAt?: string | null;
          id: string;
          lastTransactionId?: string | null;
          metadata: Record<string, any>;
          mode?: string;
          modifiedAt: string | null;
          nextTransactionDate?: string | null;
          priceId?: string;
          productId: string;
          recurringInterval: string | null;
          seats?: number | null;
          startedAt: string | null;
          status: string;
          trialEnd?: string | null;
          trialStart?: string | null;
        }>,
        Name
      >;
      listProducts: FunctionReference<
        "query",
        "internal",
        { includeArchived?: boolean },
        Array<{
          billingPeriod?: string;
          billingType: string;
          createdAt: string;
          currency: string;
          defaultSuccessUrl?: string | null;
          description: string | null;
          features?: Array<{ description: string; id: string }>;
          id: string;
          imageUrl?: string;
          metadata?: Record<string, any>;
          mode?: string;
          modifiedAt: string | null;
          name: string;
          price: number;
          productUrl?: string;
          status: string;
          taxCategory?: string;
          taxMode?: string;
        }>,
        Name
      >;
      listUserOrders: FunctionReference<
        "query",
        "internal",
        { entityId: string },
        Array<{
          affiliate?: string | null;
          amount: number;
          amountDue?: number;
          amountPaid?: number;
          checkoutId?: string | null;
          createdAt: string;
          currency: string;
          customerId: string;
          discountAmount?: number;
          discountId?: string | null;
          id: string;
          metadata?: Record<string, any>;
          mode?: string;
          productId: string;
          status: string;
          subTotal?: number;
          taxAmount?: number;
          transactionId?: string | null;
          type: string;
          updatedAt: string;
        }>,
        Name
      >;
      listUserSubscriptions: FunctionReference<
        "query",
        "internal",
        { entityId: string },
        Array<{
          amount: number | null;
          cancelAtPeriodEnd: boolean;
          canceledAt?: string | null;
          checkoutId: string | null;
          collectionMethod?: string;
          createdAt: string;
          currency: string | null;
          currentPeriodEnd: string | null;
          currentPeriodStart: string;
          customerId: string;
          discountId?: string | null;
          endedAt: string | null;
          endsAt?: string | null;
          id: string;
          lastTransactionId?: string | null;
          metadata: Record<string, any>;
          mode?: string;
          modifiedAt: string | null;
          nextTransactionDate?: string | null;
          priceId?: string;
          product: {
            billingPeriod?: string;
            billingType: string;
            createdAt: string;
            currency: string;
            defaultSuccessUrl?: string | null;
            description: string | null;
            features?: Array<{ description: string; id: string }>;
            id: string;
            imageUrl?: string;
            metadata?: Record<string, any>;
            mode?: string;
            modifiedAt: string | null;
            name: string;
            price: number;
            productUrl?: string;
            status: string;
            taxCategory?: string;
            taxMode?: string;
          } | null;
          productId: string;
          recurringInterval: string | null;
          seats?: number | null;
          startedAt: string | null;
          status: string;
          trialEnd?: string | null;
          trialStart?: string | null;
        }>,
        Name
      >;
      patchSubscription: FunctionReference<
        "mutation",
        "internal",
        {
          cancelAtPeriodEnd?: boolean;
          clearOptimistic?: boolean;
          productId?: string;
          seats?: number | null;
          status?: string;
          subscriptionId: string;
        },
        any,
        Name
      >;
      syncProducts: FunctionReference<
        "action",
        "internal",
        { apiKey: string; serverIdx?: number; serverURL?: string },
        any,
        Name
      >;
      updateProduct: FunctionReference<
        "mutation",
        "internal",
        {
          product: {
            billingPeriod?: string;
            billingType: string;
            createdAt: string;
            currency: string;
            defaultSuccessUrl?: string | null;
            description: string | null;
            features?: Array<{ description: string; id: string }>;
            id: string;
            imageUrl?: string;
            metadata?: Record<string, any>;
            mode?: string;
            modifiedAt: string | null;
            name: string;
            price: number;
            productUrl?: string;
            status: string;
            taxCategory?: string;
            taxMode?: string;
          };
        },
        any,
        Name
      >;
      updateProducts: FunctionReference<
        "mutation",
        "internal",
        {
          products: Array<{
            billingPeriod?: string;
            billingType: string;
            createdAt: string;
            currency: string;
            defaultSuccessUrl?: string | null;
            description: string | null;
            features?: Array<{ description: string; id: string }>;
            id: string;
            imageUrl?: string;
            metadata?: Record<string, any>;
            mode?: string;
            modifiedAt: string | null;
            name: string;
            price: number;
            productUrl?: string;
            status: string;
            taxCategory?: string;
            taxMode?: string;
          }>;
        },
        any,
        Name
      >;
      updateSubscription: FunctionReference<
        "mutation",
        "internal",
        {
          subscription: {
            amount: number | null;
            cancelAtPeriodEnd: boolean;
            canceledAt?: string | null;
            checkoutId: string | null;
            collectionMethod?: string;
            createdAt: string;
            currency: string | null;
            currentPeriodEnd: string | null;
            currentPeriodStart: string;
            customerId: string;
            discountId?: string | null;
            endedAt: string | null;
            endsAt?: string | null;
            id: string;
            lastTransactionId?: string | null;
            metadata: Record<string, any>;
            mode?: string;
            modifiedAt: string | null;
            nextTransactionDate?: string | null;
            priceId?: string;
            productId: string;
            recurringInterval: string | null;
            seats?: number | null;
            startedAt: string | null;
            status: string;
            trialEnd?: string | null;
            trialStart?: string | null;
          };
        },
        any,
        Name
      >;
    };
  };
