// Compile real consumer usage through both source mappings and package exports.
// No casts or custom response wrappers: these expressions must infer naturally.
import { betterAuth } from "better-auth";
import { createAuthClient } from "better-auth/client";
import { createAuthClient as createReactAuthClient } from "better-auth/react";
import { creem } from "@creem_io/better-auth";
import { creemClient } from "@creem_io/better-auth/client";
import { createCreemAuthClient } from "@creem_io/better-auth/create-creem-auth-client";

const vanilla = createAuthClient({ plugins: [creemClient()] });
const react = createReactAuthClient({ plugins: [creemClient()] });
const disabled = createAuthClient({ plugins: [creemClient({ persistSubscriptions: false })] });
const disabledReact = createReactAuthClient({
  plugins: [creemClient({ persistSubscriptions: false })],
});
const enabled = createAuthClient({ plugins: [creemClient({ persistSubscriptions: true })] });
const wrapper = createCreemAuthClient({ plugins: [creemClient()] });
const auth = betterAuth({ plugins: [creem({ apiKey: "test_key" })] });
const disabledAuth = betterAuth({
  plugins: [creem({ apiKey: "test_key", persistSubscriptions: false })],
});

// Use both native clients so a regression in either adapter breaks compilation.
async function nativeUsage(client: typeof vanilla | typeof react) {
  const checkout = await client.creem.createCheckout({ productId: "prod_1" });
  const checkoutUrl: string | undefined = checkout.data?.url;
  const checkoutRedirect: boolean | undefined = checkout.data?.redirect;
  const errorMessage: string | undefined = checkout.error?.message;
  const errorStatus: number | undefined = checkout.error?.status;
  const portal = await client.creem.createPortal();
  const portalUrl: string | undefined = portal.data?.url;
  const portalRedirect: boolean | undefined = portal.data?.redirect;
  await client.creem.createPortal({ redirect: true });
  await client.creem.createCheckout({ productId: "prod_1", redirect: false });
  const cancel = await client.creem.cancelSubscription({});
  const success: boolean | undefined = cancel.data?.success;
  const message: string | undefined = cancel.data?.message;
  const subscription = await client.creem.retrieveSubscription({ id: "sub_1" });
  const id: string | undefined = subscription.data?.id;
  const status: string | undefined = subscription.data?.status;
  if (subscription.data && typeof subscription.data.product !== "string") {
    const productName: string = subscription.data.product.name;
    void productName;
  }
  const transactions = await client.creem.searchTransactions();
  const total: number | undefined = transactions.data?.pagination.totalRecords;
  transactions.data?.items.forEach((transaction) => {
    const amount: number = transaction.amount;
    const currency: string = transaction.currency;
    void [amount, currency];
  });
  const access = await client.creem.hasAccessGranted();
  const granted: boolean | undefined = access.data?.hasAccessGranted;
  const accessMessage: string | undefined = access.data?.message;
  const activeSubscriptionId: string | undefined = access.data?.subscription?.id;
  const subscriptionStatuses: string[] | undefined = access.data?.subscriptions?.map(
    (entry) => entry.status,
  );
  void [accessMessage, activeSubscriptionId, subscriptionStatuses];
  const session = await client.getSession();
  const customerId: string | null | undefined = session.data?.user.creemCustomerId;
  const hadTrial: boolean | null | undefined = session.data?.user.hadTrial;

  // @ts-expect-error productId is required
  await client.creem.createCheckout({});
  // @ts-expect-error productId must be a string
  await client.creem.createCheckout({ productId: 123 });
  // @ts-expect-error redirect must be a boolean
  await client.creem.createPortal({ redirect: "true" });
  // @ts-expect-error subscription IDs are strings
  await client.creem.cancelSubscription({ id: 123 });
  // @ts-expect-error subscription IDs are strings
  await client.creem.retrieveSubscription({ id: 123 });
  // @ts-expect-error page numbers are numeric
  await client.creem.searchTransactions({ pageNumber: "1" });
  // @ts-expect-error successful checkout responses do not contain endpoint errors
  checkout.data?.error;
  // @ts-expect-error session fields retain their actual value types
  const invalidCustomer: number | undefined = session.data?.user.creemCustomerId;
  void [
    checkoutUrl,
    checkoutRedirect,
    errorMessage,
    errorStatus,
    portalUrl,
    portalRedirect,
    success,
    message,
    id,
    status,
    total,
    granted,
    customerId,
    hadTrial,
    invalidCustomer,
  ];
}

async function persistenceUsage() {
  const session = await disabled.getSession();
  // @ts-expect-error no Creem fields are registered with persistence disabled
  session.data?.user.creemCustomerId;
  // @ts-expect-error trial history is not persisted with persistence disabled
  session.data?.user.hadTrial;
  const reactSession = disabledReact.useSession();
  // @ts-expect-error the React session hook follows the same disabled schema
  reactSession.data?.user.creemCustomerId;
  const defaultReactSession = react.useSession();
  const reactCustomerId: string | null | undefined = defaultReactSession.data?.user.creemCustomerId;
  const enabledSession = await enabled.getSession();
  const enabledCustomerId: string | null | undefined = enabledSession.data?.user.creemCustomerId;
  const disabledCheckout = await disabled.creem.createCheckout({ productId: "prod_1" });
  const checkoutUrl: string | undefined = disabledCheckout.data?.url;
  const serverSession = {} as typeof auth.$Infer.Session;
  const serverCustomerId: string | null | undefined = serverSession.user.creemCustomerId;
  const disabledServerSession = {} as typeof disabledAuth.$Infer.Session;
  // @ts-expect-error server inference must also omit fields absent from the schema
  disabledServerSession.user.creemCustomerId;
  void [reactCustomerId, enabledCustomerId, checkoutUrl, serverCustomerId];
}

async function serverUsage() {
  const checkout = await auth.api.createCheckout({ body: { productId: "prod_1" } });
  const portal = await auth.api.createPortal({ body: {} });
  const cancel = await auth.api.cancelSubscription({ body: {} });
  const subscription = await auth.api.retrieveSubscription({ body: {} });
  const transactions = await auth.api.searchTransactions({ body: {} });
  const access = await auth.api.hasAccessGranted({});
  const checkoutUrl: string = checkout.url;
  const portalUrl: string = portal.url;
  const success: boolean = cancel.success;
  const subscriptionId: string = subscription.id;
  const total: number = transactions.pagination.totalRecords;
  const granted: boolean = access.hasAccessGranted;
  void [checkoutUrl, portalUrl, success, subscriptionId, total, granted];
}

// A runtime boolean cannot guarantee persistence is enabled. Consumers must
// narrow their configuration before asking the client to infer persisted fields.
function dynamicConfiguration(persistSubscriptions: boolean) {
  const client = createAuthClient({ plugins: [creemClient({ persistSubscriptions })] });
  type User = typeof client.$Infer.Session.user;
  // @ts-expect-error persistence may be disabled at runtime
  type CustomerId = User["creemCustomerId"];
  const schemaOverride = creem({
    apiKey: "test_key",
    schema: { user: { fields: { creemCustomerId: "billing_customer_id" } } },
  });
  const mappedAuth = betterAuth({ plugins: [schemaOverride] });
  type MappedUser = typeof mappedAuth.$Infer.Session.user;
  const customerId: MappedUser["creemCustomerId"] = "cust_1";
  void customerId;
}

async function legacyWrapperUsage() {
  const checkout = await wrapper.creem.createCheckout({ productId: "prod_1", redirect: true });
  const portal = await wrapper.creem.createPortal();
  const cancel = await wrapper.creem.cancelSubscription({ id: "sub_1" });
  const subscription = await wrapper.creem.retrieveSubscription({ id: "sub_1" });
  const transactions = await wrapper.creem.searchTransactions();
  const access = await wrapper.creem.hasAccessGranted();
  const checkoutUrl: string | undefined = checkout.data?.url;
  const portalUrl: string | undefined = portal.data?.url;
  const success: boolean | undefined = cancel.data?.success;
  const subscriptionId: string | undefined = subscription.data?.id;
  const total: number | undefined = transactions.data?.pagination.totalRecords;
  const granted: boolean | undefined = access.data?.hasAccessGranted;
  void [checkoutUrl, portalUrl, success, subscriptionId, total, granted];
}

void [nativeUsage, persistenceUsage, serverUsage, dynamicConfiguration, legacyWrapperUsage];
