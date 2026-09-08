import * as components from "creem/models/components";
import * as operations from "creem/models/operations";
import { decode, type OperationHandler } from "../../lib/operation";

export const handlers: Record<string, OperationHandler> = {
  searchDiscounts: (client, parameters, body, options) => {
    const p = decode(
      operations.SearchDiscountsRequest$outboundSchema,
      operations.SearchDiscountsRequest$inboundSchema,
      parameters,
    );
    return client.discounts.search(
      p.pageNumber,
      p.pageSize,
      p.productId,
      p.status,
      p.type,
      p.createdAfter,
      p.createdBefore,
      options,
    );
  },
  retrieveDiscount: (client, parameters, body, options) => {
    const p = decode(
      operations.RetrieveDiscountRequest$outboundSchema,
      operations.RetrieveDiscountRequest$inboundSchema,
      parameters,
    );
    return client.discounts.get(p.discountId, p.discountCode, options);
  },
  createDiscount: (client, parameters, body, options) => {
    const b = decode(
      components.CreateDiscountRequestEntity$outboundSchema,
      components.CreateDiscountRequestEntity$inboundSchema,
      body,
    );
    return client.discounts.create(b, options);
  },
  deleteDiscount: (client, parameters, body, options) => {
    const p = decode(
      operations.DeleteDiscountRequest$outboundSchema,
      operations.DeleteDiscountRequest$inboundSchema,
      parameters,
    );
    return client.discounts.delete(p.id, options);
  },
};
