import * as operations from "creem/models/operations";
import { decode, type OperationHandler } from "../../lib/operation";

export const handlers: Record<string, OperationHandler> = {
  listProductGroups: (client, parameters, body, options) => {
    const p = decode(
      operations.ListProductGroupsRequest$outboundSchema,
      operations.ListProductGroupsRequest$inboundSchema,
      parameters,
    );
    return client.productGroups.list(p, options);
  },
  getProductGroup: (client, parameters, body, options) => {
    const p = decode(
      operations.GetProductGroupRequest$outboundSchema,
      operations.GetProductGroupRequest$inboundSchema,
      parameters,
    );
    return client.productGroups.get(p, options);
  },
  createProductGroup: (client, parameters, body, options) => {
    const p = decode(
      operations.CreateProductGroupRequest$outboundSchema,
      operations.CreateProductGroupRequest$inboundSchema,
      { ...parameters, createProductGroupRequestEntity: body },
    );
    return client.productGroups.create(p, options);
  },
  updateProductGroup: (client, parameters, body, options) => {
    const p = decode(
      operations.UpdateProductGroupRequest$outboundSchema,
      operations.UpdateProductGroupRequest$inboundSchema,
      { ...parameters, updateProductGroupRequestEntity: body },
    );
    return client.productGroups.update(p, options);
  },
  deleteProductGroup: (client, parameters, body, options) => {
    const p = decode(
      operations.DeleteProductGroupRequest$outboundSchema,
      operations.DeleteProductGroupRequest$inboundSchema,
      parameters,
    );
    return client.productGroups.delete(p, options);
  },
  addProductToProductGroup: (client, parameters, body, options) => {
    const p = decode(
      operations.AddProductToProductGroupRequest$outboundSchema,
      operations.AddProductToProductGroupRequest$inboundSchema,
      { ...parameters, requestBody: body },
    );
    return client.productGroups.addProduct(p, options);
  },
  removeProductFromProductGroup: (client, parameters, body, options) => {
    const p = decode(
      operations.RemoveProductFromProductGroupRequest$outboundSchema,
      operations.RemoveProductFromProductGroupRequest$inboundSchema,
      parameters,
    );
    return client.productGroups.removeProduct(p, options);
  },
};
