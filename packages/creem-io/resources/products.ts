import { RequestFn } from "../types/core";
import {
  CreateProductRequest,
  GetProductRequest,
  ListProductsRequest,
  SearchProductsRequest,
  Product,
  ProductList,
} from "../types";
import { required, requiredWhen, isString, isNumber, isBoolean, isArray } from "../validate";

export const productsResource = (request: RequestFn) => ({
  list: (params: ListProductsRequest = {}) => {
    isNumber(params.page, "page");
    isNumber(params.limit, "limit");

    return request<ProductList>("GET", "/v1/products/search", undefined, {
      page_number: params.page,
      page_size: params.limit,
    });
  },
  search: (params: SearchProductsRequest = {}) => {
    isString(params.query, "query");
    isNumber(params.page, "page");
    isNumber(params.limit, "limit");

    return request<ProductList>("GET", "/v1/products/search", undefined, {
      query: params.query,
      page_number: params.page,
      page_size: params.limit,
    });
  },
  get: (params: GetProductRequest) => {
    required(params.productId, "productId");
    isString(params.productId, "productId");

    return request<Product>("GET", "/v1/products", undefined, {
      product_id: params.productId,
    });
  },
  create: (params: CreateProductRequest) => {
    required(params.name, "name");
    isString(params.name, "name");
    isString(params.imageUrl, "imageUrl");

    required(params.description, "description");
    isString(params.description, "description");

    required(params.price, "price");
    isNumber(params.price, "price");

    required(params.currency, "currency");
    isString(params.currency, "currency");

    required(params.billingType, "billingType");
    isString(params.billingType, "billingType");

    // Validation logic: billingPeriod is required when billingType is "recurring"
    if (params.billingType === "recurring") {
      requiredWhen(params.billingPeriod, "billingPeriod", "billingType is 'recurring'");
      isString(params.billingPeriod, "billingPeriod");
    }

    isString(params.taxMode, "taxMode");
    isString(params.taxCategory, "taxCategory");
    isString(params.defaultSuccessUrl, "defaultSuccessUrl");
    isArray(params.customField, "customField");
    isBoolean(params.abandonedCartRecoveryEnabled, "abandonedCartRecoveryEnabled");

    return request<Product>("POST", "/v1/products", {
      name: params.name,
      description: params.description,
      image_url: params.imageUrl,
      price: params.price,
      currency: params.currency,
      billing_type: params.billingType,
      billing_period: params.billingPeriod,
      tax_mode: params.taxMode,
      tax_category: params.taxCategory,
      default_success_url: params.defaultSuccessUrl,
      custom_field: params.customField,
      abandoned_cart_recovery_enabled: params.abandonedCartRecoveryEnabled,
    });
  },
});
