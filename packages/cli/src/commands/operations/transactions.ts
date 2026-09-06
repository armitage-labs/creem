import * as components from "creem/models/components";
import * as operations from "creem/models/operations";
import { decode, type OperationHandler } from "../../lib/operation";

export const handlers: Record<string, OperationHandler> = {
  getTransactionById: (client, parameters, body, options) => {
    const p = decode(
      operations.GetTransactionByIdRequest$outboundSchema,
      operations.GetTransactionByIdRequest$inboundSchema,
      parameters,
    );
    return client.transactions.getById(p.transactionId, options);
  },
  searchTransactions: (client, parameters, body, options) => {
    const p = decode(
      operations.SearchTransactionsRequest$outboundSchema,
      operations.SearchTransactionsRequest$inboundSchema,
      parameters,
    );
    return client.transactions.search(
      p.customerId,
      p.orderId,
      p.productId,
      p.pageNumber,
      p.pageSize,
      options,
    );
  },
  refundPayment: (client, parameters, body, options) => {
    const b = decode(
      components.CreateRefundRequestEntity$outboundSchema,
      components.CreateRefundRequestEntity$inboundSchema,
      body,
    );
    return client.transactions.refund(b, options);
  },
};
