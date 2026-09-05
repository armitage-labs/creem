import * as components from "creem/models/components";
import * as operations from "creem/models/operations";
import { decode, type OperationHandler } from "../../lib/operation";

export const handlers: Record<string, OperationHandler> = {
  listCustomers: (client, parameters, body, options) => {
    const p = decode(
      operations.ListCustomersRequest$outboundSchema,
      operations.ListCustomersRequest$inboundSchema,
      parameters,
    );
    return client.customers.list(p.pageNumber, p.pageSize, options);
  },
  listCustomerOrders: (client, parameters, body, options) => {
    const p = decode(
      operations.ListCustomerOrdersRequest$outboundSchema,
      operations.ListCustomerOrdersRequest$inboundSchema,
      parameters,
    );
    return client.customers.getOrders(p.id, p.pageNumber, p.pageSize, options);
  },
  listCustomerSubscriptions: (client, parameters, body, options) => {
    const p = decode(
      operations.ListCustomerSubscriptionsRequest$outboundSchema,
      operations.ListCustomerSubscriptionsRequest$inboundSchema,
      parameters,
    );
    return client.customers.listSubscriptions(p.id, p.pageNumber, p.pageSize, options);
  },
  listCustomerLicenses: (client, parameters, body, options) => {
    const p = decode(
      operations.ListCustomerLicensesRequest$outboundSchema,
      operations.ListCustomerLicensesRequest$inboundSchema,
      parameters,
    );
    return client.customers.listLicenses(p.id, p.pageNumber, p.pageSize, options);
  },
  retrieveCustomer: (client, parameters, body, options) => {
    const p = decode(
      operations.RetrieveCustomerRequest$outboundSchema,
      operations.RetrieveCustomerRequest$inboundSchema,
      parameters,
    );
    return client.customers.retrieve(p.customerId, p.email, options);
  },
  createCustomer: (client, parameters, body, options) => {
    const b = decode(
      components.CreateCustomerRequestEntity$outboundSchema,
      components.CreateCustomerRequestEntity$inboundSchema,
      body,
    );
    return client.customers.create(b, options);
  },
  updateCustomer: (client, parameters, body, options) => {
    const b = decode(
      components.UpdateCustomerRequestEntity$outboundSchema,
      components.UpdateCustomerRequestEntity$inboundSchema,
      body,
    );
    return client.customers.update(b, options);
  },
  generateCustomerLinks: (client, parameters, body, options) => {
    const b = decode(
      components.CreateCustomerPortalLinkRequestEntity$outboundSchema,
      components.CreateCustomerPortalLinkRequestEntity$inboundSchema,
      body,
    );
    return client.customers.generateBillingLinks(b, options);
  },
};
