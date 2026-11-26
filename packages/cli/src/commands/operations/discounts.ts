import * as operations from "creem/models/operations";
import { decode, type OperationHandler } from "../../lib/operation";

export const handlers: Record<string, OperationHandler> = {
  searchDiscounts: (client, parameters, body, options) => {
    const p = decode(
      operations.SearchDiscountsRequest$outboundSchema,
      operations.SearchDiscountsRequest$inboundSchema,
      parameters,
    );
    return client.discounts.search(p, options);
  },
  retrieveDiscount: (client, parameters, body, options) => {
    const p = decode(
      operations.RetrieveDiscountRequest$outboundSchema,
      operations.RetrieveDiscountRequest$inboundSchema,
      parameters,
    );
    return client.discounts.get(p, options);
  },
  createDiscount: (client, parameters, body, options) => {
    const p = decode(
      operations.CreateDiscountRequest$outboundSchema,
      operations.CreateDiscountRequest$inboundSchema,
      { ...parameters, createDiscountRequestEntity: body },
    );
    return client.discounts.create(p, options);
  },
  updateDiscount: (client, parameters, body, options) => {
    const p = decode(
      operations.UpdateDiscountRequest$outboundSchema,
      operations.UpdateDiscountRequest$inboundSchema,
      { ...parameters, updateDiscountRequestEntity: body },
    );
    return client.discounts.update(p, options);
  },
  deleteDiscount: (client, parameters, body, options) => {
    const p = decode(
      operations.DeleteDiscountRequest$outboundSchema,
      operations.DeleteDiscountRequest$inboundSchema,
      parameters,
    );
    return client.discounts.delete(p, options);
  },
};
