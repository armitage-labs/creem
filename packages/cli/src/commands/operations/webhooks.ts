import * as components from "creem/models/components";
import * as operations from "creem/models/operations";
import { decode, type OperationHandler } from "../../lib/operation";

export const handlers: Record<string, OperationHandler> = {
  listWebhooks: (client, parameters, body, options) => {
    const p = decode(
      operations.ListWebhooksRequest$outboundSchema,
      operations.ListWebhooksRequest$inboundSchema,
      parameters,
    );
    return client.webhooks.list(p, options);
  },
  createWebhook: (client, parameters, body, options) => {
    const b = decode(
      components.CreateWebhookRequestEntity$outboundSchema,
      components.CreateWebhookRequestEntity$inboundSchema,
      body,
    );
    return client.webhooks.create(b, options);
  },
  getWebhook: (client, parameters, body, options) => {
    const p = decode(
      operations.GetWebhookRequest$outboundSchema,
      operations.GetWebhookRequest$inboundSchema,
      parameters,
    );
    return client.webhooks.get(p, options);
  },
  updateWebhook: (client, parameters, body, options) => {
    const p = decode(
      operations.UpdateWebhookRequest$outboundSchema,
      operations.UpdateWebhookRequest$inboundSchema,
      { ...parameters, updateWebhookRequestEntity: body },
    );
    return client.webhooks.update(p, options);
  },
  deleteWebhook: (client, parameters, body, options) => {
    const p = decode(
      operations.DeleteWebhookRequest$outboundSchema,
      operations.DeleteWebhookRequest$inboundSchema,
      parameters,
    );
    return client.webhooks.delete(p, options);
  },
  getWebhookSecret: (client, parameters, body, options) => {
    const p = decode(
      operations.GetWebhookSecretRequest$outboundSchema,
      operations.GetWebhookSecretRequest$inboundSchema,
      parameters,
    );
    return client.webhooks.getSecret(p, options);
  },
  listPendingWebhookEvents: (client, parameters, body, options) => {
    const p = decode(
      operations.ListPendingWebhookEventsRequest$outboundSchema,
      operations.ListPendingWebhookEventsRequest$inboundSchema,
      parameters,
    );
    return client.webhooks.listPendingEvents(p, options);
  },
  acknowledgeWebhookEvent: (client, parameters, body, options) => {
    const p = decode(
      operations.AcknowledgeWebhookEventRequest$outboundSchema,
      operations.AcknowledgeWebhookEventRequest$inboundSchema,
      { ...parameters, acknowledgeWebhookEventRequestEntity: body },
    );
    return client.webhooks.acknowledgeEvent(p, options);
  },
};
