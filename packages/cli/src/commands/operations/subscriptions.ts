import * as operations from "creem/models/operations";
import { decode, type OperationHandler } from "../../lib/operation";

export const handlers: Record<string, OperationHandler> = {
  retrieveSubscription: (client, parameters, body, options) => {
    const p = decode(
      operations.RetrieveSubscriptionRequest$outboundSchema,
      operations.RetrieveSubscriptionRequest$inboundSchema,
      parameters,
    );
    return client.subscriptions.get(p, options);
  },
  searchSubscriptions: (client, parameters, body, options) => {
    const p = decode(
      operations.SearchSubscriptionsRequest$outboundSchema,
      operations.SearchSubscriptionsRequest$inboundSchema,
      parameters,
    );
    return client.subscriptions.search(p, options);
  },
  cancelSubscription: (client, parameters, body, options) => {
    const p = decode(
      operations.CancelSubscriptionRequest$outboundSchema,
      operations.CancelSubscriptionRequest$inboundSchema,
      { ...parameters, cancelSubscriptionRequestEntity: body },
    );
    return client.subscriptions.cancel(p, options);
  },
  updateSubscription: (client, parameters, body, options) => {
    const p = decode(
      operations.UpdateSubscriptionRequest$outboundSchema,
      operations.UpdateSubscriptionRequest$inboundSchema,
      { ...parameters, updateSubscriptionRequestEntity: body },
    );
    return client.subscriptions.update(p, options);
  },
  upgradeSubscription: (client, parameters, body, options) => {
    const p = decode(
      operations.UpgradeSubscriptionRequest$outboundSchema,
      operations.UpgradeSubscriptionRequest$inboundSchema,
      { ...parameters, upgradeSubscriptionRequestEntity: body },
    );
    return client.subscriptions.upgrade(p, options);
  },
  pauseSubscription: (client, parameters, body, options) => {
    const p = decode(
      operations.PauseSubscriptionRequest$outboundSchema,
      operations.PauseSubscriptionRequest$inboundSchema,
      parameters,
    );
    return client.subscriptions.pause(p, options);
  },
  resumeSubscription: (client, parameters, body, options) => {
    const p = decode(
      operations.ResumeSubscriptionRequest$outboundSchema,
      operations.ResumeSubscriptionRequest$inboundSchema,
      parameters,
    );
    return client.subscriptions.resume(p, options);
  },
};
