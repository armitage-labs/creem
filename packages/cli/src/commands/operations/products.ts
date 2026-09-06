import * as components from "creem/models/components";
import * as operations from "creem/models/operations";
import { decode, type OperationHandler } from "../../lib/operation";

export const handlers: Record<string, OperationHandler> = {
  searchProducts: (client, parameters, body, options) => {
    const p = decode(
      operations.SearchProductsRequest$outboundSchema,
      operations.SearchProductsRequest$inboundSchema,
      parameters,
    );
    return client.products.search(p.pageNumber, p.pageSize, p.status, options);
  },
  createProduct: (client, parameters, body, options) => {
    const p = decode(
      operations.CreateProductRequest$outboundSchema,
      operations.CreateProductRequest$inboundSchema,
      { ...parameters, createProductRequestEntity: body },
    );
    const b = decode(
      components.CreateProductRequestEntity$outboundSchema,
      components.CreateProductRequestEntity$inboundSchema,
      body,
    );
    return client.products.create(b, p.idempotencyKey, options);
  },
  getProduct: (client, parameters, body, options) => {
    const p = decode(
      operations.GetProductRequest$outboundSchema,
      operations.GetProductRequest$inboundSchema,
      parameters,
    );
    return client.products.get(p.id, options);
  },
  updateProduct: (client, parameters, body, options) => {
    const p = decode(
      operations.UpdateProductRequest$outboundSchema,
      operations.UpdateProductRequest$inboundSchema,
      { ...parameters, updateProductRequestEntity: body },
    );
    const b = decode(
      components.UpdateProductRequestEntity$outboundSchema,
      components.UpdateProductRequestEntity$inboundSchema,
      body,
    );
    return client.products.update(p.id, b, options);
  },
  archiveProduct: (client, parameters, body, options) => {
    const p = decode(
      operations.ArchiveProductRequest$outboundSchema,
      operations.ArchiveProductRequest$inboundSchema,
      parameters,
    );
    return client.products.archive(p.id, options);
  },
};
