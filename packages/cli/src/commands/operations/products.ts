import * as operations from "creem/models/operations";
import { decode, type OperationHandler } from "../../lib/operation";

export const handlers: Record<string, OperationHandler> = {
  searchProducts: (client, parameters, body, options) => {
    const p = decode(
      operations.SearchProductsRequest$outboundSchema,
      operations.SearchProductsRequest$inboundSchema,
      parameters,
    );
    return client.products.search(p, options);
  },
  createProduct: (client, parameters, body, options) => {
    const p = decode(
      operations.CreateProductRequest$outboundSchema,
      operations.CreateProductRequest$inboundSchema,
      { ...parameters, createProductRequestEntity: body },
    );
    return client.products.create(p, options);
  },
  getProduct: (client, parameters, body, options) => {
    const p = decode(
      operations.GetProductRequest$outboundSchema,
      operations.GetProductRequest$inboundSchema,
      parameters,
    );
    return client.products.get(p, options);
  },
  updateProduct: (client, parameters, body, options) => {
    const p = decode(
      operations.UpdateProductRequest$outboundSchema,
      operations.UpdateProductRequest$inboundSchema,
      { ...parameters, updateProductRequestEntity: body },
    );
    return client.products.update(p, options);
  },
  archiveProduct: (client, parameters, body, options) => {
    const p = decode(
      operations.ArchiveProductRequest$outboundSchema,
      operations.ArchiveProductRequest$inboundSchema,
      parameters,
    );
    return client.products.archive(p, options);
  },
};
