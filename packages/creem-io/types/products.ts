import { BaseEntity, Pagination } from "./general";
import { License } from "./licenses";

/**
 * Product feature entity
 */
export interface Feature {
  /** Unique identifier for the feature */
  id: string;
  /** The feature type */
  type: "custom" | "file" | "licenseKey";
  /** A brief description of the feature */
  description: string;
}

/**
 * Product entity
 */
export interface Product extends BaseEntity {
  /** String representing the object's type */
  object: "product";
  /** The name of the product */
  name: string;
  /** A brief description of the product */
  description: string;
  /** URL of the product image. Only png and jpg are supported */
  imageUrl?: string;
  /** Features of the product */
  features?: Feature[];
  /** The price of the product in cents. 1000 = $10.00 */
  price: number;
  /** Three-letter ISO currency code, in uppercase */
  currency: string;
  /** Billing method: recurring or onetime */
  billingType: "recurring" | "onetime";
  /** Billing period */
  billingPeriod: "every-month" | "every-three-months" | "every-six-months" | "every-year" | "once";
  /** Status of the product */
  status: "active" | "archived";
  /** Tax calculation mode */
  taxMode: "inclusive" | "exclusive";
  /** Tax category for the product */
  taxCategory: "saas" | "digital-goods-service" | "ebooks";
  /** The product page URL for express checkout */
  productUrl?: string;
  /** The URL to redirect after successful payment */
  defaultSuccessUrl?: string;
  /** Creation date of the product */
  createdAt: Date;
  /** Last updated date of the product */
  updatedAt: Date;
}

/**
 * File entity within a file feature
 */
export interface FeatureFile {
  /** Unique identifier for the file */
  id: string;
  /** The name of the file */
  fileName: string;
  /** The URL to download the file */
  url: string;
  /** The MIME type of the file */
  type: string;
  /** The size of the file in bytes */
  size: number;
}

/**
 * File feature entity containing downloadable files
 */
export interface FileFeature {
  /** List of downloadable files */
  files: FeatureFile[];
}

/**
 * Product feature entity (issued for orders)
 */
export interface ProductFeature {
  /** Unique identifier for the feature */
  id?: string | null;
  /** A brief description of the feature */
  description?: string | null;
  /** The feature type */
  type?: "custom" | "file" | "licenseKey" | null;
  /** Private note from the seller, visible to customer after purchase */
  privateNote?: string | null;
  /** File feature data containing downloadable files */
  file?: FileFeature | null;
  /** License key issued for the order */
  licenseKey?: License | null;
  /**
   * @deprecated Use `licenseKey` instead
   */
  license?: License | null;
}

/**
 * Product list response
 */
export interface ProductList {
  /** List of products */
  items: Product[];
  /** Pagination details */
  pagination: Pagination;
}

/**
 * Request payload for listing products
 */
export interface ListProductsRequest {
  /** Page number for pagination */
  page?: number;
  /** Number of items per page */
  limit?: number;
}

/**
 * Request payload for searching products
 */
export interface SearchProductsRequest {
  /** Search query string */
  query?: string;
  /** Page number for pagination */
  page?: number;
  /** Number of items per page */
  limit?: number;
}

/**
 * Request payload for retrieving a product
 */
export interface GetProductRequest {
  /** The product ID to retrieve */
  productId: string;
}

/**
 * Custom field definition for product creation
 */
export interface CustomFieldDefinition {
  /** The type of the field */
  type: "text" | "checkbox";
  /** Unique key for custom field. Must be unique to this field, alphanumeric, and up to 200 characters. */
  key: string;
  /** The label for the field, displayed to the customer, up to 50 characters */
  label: string;
  /** Whether the customer is required to complete the field. Defaults to `false` */
  optional?: boolean;
  /** Configuration for text field type */
  text?: {
    maxLength?: number;
    minLength?: number;
  };
  /** Configuration for checkbox field type */
  checkbox?: {
    label?: string;
  };
}

/**
 * Request payload for creating a product
 */
export interface CreateProductRequest {
  /** The name of the product */
  name: string;
  /** A brief description of the product */
  description?: string;
  /** URL of the product image */
  imageUrl?: string;
  /** The price of the product in cents. 1000 = $10.00 */
  price: number;
  /** Three-letter ISO currency code, in uppercase */
  currency: string;
  /** Billing method: recurring or onetime */
  billingType: "recurring" | "onetime";
  /** Billing period (required when billingType is "recurring") */
  billingPeriod?: "every-month" | "every-three-months" | "every-six-months" | "every-year" | "once";
  /** Tax calculation mode */
  taxMode?: "inclusive" | "exclusive";
  /** Tax category for the product */
  taxCategory?: "saas" | "digital-goods-service" | "ebooks";
  /** The URL to redirect after successful payment */
  defaultSuccessUrl?: string;
  /** Custom fields for the product */
  customField?: CustomFieldDefinition[];
  /** Whether abandoned cart recovery is enabled */
  abandonedCartRecoveryEnabled?: boolean;
}
