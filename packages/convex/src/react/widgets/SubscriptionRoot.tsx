import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  type PropsWithChildren,
} from "react";
import { useQuery, useConvex } from "convex/react";
import { Dialog } from "@ark-ui/react/dialog";
import { Portal } from "@ark-ui/react/portal";

import { PricingSection } from "../primitives/PricingSection.js";
import { SegmentGroup } from "../primitives/SegmentGroup.js";
import { PaymentWarningBanner } from "../primitives/PaymentWarningBanner.js";
import { ScheduledChangeBanner } from "../primitives/ScheduledChangeBanner.js";

import { SubscriptionContext } from "./subscriptionContext.js";
import { pendingCheckout } from "../../core/pendingCheckout.js";
import { getConvexErrorMessage } from "../../core/convexError.js";

import type {
  PlanCatalog,
  UIPlanEntry,
  RecurringCycle,
  FreePlanUpdateBehavior,
  FreePlanUpdateBehaviorIntent,
  PaidSubscriptionUpdateBehavior,
  SubscriptionUpdateArgs,
  FreePlanUpdateBehaviorSetting,
  ResolvedUpdateBehavior,
  SupportedRecurringCycle,
  UpdateBehavior,
  UpdateBehaviorIntent,
  UpdateBehaviorSetting,
} from "../../core/types.js";
import {
  mergeBillingLabels,
  resolveBillingI18n,
  type BillingI18n,
  type BillingLabelOverrides,
} from "../../core/i18n.js";
import { normalizePlanCatalog } from "../../core/catalog.js";
import {
  buildCatalogRegistrations,
  cyclesForGroup,
  deriveAvailableCycles,
  deriveGroupItems,
  deriveOwnProductIds,
  filterPlansByGroup,
  filterVisiblePlans,
  resolveActiveGroupId,
  resolveActiveOrScheduledPlanIds,
  resolveActivePlanId,
  resolveEffectiveCycle,
  resolveMatchedSubscription,
  resolveUIPlans,
} from "../../core/subscriptionModel.js";
import {
  buildUpdateSummary,
  resolveFreePlanUpdateBehavior,
  resolveTargetUpdateBehavior,
} from "../../core/subscriptionUpdate.js";
import {
  formatPriceWithInterval,
  formatUnitPrice,
  formatUnitPriceBreakdown,
} from "../../core/display.js";
import {
  requireCreemConvexApi,
  useCreemConvex,
} from "../CreemConvexProvider.js";
import type {
  BillingPermissions,
  CheckoutIntent,
  PlanChangeIntent,
  ConnectedBillingModel,
  SubscriptionGroupRegistration,
  SubscriptionPlanRegistration,
} from "./types.js";

const getFallbackSuccessUrl = (): string | undefined => {
  if (typeof window === "undefined") return undefined;
  return `${window.location.origin}${window.location.pathname}`;
};

const getPreferredTheme = (): "light" | "dark" => {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

export const SubscriptionRoot = ({
  catalog,
  plans: planIds,
  groups,
  defaultGroup,
  group,
  onGroupChange,
  groupSelector = "auto",
  defaultCycle,
  cycle,
  onCycleChange,
  intervalSelector = "auto",
  cycleBadges,
  permissions,
  className = "",
  successUrl,
  units,
  showUnitPicker = false,
  columns = "auto",
  updateBehavior,
  freePlanUpdateBehavior,
  unstyled = false,
  onBeforeCheckout,
  onBeforePlanChange,
  onBeforePlanActivation,
  labels: labelOverrides,
  i18n,
  children,
}: PropsWithChildren<{
  catalog?: PlanCatalog;
  plans?: readonly string[];
  groups?: SubscriptionGroupRegistration[];
  defaultGroup?: string;
  group?: string;
  onGroupChange?: (group: string) => void;
  groupSelector?: "auto" | "hidden" | "external";
  defaultCycle?: RecurringCycle;
  cycle?: RecurringCycle;
  onCycleChange?: (cycle: RecurringCycle) => void;
  intervalSelector?: "auto" | "hidden" | "external";
  cycleBadges?: Partial<Record<SupportedRecurringCycle, string>>;
  permissions?: BillingPermissions;
  class?: string;
  className?: string;
  successUrl?: string;
  units?: number;
  showUnitPicker?: boolean;
  columns?: "auto" | 1 | 2 | 3 | 4;
  /** Paid subscription update behavior for paid-to-paid plan switches and unit changes. */
  updateBehavior?: UpdateBehaviorSetting;
  /** Cancellation behavior for paid-to-free or paid-to-app-owned plan switches. */
  freePlanUpdateBehavior?: FreePlanUpdateBehaviorSetting;
  unstyled?: boolean;
  onBeforeCheckout?: (intent: CheckoutIntent) => Promise<boolean> | boolean;
  onBeforePlanChange?: (intent: PlanChangeIntent) => Promise<boolean> | boolean;
  onBeforePlanActivation?: (intent: {
    planId: string;
  }) => Promise<boolean> | boolean;
  labels?: BillingLabelOverrides;
  i18n?: BillingI18n;
}>) => {
  const provider = useCreemConvex();
  const resolvedApi = requireCreemConvexApi("Subscription.Root", provider);
  const resolvedCatalog = catalog ?? provider?.catalog;
  const resolvedDefaultCycle =
    defaultCycle ?? provider?.defaultCycle ?? "every-month";
  const resolvedPermissions = permissions ?? provider?.permissions;
  const resolvedOnBeforeCheckout =
    onBeforeCheckout ?? provider?.onBeforeCheckout;
  const resolvedOnBeforePlanChange =
    onBeforePlanChange ?? provider?.onBeforePlanChange;
  const resolvedOnBeforePlanActivation =
    onBeforePlanActivation ?? provider?.onBeforePlanActivation;
  const resolvedI18n = useMemo(() => {
    const providerI18n = resolveBillingI18n(provider?.i18n);
    return {
      locale: i18n?.locale ?? providerI18n.locale,
      labels: mergeBillingLabels(
        labelOverrides,
        mergeBillingLabels(i18n?.labels, providerI18n.labels),
      ),
      formatCurrency: i18n?.formatCurrency ?? providerI18n.formatCurrency,
      formatDate: i18n?.formatDate ?? providerI18n.formatDate,
    };
  }, [provider?.i18n, i18n, labelOverrides]);

  const canChange = resolvedPermissions?.canChangeSubscription !== false;
  const canCancel = resolvedPermissions?.canCancelSubscription !== false;
  const canResume = resolvedPermissions?.canResumeSubscription !== false;

  const client = useConvex();

  const billingUiModelRef = resolvedApi.uiModel;
  const checkoutLinkRef = resolvedApi.checkouts.create;
  const updateRef = resolvedApi.subscriptions?.update;
  const cancelRef = resolvedApi.subscriptions?.cancel;
  const resumeRef = resolvedApi.subscriptions?.resume;
  const cancelScheduledUpdateRef =
    resolvedApi.subscriptions?.cancelScheduledUpdate;
  const activateAppPlanRef = resolvedApi.plans?.activate;

  const modelRaw = useQuery(billingUiModelRef, {});
  const model = (modelRaw ?? null) as ConnectedBillingModel | null;

  const [selectedCycle, setSelectedCycle] =
    useState<RecurringCycle>(resolvedDefaultCycle);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
    defaultGroup ?? null,
  );
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<
    | {
        kind: "plan-switch";
        plan: UIPlanEntry;
        productId?: string;
        appPlanId?: string;
        freePlanId?: string;
        units?: number;
      }
    | { kind: "unit-update"; units: number }
    | null
  >(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [registeredPlans, setRegisteredPlans] = useState<
    SubscriptionPlanRegistration[]
  >([]);

  const registerPlan = useCallback((plan: SubscriptionPlanRegistration) => {
    setRegisteredPlans((prev) => [
      ...prev.filter((c) => c.planId !== plan.planId),
      plan,
    ]);
    return () => {
      setRegisteredPlans((prev) =>
        prev.filter((c) => c.planId !== plan.planId),
      );
    };
  }, []);

  const allProducts = useMemo(
    () => model?.allProducts ?? [],
    [model?.allProducts],
  );

  const normalizedCatalog = useMemo(
    () => normalizePlanCatalog(resolvedCatalog),
    [resolvedCatalog],
  );

  const catalogRegistrations = useMemo(
    () => buildCatalogRegistrations({ groups, planIds }),
    [groups, planIds],
  );

  const plans = useMemo<UIPlanEntry[]>(
    () =>
      resolveUIPlans({
        registrations: [...catalogRegistrations, ...registeredPlans],
        catalog: normalizedCatalog,
        products: allProducts,
      }),
    [allProducts, catalogRegistrations, normalizedCatalog, registeredPlans],
  );

  const groupItems = useMemo(
    () => deriveGroupItems({ groups, plans }),
    [groups, plans],
  );

  const requestedGroupId = group ?? selectedGroupId ?? defaultGroup ?? null;
  const activeGroupId = resolveActiveGroupId({
    groupItems,
    requestedGroupId,
  });

  const groupedPlans = useMemo(
    () => filterPlansByGroup({ plans, groupItems, activeGroupId }),
    [activeGroupId, groupItems, plans],
  );

  // Product IDs owned by this root's plans, and the subscription that matches.
  const ownProductIds = useMemo(() => deriveOwnProductIds(plans), [plans]);

  const matchedSubscription = useMemo(
    () => resolveMatchedSubscription({ model, ownProductIds }),
    [model, ownProductIds],
  );

  const ownsActiveSubscription = matchedSubscription != null;
  const localSubscriptionProductId = matchedSubscription?.productId ?? null;
  const localCancelAtPeriodEnd =
    matchedSubscription?.cancelAtPeriodEnd ?? false;
  const localCurrentPeriodEnd = matchedSubscription?.currentPeriodEnd ?? null;
  const formattedCancelPeriodEnd = useMemo(() => {
    if (!localCurrentPeriodEnd) return undefined;
    const date = new Date(localCurrentPeriodEnd);
    if (Number.isNaN(date.getTime())) return undefined;
    return resolvedI18n.formatDate({ date });
  }, [localCurrentPeriodEnd, resolvedI18n]);
  const cancelDescription =
    resolvedI18n.labels.subscription.dialogs.cancelDescription({
      formattedDate: formattedCancelPeriodEnd,
    });
  const localSubscriptionState = matchedSubscription?.status ?? null;
  const localSubscribedUnits = matchedSubscription?.units ?? null;
  const localScheduledUpdate = useMemo(
    () =>
      (model?.scheduledSubscriptionUpdates ?? []).find(
        (update) => update.subscriptionId === matchedSubscription?.id,
      ) ?? null,
    [model?.scheduledSubscriptionUpdates, matchedSubscription?.id],
  );
  const formattedScheduledEffectiveDate = useMemo(() => {
    if (!localScheduledUpdate?.effectiveAt) return null;
    const date = new Date(localScheduledUpdate.effectiveAt);
    if (Number.isNaN(date.getTime())) return null;
    return resolvedI18n.formatDate({ date });
  }, [localScheduledUpdate, resolvedI18n]);

  const snapshot = model?.snapshot ?? null;

  const canCheckout =
    !model?.user && resolvedOnBeforeCheckout != null
      ? true
      : resolvedPermissions?.canCheckout !== false;

  const canUpdateUnits =
    !model?.user && resolvedOnBeforeCheckout != null
      ? true
      : resolvedPermissions?.canUpdateUnits !== false;

  const activePlanId = useMemo(
    () =>
      resolveActivePlanId({
        model,
        plans,
        subscriptionProductId: localSubscriptionProductId,
      }),
    [localSubscriptionProductId, model, plans],
  );

  const activeOrScheduledPlanIds = useMemo(
    () =>
      resolveActiveOrScheduledPlanIds({
        model,
        plans,
        subscriptionProductId: localSubscriptionProductId,
      }),
    [localSubscriptionProductId, model, plans],
  );

  const visiblePlans = useMemo(
    () =>
      filterVisiblePlans({
        groupedPlans,
        allPlans: plans,
        model,
        activePlanId,
        activeOrScheduledPlanIds,
      }),
    [activeOrScheduledPlanIds, activePlanId, groupedPlans, model, plans],
  );

  // Cycles come from the plans that actually render, so a plan hidden by
  // eligibility never contributes an interval to the selector.
  const availableCycles = useMemo(
    () => deriveAvailableCycles(visiblePlans),
    [visiblePlans],
  );
  const effectiveCycle = useMemo(
    () =>
      resolveEffectiveCycle({
        availableCycles,
        requestedCycle: cycle ?? selectedCycle,
      }),
    [availableCycles, cycle, selectedCycle],
  );

  const handleCycleChange = useCallback(
    (next: RecurringCycle) => {
      const nextEffectiveCycle =
        availableCycles.length === 0 || availableCycles.includes(next)
          ? next
          : (availableCycles[0] ?? next);
      setSelectedCycle(nextEffectiveCycle);
      onCycleChange?.(nextEffectiveCycle);
    },
    [availableCycles, onCycleChange],
  );

  const getCyclesForGroup = useCallback(
    (groupId: string | null) =>
      cyclesForGroup({
        plans,
        groupItems,
        groupId,
        model,
        activePlanId,
        activeOrScheduledPlanIds,
      }),
    [activeOrScheduledPlanIds, activePlanId, groupItems, model, plans],
  );

  const clampCycleForGroup = useCallback(
    (groupId: string | null) => {
      const targetCycles = getCyclesForGroup(groupId);
      const requestedCycle = cycle ?? selectedCycle;
      if (targetCycles.length === 0 || targetCycles.includes(requestedCycle)) {
        return;
      }
      const nextCycle = targetCycles[0];
      if (!nextCycle) return;
      if (cycle == null) {
        setSelectedCycle(nextCycle);
      }
      onCycleChange?.(nextCycle);
    },
    [cycle, getCyclesForGroup, onCycleChange, selectedCycle],
  );

  const handleGroupChange = useCallback(
    (next: string) => {
      clampCycleForGroup(next);
      setSelectedGroupId(next);
      onGroupChange?.(next);
    },
    [clampCycleForGroup, onGroupChange],
  );

  const getProductPrice = useCallback(
    (productId?: string | null) =>
      productId
        ? (allProducts.find((product) => product.id === productId)?.price ??
          null)
        : null,
    [allProducts],
  );

  const getPlanForProduct = useCallback(
    (productId?: string | null) =>
      productId
        ? (plans.find((plan) =>
            Object.values(plan.creemProductIds ?? {}).includes(productId),
          ) ?? null)
        : null,
    [plans],
  );

  const resolveUpdateBehavior = useCallback(
    (
      update:
        | {
            kind: "plan-switch";
            plan: UIPlanEntry;
            productId?: string;
            appPlanId?: string;
            freePlanId?: string;
            units?: number;
          }
        | { kind: "unit-update"; units: number },
    ): ResolvedUpdateBehavior => {
      const currentPlan = getPlanForProduct(localSubscriptionProductId);

      if (update.kind === "plan-switch" && update.freePlanId) {
        if (typeof freePlanUpdateBehavior !== "function") {
          return resolveFreePlanUpdateBehavior(freePlanUpdateBehavior);
        }
        const intent: FreePlanUpdateBehaviorIntent = {
          kind: "plan-switch",
          target: "free-plan",
          fromPlanId: activePlanId,
          toPlanId: update.plan.planId,
          fromPlan: currentPlan,
          toPlan: update.plan,
          fromProductId: localSubscriptionProductId,
          toProductId: update.productId ?? null,
          fromPrice: getProductPrice(localSubscriptionProductId),
          toPrice: getProductPrice(update.productId),
          currentUnits: localSubscribedUnits,
          targetUnits: update.units,
          freePlanId: update.freePlanId,
          appPlanId: update.appPlanId,
        };
        return resolveFreePlanUpdateBehavior(freePlanUpdateBehavior(intent));
      }

      const applyTargetRules = (behavior: UpdateBehavior | undefined) =>
        resolveTargetUpdateBehavior(behavior, {});

      if (typeof updateBehavior !== "function") {
        return applyTargetRules(updateBehavior);
      }

      const intent: UpdateBehaviorIntent =
        update.kind === "plan-switch"
          ? {
              kind: "plan-switch",
              target: "paid-plan",
              fromPlanId: activePlanId,
              toPlanId: update.plan.planId,
              fromPlan: currentPlan,
              toPlan: update.plan,
              fromProductId: localSubscriptionProductId,
              toProductId: update.productId ?? null,
              fromPrice: getProductPrice(localSubscriptionProductId),
              toPrice: getProductPrice(update.productId),
              currentUnits: localSubscribedUnits,
              targetUnits: update.units,
            }
          : {
              kind: "unit-update",
              target: "units",
              fromPlanId: activePlanId,
              fromPlan: currentPlan,
              fromProductId: localSubscriptionProductId,
              toProductId: localSubscriptionProductId,
              fromPrice: getProductPrice(localSubscriptionProductId),
              toPrice: getProductPrice(localSubscriptionProductId),
              currentUnits: localSubscribedUnits,
              targetUnits: update.units,
            };
      return applyTargetRules(updateBehavior(intent));
    },
    [
      activePlanId,
      getPlanForProduct,
      getProductPrice,
      freePlanUpdateBehavior,
      localSubscribedUnits,
      localSubscriptionProductId,
      updateBehavior,
    ],
  );

  const startCheckout = useCallback(
    async (productId: string, checkoutUnits?: number) => {
      if (resolvedOnBeforeCheckout) {
        const proceed = await resolvedOnBeforeCheckout({
          productId,
          units: checkoutUnits,
        });
        if (!proceed) return;
      }
      setIsActionLoading(true);
      setActionError(null);
      try {
        const { url } = await client.action(checkoutLinkRef, {
          productId,
          ...(successUrl ? { successUrl } : {}),
          fallbackSuccessUrl: getFallbackSuccessUrl(),
          theme: getPreferredTheme(),
          ...(checkoutUnits != null ? { units: checkoutUnits } : {}),
        });
        // Suppress Convex client's beforeunload dialog during checkout redirect.
        // Convex registers via addEventListener, so onbeforeunload=null has no effect.
        // A capture-phase listener fires before non-capture listeners on the same target
        // in modern browsers, and stopImmediatePropagation() blocks all subsequent handlers.
        window.addEventListener(
          "beforeunload",
          (e) => {
            e.stopImmediatePropagation();
          },
          { capture: true, once: true },
        );
        window.location.href = url;
      } catch (error) {
        setActionError(
          getConvexErrorMessage(
            error,
            resolvedI18n.labels.subscription.checkoutFailed,
          ),
        );
      } finally {
        setIsActionLoading(false);
      }
    },
    [
      client,
      checkoutLinkRef,
      successUrl,
      resolvedOnBeforeCheckout,
      resolvedI18n.labels.subscription.checkoutFailed,
    ],
  );

  // Pending checkout resume after auth
  const pendingCheckoutHandled = useRef(false);
  useEffect(() => {
    if (!model?.user || pendingCheckoutHandled.current) return;
    pendingCheckoutHandled.current = true;
    const pending = pendingCheckout.load();
    if (!pending) return;
    if ((model.activeSubscriptions ?? []).length > 0) {
      pendingCheckout.clear();
      return;
    }
    const resumeCheckout = setTimeout(() => {
      void startCheckout(pending.productId, pending.units);
    }, 0);
    return () => clearTimeout(resumeCheckout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model?.user]);

  const handlePricingCheckout = useCallback(
    async (payload: {
      plan: UIPlanEntry;
      productId: string;
      units?: number;
    }) => {
      await startCheckout(payload.productId, payload.units);
    },
    [startCheckout],
  );

  const activateAppPlan = useCallback(
    async (appPlanId: string) => {
      setActionError(null);
      try {
        if (!activateAppPlanRef) return;
        await client.mutation(activateAppPlanRef, {
          planId: appPlanId,
        });
      } catch (cause) {
        setActionError(
          getConvexErrorMessage(
            cause,
            resolvedI18n.labels.subscription.switchFailed,
          ),
        );
      }
    },
    [activateAppPlanRef, client, resolvedI18n.labels.subscription.switchFailed],
  );

  const requestSwitchPlan = useCallback(
    async (payload: {
      plan: UIPlanEntry;
      productId?: string;
      appPlanId?: string;
      freePlanId?: string;
      units?: number;
    }) => {
      // Consent gate: onBeforePlanChange
      if (resolvedOnBeforePlanChange) {
        const proceed = await resolvedOnBeforePlanChange({
          fromPlanId: activePlanId,
          toPlanId: payload.plan.planId,
          productId: payload.productId,
          appPlanId: payload.appPlanId,
          freePlanId: payload.freePlanId,
          units: payload.units,
        });
        if (!proceed) return;
      }
      const appPlanId = payload.appPlanId ?? payload.freePlanId;
      // Consent gate: onBeforePlanActivation
      if (resolvedOnBeforePlanActivation && appPlanId) {
        const proceed = await resolvedOnBeforePlanActivation({
          planId: appPlanId,
        });
        if (!proceed) return;
      }
      if (appPlanId && !matchedSubscription?.id && activateAppPlanRef) {
        await activateAppPlan(appPlanId);
        return;
      }
      setPendingUpdate({ kind: "plan-switch", ...payload });
      setUpdateDialogOpen(true);
    },
    [
      activateAppPlan,
      activateAppPlanRef,
      activePlanId,
      matchedSubscription?.id,
      resolvedOnBeforePlanChange,
      resolvedOnBeforePlanActivation,
    ],
  );

  const confirmUpdate = useCallback(async () => {
    if (!pendingUpdate) return;
    const update = pendingUpdate;
    const selectedUpdateBehavior = resolveUpdateBehavior(update);
    const subId = matchedSubscription?.id;
    setUpdateDialogOpen(false);
    setPendingUpdate(null);
    setActionError(null);
    try {
      if (update.kind === "plan-switch") {
        const appPlanId = update.appPlanId ?? update.freePlanId;
        if (appPlanId && !subId && activateAppPlanRef) {
          await activateAppPlan(appPlanId);
          return;
        }
        if (!updateRef) return;
        await client.mutation(
          updateRef,
          update.freePlanId
            ? ({
                kind: "app-plan",
                freePlanId: update.freePlanId,
                ...(subId ? { subscriptionId: subId } : {}),
                updateBehavior:
                  selectedUpdateBehavior as FreePlanUpdateBehavior,
              } satisfies SubscriptionUpdateArgs)
            : ({
                kind: "plan",
                productId: update.productId!,
                ...(subId ? { subscriptionId: subId } : {}),
                updateBehavior:
                  selectedUpdateBehavior as PaidSubscriptionUpdateBehavior,
              } satisfies SubscriptionUpdateArgs),
          {
            optimisticUpdate: (store) => {
              const current = store.getQuery(billingUiModelRef, {});
              if (current) {
                const m = current as ConnectedBillingModel;
                if (selectedUpdateBehavior === "period-end") {
                  store.setQuery(
                    billingUiModelRef,
                    {},
                    {
                      ...m,
                      scheduledSubscriptionUpdates: [
                        ...(m.scheduledSubscriptionUpdates ?? []).filter(
                          (scheduled) => scheduled.subscriptionId !== subId,
                        ),
                        {
                          entityId: "",
                          subscriptionId: subId ?? "",
                          targetProductId: update.productId,
                          targetPlanId: update.appPlanId ?? update.freePlanId,
                          effectiveAt:
                            matchedSubscription?.currentPeriodEnd ?? "",
                          status: "pending",
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString(),
                        },
                      ],
                    },
                  );
                  return;
                }
                store.setQuery(
                  billingUiModelRef,
                  {},
                  {
                    ...m,
                    activeSubscriptions: (m.activeSubscriptions ?? []).map(
                      (s) =>
                        ownProductIds.has(s.productId)
                          ? { ...s, productId: update.productId ?? s.productId }
                          : s,
                    ),
                  },
                );
              }
            },
          },
        );
      } else {
        if (!updateRef) return;
        await client.mutation(
          updateRef,
          {
            kind: "units",
            units: update.units,
            ...(subId ? { subscriptionId: subId } : {}),
            updateBehavior:
              selectedUpdateBehavior as PaidSubscriptionUpdateBehavior,
          } satisfies SubscriptionUpdateArgs,
          {
            optimisticUpdate: (store) => {
              const current = store.getQuery(billingUiModelRef, {});
              if (current) {
                const m = current as ConnectedBillingModel;
                if (selectedUpdateBehavior === "period-end") {
                  store.setQuery(
                    billingUiModelRef,
                    {},
                    {
                      ...m,
                      scheduledSubscriptionUpdates: [
                        ...(m.scheduledSubscriptionUpdates ?? []).filter(
                          (scheduled) => scheduled.subscriptionId !== subId,
                        ),
                        {
                          entityId: "",
                          subscriptionId: subId ?? "",
                          targetUnits: update.units,
                          effectiveAt:
                            matchedSubscription?.currentPeriodEnd ?? "",
                          status: "pending",
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString(),
                        },
                      ],
                    },
                  );
                  return;
                }
                store.setQuery(
                  billingUiModelRef,
                  {},
                  {
                    ...m,
                    activeSubscriptions: (m.activeSubscriptions ?? []).map(
                      (s) =>
                        s.id === subId ? { ...s, units: update.units } : s,
                    ),
                  },
                );
              }
            },
          },
        );
      }
    } catch (error) {
      setActionError(
        getConvexErrorMessage(
          error,
          update.kind === "plan-switch"
            ? resolvedI18n.labels.subscription.switchFailed
            : resolvedI18n.labels.subscription.unitUpdateFailed,
        ),
      );
    }
  }, [
    updateRef,
    activateAppPlanRef,
    activateAppPlan,
    pendingUpdate,
    matchedSubscription,
    client,
    billingUiModelRef,
    ownProductIds,
    resolveUpdateBehavior,
    resolvedI18n.labels.subscription.switchFailed,
    resolvedI18n.labels.subscription.unitUpdateFailed,
  ]);

  const handleUpdateUnits = useCallback((payload: { units: number }) => {
    setPendingUpdate({ kind: "unit-update", units: payload.units });
    setUpdateDialogOpen(true);
  }, []);

  const updateSummary = useMemo(() => {
    if (!pendingUpdate) return null;
    const selectedUpdateBehavior = resolveUpdateBehavior(pendingUpdate);

    if (pendingUpdate.kind === "plan-switch") {
      const currentPlan = plans.find((p) => {
        const pids = p.creemProductIds ? Object.values(p.creemProductIds) : [];
        return (
          localSubscriptionProductId != null &&
          pids.includes(localSubscriptionProductId)
        );
      });
      const currentTitle =
        currentPlan?.title ?? resolvedI18n.labels.subscription.currentPlan;
      const switchUnits =
        pendingUpdate.units ?? localSubscribedUnits ?? units ?? 1;
      const useUnitBreakdown =
        currentPlan?.pricingModel === "unit" ||
        pendingUpdate.plan.pricingModel === "unit";
      const currentBreakdown = useUnitBreakdown
        ? formatUnitPriceBreakdown(
            localSubscriptionProductId ?? undefined,
            allProducts,
            switchUnits,
            resolvedI18n.labels,
            resolvedI18n.formatCurrency,
          )
        : null;
      const newBreakdown = useUnitBreakdown
        ? pendingUpdate.productId
          ? formatUnitPriceBreakdown(
              pendingUpdate.productId,
              allProducts,
              switchUnits,
              resolvedI18n.labels,
              resolvedI18n.formatCurrency,
            )
          : null
        : null;
      const currentPrice =
        currentBreakdown?.total ??
        formatPriceWithInterval(
          localSubscriptionProductId ?? undefined,
          allProducts,
          resolvedI18n.labels,
          resolvedI18n.formatCurrency,
        );
      const newPrice =
        newBreakdown?.total ??
        (pendingUpdate.productId
          ? formatPriceWithInterval(
              pendingUpdate.productId,
              allProducts,
              resolvedI18n.labels,
              resolvedI18n.formatCurrency,
            )
          : null);
      const currentPriceAmount = getProductPrice(localSubscriptionProductId);
      const newPriceAmount = getProductPrice(pendingUpdate.productId);
      const currentComparisonPrice =
        currentPriceAmount != null && useUnitBreakdown
          ? currentPriceAmount * switchUnits
          : currentPriceAmount;
      const newComparisonPrice =
        newPriceAmount != null && useUnitBreakdown
          ? newPriceAmount * switchUnits
          : newPriceAmount;

      return buildUpdateSummary({
        kind: "plan-switch",
        updateBehavior: selectedUpdateBehavior,
        currentLabel: currentPrice
          ? `${currentTitle} \u00b7 ${currentPrice}`
          : currentTitle,
        newLabel: newPrice
          ? `${pendingUpdate.plan.title ?? resolvedI18n.labels.subscription.newPlan} \u00b7 ${newPrice}`
          : (pendingUpdate.plan.title ??
            resolvedI18n.labels.subscription.newPlan),
        currentPrice: currentComparisonPrice,
        newPrice: newComparisonPrice,
        currentCaption: currentBreakdown?.calculation ?? null,
        newCaption: newBreakdown?.calculation ?? null,
        currentPeriodEnd: matchedSubscription?.currentPeriodEnd,
        isTrialing: matchedSubscription?.status === "trialing",
        trialEnd: matchedSubscription?.trialEnd,
        labels: resolvedI18n.labels,
        formatDate: resolvedI18n.formatDate,
      });
    }

    const currentUnits = localSubscribedUnits ?? 1;
    const currentPrice = formatUnitPrice(
      localSubscriptionProductId ?? undefined,
      allProducts,
      currentUnits,
      resolvedI18n.labels,
      resolvedI18n.formatCurrency,
    );
    const newPrice = formatUnitPrice(
      localSubscriptionProductId ?? undefined,
      allProducts,
      pendingUpdate.units,
      resolvedI18n.labels,
      resolvedI18n.formatCurrency,
    );
    const unitPriceAmount = getProductPrice(localSubscriptionProductId);

    return buildUpdateSummary({
      kind: "unit-update",
      updateBehavior: selectedUpdateBehavior,
      currentLabel:
        currentPrice ??
        resolvedI18n.labels.subscription.unitCount(currentUnits),
      newLabel:
        newPrice ??
        resolvedI18n.labels.subscription.unitCount(pendingUpdate.units),
      currentPrice:
        unitPriceAmount != null ? unitPriceAmount * currentUnits : null,
      newPrice:
        unitPriceAmount != null ? unitPriceAmount * pendingUpdate.units : null,
      currentPeriodEnd: matchedSubscription?.currentPeriodEnd,
      isTrialing: matchedSubscription?.status === "trialing",
      trialEnd: matchedSubscription?.trialEnd,
      labels: resolvedI18n.labels,
      formatDate: resolvedI18n.formatDate,
    });
  }, [
    pendingUpdate,
    plans,
    localSubscriptionProductId,
    allProducts,
    localSubscribedUnits,
    units,
    getProductPrice,
    resolveUpdateBehavior,
    matchedSubscription,
    resolvedI18n,
  ]);

  const scheduledUpdateLabel = useMemo(() => {
    if (!localScheduledUpdate) return null;
    if (localScheduledUpdate.targetProductId) {
      const targetPlan = getPlanForProduct(
        localScheduledUpdate.targetProductId,
      );
      const price = formatPriceWithInterval(
        localScheduledUpdate.targetProductId,
        allProducts,
        resolvedI18n.labels,
        resolvedI18n.formatCurrency,
      );
      const title =
        targetPlan?.title ?? resolvedI18n.labels.subscription.newPlan;
      return price ? `${title} \u00b7 ${price}` : title;
    }
    if (localScheduledUpdate.targetPlanId) {
      const targetPlan = plans.find(
        (plan) => plan.planId === localScheduledUpdate.targetPlanId,
      );
      return targetPlan?.title ?? localScheduledUpdate.targetPlanId;
    }
    if (localScheduledUpdate.targetUnits !== undefined) {
      return resolvedI18n.labels.subscription.unitCount(
        localScheduledUpdate.targetUnits,
      );
    }
    return null;
  }, [
    allProducts,
    getPlanForProduct,
    localScheduledUpdate,
    plans,
    resolvedI18n,
  ]);

  const confirmCancelSubscription = useCallback(async () => {
    if (!cancelRef) return;
    const subId = matchedSubscription?.id;
    setCancelDialogOpen(false);
    setActionError(null);
    try {
      await client.mutation(
        cancelRef,
        {
          ...(subId ? { subscriptionId: subId } : {}),
        },
        {
          optimisticUpdate: (store) => {
            const current = store.getQuery(billingUiModelRef, {});
            if (current) {
              const m = current as ConnectedBillingModel;
              store.setQuery(
                billingUiModelRef,
                {},
                {
                  ...m,
                  activeSubscriptions: (m.activeSubscriptions ?? []).map((s) =>
                    ownProductIds.has(s.productId)
                      ? { ...s, cancelAtPeriodEnd: true }
                      : s,
                  ),
                },
              );
            }
          },
        },
      );
    } catch (error) {
      setActionError(
        getConvexErrorMessage(
          error,
          resolvedI18n.labels.subscription.cancelFailed,
        ),
      );
    }
  }, [
    cancelRef,
    matchedSubscription,
    client,
    billingUiModelRef,
    ownProductIds,
    resolvedI18n.labels.subscription.cancelFailed,
  ]);

  const resumeSubscription = useCallback(async () => {
    if (!resumeRef) return;
    const subId = matchedSubscription?.id;
    setActionError(null);
    try {
      await client.mutation(
        resumeRef,
        {
          ...(subId ? { subscriptionId: subId } : {}),
        },
        {
          optimisticUpdate: (store) => {
            const current = store.getQuery(billingUiModelRef, {});
            if (current) {
              const m = current as ConnectedBillingModel;
              store.setQuery(
                billingUiModelRef,
                {},
                {
                  ...m,
                  activeSubscriptions: (m.activeSubscriptions ?? []).map((s) =>
                    ownProductIds.has(s.productId)
                      ? { ...s, cancelAtPeriodEnd: false, status: "active" }
                      : s,
                  ),
                },
              );
            }
          },
        },
      );
    } catch (error) {
      setActionError(
        getConvexErrorMessage(
          error,
          resolvedI18n.labels.subscription.resumeFailed,
        ),
      );
    }
  }, [
    resumeRef,
    matchedSubscription,
    client,
    billingUiModelRef,
    ownProductIds,
    resolvedI18n.labels.subscription.resumeFailed,
  ]);

  const undoScheduledUpdate = useCallback(async () => {
    if (!cancelScheduledUpdateRef) return;
    const subId = matchedSubscription?.id;
    setActionError(null);
    try {
      await client.mutation(
        cancelScheduledUpdateRef,
        {
          ...(subId ? { subscriptionId: subId } : {}),
        },
        {
          optimisticUpdate: (store) => {
            const current = store.getQuery(billingUiModelRef, {});
            if (current) {
              const m = current as ConnectedBillingModel;
              store.setQuery(
                billingUiModelRef,
                {},
                {
                  ...m,
                  scheduledSubscriptionUpdates: (
                    m.scheduledSubscriptionUpdates ?? []
                  ).filter((update) => update.subscriptionId !== subId),
                  activeSubscriptions: (m.activeSubscriptions ?? []).map((s) =>
                    s.id === subId ? { ...s, cancelAtPeriodEnd: false } : s,
                  ),
                },
              );
            }
          },
        },
      );
    } catch (error) {
      setActionError(
        getConvexErrorMessage(
          error,
          resolvedI18n.labels.subscription.resumeFailed,
        ),
      );
    }
  }, [
    billingUiModelRef,
    cancelScheduledUpdateRef,
    client,
    matchedSubscription,
    resolvedI18n.labels.subscription.resumeFailed,
  ]);

  const openCancelDialog = useCallback(() => {
    setCancelDialogOpen(true);
  }, []);

  const contextValue = useMemo(
    () => ({
      registerPlan,
      getPlan: (planId: string) =>
        plans.find((candidate) => candidate.planId === planId),
      isPlanVisible: (planId: string) =>
        visiblePlans.some((candidate) => candidate.planId === planId),
      selectedCycle: effectiveCycle,
      activePlanId,
      products: allProducts,
      subscriptionProductId: localSubscriptionProductId,
      subscriptionStatus: localSubscriptionState,
      subscriptionTrialEnd: matchedSubscription?.trialEnd ?? null,
      scheduledUpdate: localScheduledUpdate,
      scheduledEffectiveDate: formattedScheduledEffectiveDate,
      subscribedUnits: localSubscribedUnits,
      units,
      showUnitPicker,
      reserveTrialCaption: visiblePlans.some(
        (candidate) => (candidate.trialDays ?? 0) > 0,
      ),
      isGroupSubscribed: ownsActiveSubscription,
      disableCheckout: !canCheckout,
      disableSwitch: !canChange,
      disableUnits: !canUpdateUnits,
      unstyled,
      columns,
      labels: resolvedI18n.labels,
      cycleBadges,
      formatCurrency: resolvedI18n.formatCurrency,
      formatDate: resolvedI18n.formatDate,
      checkout: handlePricingCheckout,
      switchPlan:
        (updateRef || activateAppPlanRef) && canChange
          ? requestSwitchPlan
          : undefined,
      updateUnits: updateRef && canUpdateUnits ? handleUpdateUnits : undefined,
      cancelSubscription:
        cancelRef &&
        canCancel &&
        ownsActiveSubscription &&
        !localCancelAtPeriodEnd
          ? openCancelDialog
          : undefined,
      groupItems,
      activeGroupId,
      setGroup: handleGroupChange,
      availableCycles,
      setCycle: handleCycleChange,
    }),
    [
      registerPlan,
      plans,
      visiblePlans,
      effectiveCycle,
      activePlanId,
      allProducts,
      localSubscriptionProductId,
      localSubscriptionState,
      localScheduledUpdate,
      formattedScheduledEffectiveDate,
      matchedSubscription,
      localSubscribedUnits,
      units,
      showUnitPicker,
      ownsActiveSubscription,
      canCheckout,
      canChange,
      canUpdateUnits,
      unstyled,
      columns,
      resolvedI18n,
      cycleBadges,
      handlePricingCheckout,
      updateRef,
      activateAppPlanRef,
      requestSwitchPlan,
      handleUpdateUnits,
      cancelRef,
      canCancel,
      localCancelAtPeriodEnd,
      openCancelDialog,
      groupItems,
      activeGroupId,
      handleGroupChange,
      availableCycles,
      handleCycleChange,
    ],
  );

  return (
    <SubscriptionContext.Provider value={contextValue}>
      <section
        className={unstyled ? className : `creem-base:space-y-4 ${className}`}
      >
        {actionError && (
          <div
            className={
              unstyled
                ? ""
                : "creem-base:rounded-lg creem-base:border creem-base:border-red-300 creem-base:bg-red-50 creem-base:px-3 creem-base:py-2 creem-base:text-sm creem-base:text-red-700"
            }
          >
            {actionError}
          </div>
        )}

        {!model ? (
          <p
            className={
              unstyled ? "" : "creem-base:text-sm creem-base:text-zinc-500"
            }
          >
            {resolvedI18n.labels.subscription.loadingBillingModel}
          </p>
        ) : (
          <>
            {ownsActiveSubscription && snapshot && (
              <ScheduledChangeBanner
                cancelAtPeriodEnd={localCancelAtPeriodEnd}
                currentPeriodEnd={localCurrentPeriodEnd}
                scheduledUpdate={localScheduledUpdate}
                isLoading={isActionLoading}
                scheduledUpdateLabel={scheduledUpdateLabel}
                onUndoUpdate={
                  cancelScheduledUpdateRef && canResume
                    ? undoScheduledUpdate
                    : undefined
                }
                onResume={
                  resumeRef && canResume ? resumeSubscription : undefined
                }
                labels={resolvedI18n.labels}
                formatDate={resolvedI18n.formatDate}
              />
            )}
            <PaymentWarningBanner labels={resolvedI18n.labels} />

            {groupSelector === "auto" && groupItems.length > 1 && (
              <div
                className={
                  unstyled ? "" : "creem-base:flex creem-base:justify-center"
                }
              >
                <SegmentGroup
                  items={groupItems}
                  value={activeGroupId}
                  unstyled={unstyled}
                  onValueChange={handleGroupChange}
                />
              </div>
            )}

            {children ? (
              children
            ) : (
              <PricingSection
                plans={visiblePlans}
                activePlanId={activePlanId}
                selectedCycle={effectiveCycle}
                products={allProducts}
                subscriptionProductId={localSubscriptionProductId}
                subscriptionStatus={localSubscriptionState}
                subscriptionTrialEnd={matchedSubscription?.trialEnd ?? null}
                scheduledUpdate={localScheduledUpdate}
                scheduledEffectiveDate={formattedScheduledEffectiveDate}
                units={units}
                showUnitPicker={showUnitPicker}
                showCycleToggle={intervalSelector === "auto"}
                cycleBadges={cycleBadges}
                columns={columns}
                subscribedUnits={localSubscribedUnits}
                isGroupSubscribed={ownsActiveSubscription}
                onCycleChange={
                  intervalSelector === "external"
                    ? undefined
                    : handleCycleChange
                }
                disableCheckout={!canCheckout}
                disableSwitch={!canChange}
                disableUnits={!canUpdateUnits}
                onCheckout={canCheckout ? handlePricingCheckout : undefined}
                onSwitchPlan={
                  (updateRef || activateAppPlanRef) && canChange
                    ? requestSwitchPlan
                    : undefined
                }
                onUpdateUnits={
                  updateRef && canUpdateUnits ? handleUpdateUnits : undefined
                }
                onCancelSubscription={
                  cancelRef &&
                  canCancel &&
                  ownsActiveSubscription &&
                  !localCancelAtPeriodEnd
                    ? openCancelDialog
                    : undefined
                }
                labels={resolvedI18n.labels}
                formatCurrency={resolvedI18n.formatCurrency}
              />
            )}

            {/* Cancel Dialog */}
            <Dialog.Root
              open={cancelDialogOpen}
              onOpenChange={(details: { open: boolean }) =>
                setCancelDialogOpen(details.open)
              }
            >
              <Portal>
                <Dialog.Backdrop className="dialog-backdrop" />
                <Dialog.Positioner className="dialog-positioner">
                  <Dialog.Content className="dialog-content">
                    <Dialog.CloseTrigger
                      className="icon-button-ghost-sm absolute right-2 top-2"
                      aria-label={resolvedI18n.labels.accessibility.closeDialog}
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="h-4 w-4"
                      >
                        <path
                          d="M18 6L6 18M6 6L18 18"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </Dialog.CloseTrigger>
                    <Dialog.Title className="dialog-title">
                      {resolvedI18n.labels.subscription.dialogs.cancelTitle}
                    </Dialog.Title>
                    <Dialog.Description className="dialog-description">
                      {cancelDescription}
                    </Dialog.Description>
                    <div className="dialog-actions">
                      <button
                        type="button"
                        className="dialog-action-danger"
                        onClick={confirmCancelSubscription}
                      >
                        {resolvedI18n.labels.subscription.dialogs.confirmCancel}
                      </button>
                      <Dialog.CloseTrigger className="button-faded h-8 w-full">
                        {
                          resolvedI18n.labels.subscription.dialogs
                            .keepSubscription
                        }
                      </Dialog.CloseTrigger>
                    </div>
                  </Dialog.Content>
                </Dialog.Positioner>
              </Portal>
            </Dialog.Root>

            {/* Update Confirmation Dialog */}
            <Dialog.Root
              open={updateDialogOpen}
              onOpenChange={(details: { open: boolean }) => {
                setUpdateDialogOpen(details.open);
                if (!details.open) setPendingUpdate(null);
              }}
            >
              <Portal>
                <Dialog.Backdrop className="dialog-backdrop" />
                <Dialog.Positioner className="dialog-positioner">
                  <Dialog.Content className="dialog-content">
                    <Dialog.CloseTrigger
                      className="icon-button-ghost-sm absolute right-2 top-2"
                      aria-label={resolvedI18n.labels.accessibility.closeDialog}
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="h-4 w-4"
                      >
                        <path
                          d="M18 6L6 18M6 6L18 18"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </Dialog.CloseTrigger>
                    <Dialog.Title className="dialog-title">
                      {updateSummary?.title}
                    </Dialog.Title>
                    {updateSummary && (
                      <>
                        <div className="my-3 flex flex-col gap-1 rounded-lg bg-surface-subtle px-3 py-2.5">
                          <span className="label-m text-foreground-muted">
                            {updateSummary.currentLabel}
                          </span>
                          {updateSummary.currentCaption && (
                            <span className="body-s text-foreground-placeholder">
                              {updateSummary.currentCaption}
                            </span>
                          )}
                          <span className="body-s text-foreground-placeholder">
                            {"\u2192"}
                          </span>
                          <span className="label-m text-foreground-default">
                            {updateSummary.newLabel}
                          </span>
                          {updateSummary.newCaption && (
                            <span className="body-s text-foreground-placeholder">
                              {updateSummary.newCaption}
                            </span>
                          )}
                        </div>
                        <Dialog.Description className="dialog-description">
                          {updateSummary.description}
                          {updateSummary.dateNote && (
                            <> {updateSummary.dateNote}</>
                          )}
                        </Dialog.Description>
                      </>
                    )}
                    <div className="dialog-actions">
                      <button
                        type="button"
                        className="button-filled h-8 w-full"
                        onClick={confirmUpdate}
                      >
                        {updateSummary?.confirmLabel ??
                          resolvedI18n.labels.common.confirm}
                      </button>
                      <Dialog.CloseTrigger className="button-faded h-8 w-full">
                        {resolvedI18n.labels.common.cancel}
                      </Dialog.CloseTrigger>
                    </div>
                  </Dialog.Content>
                </Dialog.Positioner>
              </Portal>
            </Dialog.Root>
          </>
        )}
      </section>
    </SubscriptionContext.Provider>
  );
};
