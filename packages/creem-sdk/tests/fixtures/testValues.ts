// Test API Keys
export const TEST_API_KEY: string = process.env.TEST_API_KEY || (() => {
  throw new Error("TEST_API_KEY environment variable is required");
})();
export const INVALID_API_KEY: string = "creem_fail";

// Test Customer Data
export const TEST_CUSTOMER_ID: string = "cust_5Zpsw2YQqCpGi2ejdakZd3";
export const TEST_CUSTOMER_EMAIL: string = "dedeko@gmail.com";

// Test Product Data
export const TEST_PRODUCT_SUBSCRIPTION_ID: string =
  "prod_2hylKLdUiHcMBdIKyKDtqy";

// Test Subscription Data
export const TEST_SUBSCRIPTION_ID: string = "sub_1ErGy6Xo1uv2JKZlfiGP03";

// Test License Data
export const TEST_LICENSE_KEY: string = "5S6UK-87H0Z-DLVDI-IW4OZ-EWXNS";
export const TEST_INSTANCE_NAME: string = "LICENSE0";

// Test Transaction Data
export const TEST_ORDER_ID: string = "ord_bER6x088zTFRL76JGdFVv";

// Server Configuration
export const TEST_SERVER_IDX: number = 1;
export const TEST_MODE: string = "test";

export const TEST_CHECKOUT_ID_RECURRING: string = "ch_15UGAdf4Gfa1jscpQqvGW9";
export const TEST_CHECKOUT_ID_ONE_TIME: string = "ch_2Tpem7XokBz1DRX7YIQFo5";
