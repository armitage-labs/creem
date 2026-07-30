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

type AppPlanTransitionRollback = {
  planId: string;
  scheduledUpdateId?: string;
  scheduledUpdateCreatedAt?: string;
  assignmentCreatedAt?: string;
};

type LifecycleRollback = {
  abortAppPlanTransitions?: Array<AppPlanTransitionRollback>;
  restoreAppPlanTransitions?: Array<AppPlanTransitionRollback>;
  replacementScheduledUpdateIds?: Array<string>;
};

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
      activateScheduledAppPlanAssignment: FunctionReference<
        "mutation",
        "internal",
        { planId?: string; subscriptionId: string },
        {
          assignedByUserId?: string;
          createdAt: string;
          endsAt?: string | null;
          entityId: string;
          planId: string;
          source?: string;
          startsAt: string;
          status: "active" | "scheduled" | "ended";
          subscriptionId?: string;
          updatedAt: string;
        } | null,
        Name
      >;
      applyScheduledSubscriptionUpdate: FunctionReference<
        "action",
        "internal",
        {
          apiKey: string;
          scheduledUpdateId: string;
          server?: "test" | "prod";
          serverURL?: string;
        },
        any,
        Name
      >;
      assignAppPlan: FunctionReference<
        "mutation",
        "internal",
        {
          assignedByUserId?: string;
          endsAt?: string | null;
          entityId: string;
          planId: string;
          source?: string;
          startsAt?: string;
          status?: "active" | "scheduled";
          subscriptionId?: string;
        },
        {
          assignedByUserId?: string;
          createdAt: string;
          endsAt?: string | null;
          entityId: string;
          planId: string;
          source?: string;
          startsAt: string;
          status: "active" | "scheduled" | "ended";
          subscriptionId?: string;
          updatedAt: string;
        },
        Name
      >;
      cancelPendingScheduledSubscriptionUpdates: FunctionReference<
        "mutation",
        "internal",
        { entityId: string; subscriptionId: string },
        Array<{
          createdAt: string;
          effectiveAt: string;
          entityId: string;
          error?: string;
          scheduledFunctionId?: string;
          status: "pending" | "applying" | "applied" | "superseded" | "failed";
          subscriptionId: string;
          targetPlanId?: string;
          targetProductId?: string;
          targetUnits?: number;
          updatedAt: string;
        }>,
        Name
      >;
      cancelScheduledAppPlanAssignment: FunctionReference<
        "mutation",
        "internal",
        { planId?: string; subscriptionId: string },
        {
          assignedByUserId?: string;
          createdAt: string;
          endsAt?: string | null;
          entityId: string;
          planId: string;
          source?: string;
          startsAt: string;
          status: "active" | "scheduled" | "ended";
          subscriptionId?: string;
          updatedAt: string;
        } | null,
        Name
      >;
      cancelScheduledSubscriptionUpdate: FunctionReference<
        "mutation",
        "internal",
        { entityId: string; subscriptionId: string },
        {
          createdAt: string;
          effectiveAt: string;
          entityId: string;
          error?: string;
          scheduledFunctionId?: string;
          status: "pending" | "applying" | "applied" | "superseded" | "failed";
          subscriptionId: string;
          targetPlanId?: string;
          targetProductId?: string;
          targetUnits?: number;
          updatedAt: string;
        } | null,
        Name
      >;
      compensateSubscriptionLifecycle: FunctionReference<
        "mutation",
        "internal",
        {
          clearOptimistic?: boolean;
          error?: string;
          previousCancelAtPeriodEnd?: boolean;
          previousProductId?: string;
          previousSeats?: number | null;
          previousStatus?: string;
          rollback?: LifecycleRollback;
          subscriptionId: string;
        },
        null,
        Name
      >;
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
      createScheduledSubscriptionUpdate: FunctionReference<
        "mutation",
        "internal",
        {
          effectiveAt: string;
          entityId: string;
          subscriptionId: string;
          targetPlanId?: string;
          targetProductId?: string;
          targetUnits?: number;
        },
        string,
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
      endActiveAppPlanAssignments: FunctionReference<
        "mutation",
        "internal",
        { endedAt?: string; entityId: string },
        number,
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
          rollback?: LifecycleRollback;
          scheduledUpdateId?: string;
          server?: "test" | "prod";
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
          previousCancelAtPeriodEnd?: boolean;
          previousStatus?: string;
          productId?: string;
          rollback?: LifecycleRollback;
          resumeScheduledCancellation?: boolean;
          server?: "test" | "prod";
          serverURL?: string;
          subscriptionId: string;
          units?: number;
          updateBehavior?: string;
        },
        any,
        Name
      >;
      getAppPlanActivation: FunctionReference<
        "query",
        "internal",
        { entityId: string; planId: string },
        {
          activatedByUserId?: string;
          activationCount: number;
          entityId: string;
          firstActivatedAt: number;
          lastActivatedAt: number;
          planId: string;
        } | null,
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
      getScheduledSubscriptionUpdate: FunctionReference<
        "query",
        "internal",
        { scheduledUpdateId: string },
        {
          createdAt: string;
          effectiveAt: string;
          entityId: string;
          error?: string;
          scheduledFunctionId?: string;
          status: "pending" | "applying" | "applied" | "superseded" | "failed";
          subscriptionId: string;
          targetPlanId?: string;
          targetProductId?: string;
          targetUnits?: number;
          updatedAt: string;
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
      listAppPlanActivations: FunctionReference<
        "query",
        "internal",
        { entityId: string },
        Array<{
          activatedByUserId?: string;
          activationCount: number;
          entityId: string;
          firstActivatedAt: number;
          lastActivatedAt: number;
          planId: string;
        }>,
        Name
      >;
      listAppPlanAssignments: FunctionReference<
        "query",
        "internal",
        { entityId: string },
        Array<{
          assignedByUserId?: string;
          createdAt: string;
          endsAt?: string | null;
          entityId: string;
          planId: string;
          source?: string;
          startsAt: string;
          status: "active" | "scheduled" | "ended";
          subscriptionId?: string;
          updatedAt: string;
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
      listPendingScheduledSubscriptionUpdates: FunctionReference<
        "query",
        "internal",
        { entityId: string },
        Array<{
          createdAt: string;
          effectiveAt: string;
          entityId: string;
          error?: string;
          scheduledFunctionId?: string;
          status: "pending" | "applying" | "applied" | "superseded" | "failed";
          subscriptionId: string;
          targetPlanId?: string;
          targetProductId?: string;
          targetUnits?: number;
          updatedAt: string;
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
      markScheduledSubscriptionUpdateApplied: FunctionReference<
        "mutation",
        "internal",
        { scheduledUpdateId: string },
        any,
        Name
      >;
      markScheduledSubscriptionUpdateApplying: FunctionReference<
        "mutation",
        "internal",
        { scheduledUpdateId: string },
        boolean,
        Name
      >;
      markScheduledSubscriptionUpdateFailed: FunctionReference<
        "mutation",
        "internal",
        { error: string; scheduledUpdateId: string },
        any,
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
      recordAppPlanActivation: FunctionReference<
        "mutation",
        "internal",
        {
          activatedByUserId?: string;
          entityId: string;
          oncePerEntity?: boolean;
          planId: string;
        },
        {
          activatedByUserId?: string;
          activationCount: number;
          entityId: string;
          firstActivatedAt: number;
          lastActivatedAt: number;
          planId: string;
        },
        Name
      >;
      setScheduledSubscriptionUpdateJob: FunctionReference<
        "mutation",
        "internal",
        { scheduledFunctionId: string; scheduledUpdateId: string },
        any,
        Name
      >;
      syncProducts: FunctionReference<
        "action",
        "internal",
        { apiKey: string; server?: "test" | "prod"; serverURL?: string },
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
