import * as components from "creem/models/components";
import * as operations from "creem/models/operations";
import { decode, type OperationHandler } from "../../lib/operation";

export const handlers: Record<string, OperationHandler> = {
  retrieveSubscription: (client, parameters, body, options) => {
    const p = decode(
      operations.RetrieveSubscriptionRequest$outboundSchema,
      operations.RetrieveSubscriptionRequest$inboundSchema,
      parameters,
    );
    return client.subscriptions.get(p.subscriptionId, options);
  },
  searchSubscriptions: (client, parameters, body, options) => {
    const p = decode(
      operations.SearchSubscriptionsRequest$outboundSchema,
      operations.SearchSubscriptionsRequest$inboundSchema,
      parameters,
    );
    return client.subscriptions.search(p.pageNumber, p.pageSize, options);
  },
  cancelSubscription: (client, parameters, body, options) => {
    const p = decode(
      operations.CancelSubscriptionRequest$outboundSchema,
      operations.CancelSubscriptionRequest$inboundSchema,
      { ...parameters, cancelSubscriptionRequestEntity: body },
    );
    const b = decode(
      components.CancelSubscriptionRequestEntity$outboundSchema,
      components.CancelSubscriptionRequestEntity$inboundSchema,
      body,
    );
    return client.subscriptions.cancel(p.id, b, options);
  },
  updateSubscription: (client, parameters, body, options) => {
    const p = decode(
      operations.UpdateSubscriptionRequest$outboundSchema,
      operations.UpdateSubscriptionRequest$inboundSchema,
      { ...parameters, updateSubscriptionRequestEntity: body },
    );
    const b = decode(
      components.UpdateSubscriptionRequestEntity$outboundSchema,
      components.UpdateSubscriptionRequestEntity$inboundSchema,
      body,
    );
    return client.subscriptions.update(p.id, b, options);
  },
  upgradeSubscription: (client, parameters, body, options) => {
    const p = decode(
      operations.UpgradeSubscriptionRequest$outboundSchema,
      operations.UpgradeSubscriptionRequest$inboundSchema,
      { ...parameters, upgradeSubscriptionRequestEntity: body },
    );
    const b = decode(
      components.UpgradeSubscriptionRequestEntity$outboundSchema,
      components.UpgradeSubscriptionRequestEntity$inboundSchema,
      body,
    );
    return client.subscriptions.upgrade(p.id, b, options);
  },
  pauseSubscription: (client, parameters, body, options) => {
    const p = decode(
      operations.PauseSubscriptionRequest$outboundSchema,
      operations.PauseSubscriptionRequest$inboundSchema,
      parameters,
    );
    return client.subscriptions.pause(p.id, options);
  },
  resumeSubscription: (client, parameters, body, options) => {
    const p = decode(
      operations.ResumeSubscriptionRequest$outboundSchema,
      operations.ResumeSubscriptionRequest$inboundSchema,
      parameters,
    );
    return client.subscriptions.resume(p.id, options);
  },
};
