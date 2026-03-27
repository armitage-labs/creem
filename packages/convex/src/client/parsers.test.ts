import { describe, it, expect } from "vitest";
import {
  getEventType,
  getEventData,
  getCustomerId,
  getConvexEntityId,
  parseSubscription,
  manualParseSubscription,
  parseCheckout,
  parseProduct,
} from "./parsers.js";

// ── Real webhook payloads from Creem test mode ──────────────────────

const CHECKOUT_COMPLETED = {
  id: "evt_3AEBNwl6xjy2VWoNy17RV4",
  eventType: "checkout.completed",
  created_at: 1772265126979,
  object: {
    id: "ch_6u5rCq19LEsXpltlDGtc9Y",
    object: "checkout",
    request_id: "6e75be93-e116-4f30-9d83-c6a5a0021f90",
    order: {
      object: "order",
      id: "ord_7ZKxZkpnNcs0d1TxbBPcr0",
      customer: "cust_6aVJrSJi8h9r7cGzWPVBF0",
      product: "prod_35PR89LmiAjsR8JJwO7uM7",
      amount: 2999,
      currency: "USD",
      sub_total: 2999,
      tax_amount: 500,
      amount_due: 2999,
      amount_paid: 2999,
      status: "paid",
      type: "onetime",
      transaction: "tran_78fYacdKnQu3Bw3wOwtG60",
      created_at: "2026-02-28T07:52:06.979Z",
      updated_at: "2026-02-28T07:52:06.979Z",
      mode: "test",
    },
    product: {
      id: "prod_35PR89LmiAjsR8JJwO7uM7",
      object: "product",
      name: "Test Product",
      description: "A test product for webhook simulation",
      price: 2999,
      currency: "USD",
      billing_type: "onetime",
      billing_period: "once",
      status: "active",
      tax_mode: "exclusive",
      tax_category: "saas",
      default_success_url: null,
      created_at: "2026-02-28T07:52:06.979Z",
      updated_at: "2026-02-28T07:52:06.979Z",
      mode: "test",
    },
    units: 1,
    success_url: "https://example.com/success",
    customer: {
      id: "cust_6aVJrSJi8h9r7cGzWPVBF0",
      object: "customer",
      email: "test-customer@creem.io",
      name: "Test Customer",
      country: "US",
      created_at: "2026-02-28T07:52:06.979Z",
      updated_at: "2026-02-28T07:52:06.979Z",
      mode: "test",
    },
    status: "completed",
    mode: "test",
  },
};

const SUBSCRIPTION_ACTIVE = {
  id: "evt_3eqtj3OyzwBTBlXp1xjVu1",
  eventType: "subscription.active",
  created_at: 1772265324184,
  object: {
    id: "sub_35c5ooVUuIUtru83zXjrjC",
    object: "subscription",
    product: {
      id: "prod_3prhYLElQzQaZMq7pePQqf",
      object: "product",
      name: "Test Subscription Product",
      description: "A test product for webhook simulation",
      price: 2999,
      currency: "USD",
      billing_type: "recurring",
      billing_period: "once",
      status: "active",
      tax_mode: "exclusive",
      tax_category: "saas",
      default_success_url: null,
      created_at: "2026-02-28T07:55:24.184Z",
      updated_at: "2026-02-28T07:55:24.184Z",
      mode: "test",
    },
    customer: {
      id: "cust_50fklVtISQkWoAydmZ1LJb",
      object: "customer",
      email: "test-customer@creem.io",
      name: "Test Customer",
      country: "US",
      created_at: "2026-02-28T07:55:24.184Z",
      updated_at: "2026-02-28T07:55:24.184Z",
      mode: "test",
    },
    collection_method: "charge_automatically",
    status: "active",
    last_transaction_id: "tran_2Fi2fZAyHUl9Q10l55uwUp",
    last_transaction: {
      id: "tran_2Fi2fZAyHUl9Q10l55uwUp",
      object: "transaction",
      amount: 2999,
      amount_paid: 2999,
      currency: "USD",
      type: "invoice",
      tax_country: "US",
      tax_amount: 500,
      status: "paid",
      refunded_amount: null,
      order: "ord_6lP07Pso8FLsMBpoorgVw",
      subscription: "sub_35c5ooVUuIUtru83zXjrjC",
      customer: null,
      description: "Subscription payment",
      period_start: 1772265324184,
      period_end: 1774857324184,
      created_at: 1772265324184,
      mode: "test",
    },
    last_transaction_date: "2026-02-28T07:55:24.184Z",
    next_transaction_date: "2026-03-30T07:55:24.184Z",
    current_period_start_date: "2026-02-28T07:55:24.184Z",
    current_period_end_date: "2026-03-30T07:55:24.184Z",
    canceled_at: null,
    created_at: "2026-02-28T07:55:24.184Z",
    updated_at: "2026-02-28T07:55:24.184Z",
    mode: "test",
  },
};

const SUBSCRIPTION_TRIALING = {
  id: "evt_3LfSrvVOs1SS686wPDeDnD",
  eventType: "subscription.trialing",
  created_at: 1772265341859,
  object: {
    id: "sub_21mGtm0fBnaCSyGpsczjr6",
    object: "subscription",
    product: {
      id: "prod_6ZmY2cEp3XdlhhPiTrNKyj",
      object: "product",
      name: "Test Subscription Product",
      description: "A test product for webhook simulation",
      price: 2999,
      currency: "USD",
      billing_type: "recurring",
      billing_period: "once",
      status: "active",
      tax_mode: "exclusive",
      tax_category: "saas",
      default_success_url: null,
      created_at: "2026-02-28T07:55:41.859Z",
      updated_at: "2026-02-28T07:55:41.859Z",
      mode: "test",
    },
    customer: {
      id: "cust_1aNp6ya9HlZjWCHr4guWkJ",
      object: "customer",
      email: "test-customer@creem.io",
      name: "Test Customer",
      country: "US",
      created_at: "2026-02-28T07:55:41.859Z",
      updated_at: "2026-02-28T07:55:41.859Z",
      mode: "test",
    },
    collection_method: "charge_automatically",
    status: "trialing",
    last_transaction_id: "tran_5WE9hHhjebUOybbOeD5NH4",
    last_transaction: {
      id: "tran_5WE9hHhjebUOybbOeD5NH4",
      object: "transaction",
      amount: 2999,
      amount_paid: 2999,
      currency: "USD",
      type: "invoice",
      tax_country: "US",
      tax_amount: 500,
      status: "paid",
      refunded_amount: null,
      order: "ord_LftfECp6zxFPzrQQsOP2g",
      subscription: "sub_21mGtm0fBnaCSyGpsczjr6",
      customer: null,
      description: "Subscription payment",
      period_start: 1772265341859,
      period_end: 1774857341859,
      created_at: 1772265341859,
      mode: "test",
    },
    last_transaction_date: "2026-02-28T07:55:41.859Z",
    next_transaction_date: "2026-03-30T07:55:41.859Z",
    current_period_start_date: "2026-02-28T07:55:41.859Z",
    current_period_end_date: "2026-03-30T07:55:41.859Z",
    canceled_at: null,
    created_at: "2026-02-28T07:55:41.859Z",
    updated_at: "2026-02-28T07:55:41.859Z",
    mode: "test",
  },
};

const SUBSCRIPTION_CANCELED = {
  id: "evt_4Cdkj8fnfW9VbAYLDtV42A",
  eventType: "subscription.canceled",
  created_at: 1772265355057,
  object: {
    id: "sub_5PHyfaaDkDUmAsKdbH8mZZ",
    object: "subscription",
    product: {
      id: "prod_3Hj6Hd2higtUp5f4gi50vR",
      object: "product",
      name: "Test Subscription Product",
      description: "A test product for webhook simulation",
      price: 2999,
      currency: "USD",
      billing_type: "recurring",
      billing_period: "once",
      status: "active",
      tax_mode: "exclusive",
      tax_category: "saas",
      default_success_url: null,
      created_at: "2026-02-28T07:55:55.057Z",
      updated_at: "2026-02-28T07:55:55.057Z",
      mode: "test",
    },
    customer: {
      id: "cust_3TfrBYcWhn9oX22YP8B5Hc",
      object: "customer",
      email: "test-customer@creem.io",
      name: "Test Customer",
      country: "US",
      created_at: "2026-02-28T07:55:55.057Z",
      updated_at: "2026-02-28T07:55:55.057Z",
      mode: "test",
    },
    collection_method: "charge_automatically",
    status: "canceled",
    last_transaction_id: "tran_53An6EaIasufdERUPSjWK0",
    last_transaction: {
      id: "tran_53An6EaIasufdERUPSjWK0",
      object: "transaction",
      amount: 2999,
      amount_paid: 2999,
      currency: "USD",
      type: "invoice",
      tax_country: "US",
      tax_amount: 500,
      status: "paid",
      refunded_amount: null,
      order: "ord_sIJBcoMp1MB1zlkQTHlFz",
      subscription: "sub_5PHyfaaDkDUmAsKdbH8mZZ",
      customer: null,
      description: "Subscription payment",
      period_start: 1772265355057,
      period_end: 1774857355057,
      created_at: 1772265355057,
      mode: "test",
    },
    last_transaction_date: "2026-02-28T07:55:55.057Z",
    current_period_start_date: "2026-02-28T07:55:55.057Z",
    current_period_end_date: "2026-03-30T07:55:55.057Z",
    canceled_at: "2026-02-28T07:55:55.057Z",
    created_at: "2026-02-28T07:55:55.057Z",
    updated_at: "2026-02-28T07:55:55.057Z",
    mode: "test",
  },
};

const SUBSCRIPTION_SCHEDULED_CANCEL = {
  id: "evt_1o5z94w73NT0MFw8PUCuZt",
  eventType: "subscription.scheduled_cancel",
  created_at: 1772265367282,
  object: {
    id: "sub_5Nq3ne8vXuL0FvU356xKMc",
    object: "subscription",
    product: {
      id: "prod_6naBoKRxbNHIWRhWFKe7ps",
      object: "product",
      name: "Test Subscription Product",
      description: "A test product for webhook simulation",
      price: 2999,
      currency: "USD",
      billing_type: "recurring",
      billing_period: "once",
      status: "active",
      tax_mode: "exclusive",
      tax_category: "saas",
      default_success_url: null,
      created_at: "2026-02-28T07:56:07.282Z",
      updated_at: "2026-02-28T07:56:07.282Z",
      mode: "test",
    },
    customer: {
      id: "cust_1NymKnwUkMBmmA0uJJTy7t",
      object: "customer",
      email: "test-customer@creem.io",
      name: "Test Customer",
      country: "US",
      created_at: "2026-02-28T07:56:07.282Z",
      updated_at: "2026-02-28T07:56:07.282Z",
      mode: "test",
    },
    collection_method: "charge_automatically",
    status: "scheduled_cancel",
    last_transaction_id: "tran_3jEKznrYGcci29IZ7de5TL",
    last_transaction: {
      id: "tran_3jEKznrYGcci29IZ7de5TL",
      object: "transaction",
      amount: 2999,
      amount_paid: 2999,
      currency: "USD",
      type: "invoice",
      tax_country: "US",
      tax_amount: 500,
      status: "paid",
      refunded_amount: null,
      order: "ord_xb6v7H75p0OT8dM25dmz5",
      subscription: "sub_5Nq3ne8vXuL0FvU356xKMc",
      customer: null,
      description: "Subscription payment",
      period_start: 1772265367282,
      period_end: 1774857367282,
      created_at: 1772265367282,
      mode: "test",
    },
    last_transaction_date: "2026-02-28T07:56:07.282Z",
    next_transaction_date: "2026-03-30T07:56:07.282Z",
    current_period_start_date: "2026-02-28T07:56:07.282Z",
    current_period_end_date: "2026-03-30T07:56:07.282Z",
    canceled_at: null,
    created_at: "2026-02-28T07:56:07.282Z",
    updated_at: "2026-02-28T07:56:07.282Z",
    mode: "test",
  },
};

const SUBSCRIPTION_UNPAID = {
  id: "evt_h9hBneNdvWvA8hQzIBzDx",
  eventType: "subscription.unpaid",
  created_at: 1772265400331,
  object: {
    id: "sub_3xx35QzxsnpFiJ3vRB9YKt",
    object: "subscription",
    product: {
      id: "prod_L8mMzoYLOOZpMpTBwGw0k",
      object: "product",
      name: "Test Subscription Product",
      description: "A test product for webhook simulation",
      price: 2999,
      currency: "USD",
      billing_type: "recurring",
      billing_period: "once",
      status: "active",
      tax_mode: "exclusive",
      tax_category: "saas",
      default_success_url: null,
      created_at: "2026-02-28T07:56:40.331Z",
      updated_at: "2026-02-28T07:56:40.331Z",
      mode: "test",
    },
    customer: {
      id: "cust_ubD9UtnJpafXNKQ5UaV0H",
      object: "customer",
      email: "test-customer@creem.io",
      name: "Test Customer",
      country: "US",
      created_at: "2026-02-28T07:56:40.331Z",
      updated_at: "2026-02-28T07:56:40.331Z",
      mode: "test",
    },
    collection_method: "charge_automatically",
    status: "unpaid",
    last_transaction_id: "tran_6uBkPewvO7KHjfvGmpin82",
    last_transaction: {
      id: "tran_6uBkPewvO7KHjfvGmpin82",
      object: "transaction",
      amount: 2999,
      amount_paid: 2999,
      currency: "USD",
      type: "invoice",
      tax_country: "US",
      tax_amount: 500,
      status: "paid",
      refunded_amount: null,
      order: "ord_2vglgbdNf1LXb3jrzt2IF8",
      subscription: "sub_3xx35QzxsnpFiJ3vRB9YKt",
      customer: null,
      description: "Subscription payment",
      period_start: 1772265400331,
      period_end: 1774857400331,
      created_at: 1772265400331,
      mode: "test",
    },
    last_transaction_date: "2026-02-28T07:56:40.331Z",
    next_transaction_date: "2026-03-30T07:56:40.331Z",
    current_period_start_date: "2026-02-28T07:56:40.331Z",
    current_period_end_date: "2026-03-30T07:56:40.331Z",
    canceled_at: null,
    created_at: "2026-02-28T07:56:40.331Z",
    updated_at: "2026-02-28T07:56:40.331Z",
    mode: "test",
  },
};

const SUBSCRIPTION_PAST_DUE = {
  id: "evt_6hBqmAW43oDq570C4cg3JY",
  eventType: "subscription.past_due",
  created_at: 1772265419487,
  object: {
    id: "sub_1WRdOPrNNefOsSXDbPVi2d",
    object: "subscription",
    product: {
      id: "prod_5Oq9fobvw8LxP8MvFQW70n",
      object: "product",
      name: "Test Subscription Product",
      description: "A test product for webhook simulation",
      price: 2999,
      currency: "USD",
      billing_type: "recurring",
      billing_period: "once",
      status: "active",
      tax_mode: "exclusive",
      tax_category: "saas",
      default_success_url: null,
      created_at: "2026-02-28T07:56:59.487Z",
      updated_at: "2026-02-28T07:56:59.487Z",
      mode: "test",
    },
    customer: {
      id: "cust_66csf9rxiSwQhxOYIZCO4J",
      object: "customer",
      email: "test-customer@creem.io",
      name: "Test Customer",
      country: "US",
      created_at: "2026-02-28T07:56:59.487Z",
      updated_at: "2026-02-28T07:56:59.487Z",
      mode: "test",
    },
    collection_method: "charge_automatically",
    status: "past_due",
    last_transaction_id: "tran_5OBGhff2drYg55J4LTdpC9",
    last_transaction: {
      id: "tran_5OBGhff2drYg55J4LTdpC9",
      object: "transaction",
      amount: 2999,
      amount_paid: 2999,
      currency: "USD",
      type: "invoice",
      tax_country: "US",
      tax_amount: 500,
      status: "paid",
      refunded_amount: null,
      order: "ord_5Afy6CLdSbAaKLLfAkr7rS",
      subscription: "sub_1WRdOPrNNefOsSXDbPVi2d",
      customer: null,
      description: "Subscription payment",
      period_start: 1772265419487,
      period_end: 1774857419487,
      created_at: 1772265419487,
      mode: "test",
    },
    last_transaction_date: "2026-02-28T07:56:59.487Z",
    next_transaction_date: "2026-03-30T07:56:59.487Z",
    current_period_start_date: "2026-02-28T07:56:59.487Z",
    current_period_end_date: "2026-03-30T07:56:59.487Z",
    canceled_at: null,
    created_at: "2026-02-28T07:56:59.487Z",
    updated_at: "2026-02-28T07:56:59.487Z",
    mode: "test",
  },
};

const SUBSCRIPTION_PAUSED = {
  id: "evt_390hPwy7T6xdnUat7LnL0V",
  eventType: "subscription.paused",
  created_at: 1772265436355,
  object: {
    id: "sub_4yINJXEk48ie8UrVXW6Hki",
    object: "subscription",
    product: {
      id: "prod_4kwc63La2Hz9CW2lHYGuLT",
      object: "product",
      name: "Test Subscription Product",
      description: "A test product for webhook simulation",
      price: 2999,
      currency: "USD",
      billing_type: "recurring",
      billing_period: "once",
      status: "active",
      tax_mode: "exclusive",
      tax_category: "saas",
      default_success_url: null,
      created_at: "2026-02-28T07:57:16.355Z",
      updated_at: "2026-02-28T07:57:16.355Z",
      mode: "test",
    },
    customer: {
      id: "cust_2tPZEqKOIuXW4ZVuO9aezw",
      object: "customer",
      email: "test-customer@creem.io",
      name: "Test Customer",
      country: "US",
      created_at: "2026-02-28T07:57:16.355Z",
      updated_at: "2026-02-28T07:57:16.355Z",
      mode: "test",
    },
    collection_method: "charge_automatically",
    status: "paused",
    last_transaction_id: "tran_5IBycUgI0ffpwPJrynSsZE",
    last_transaction: {
      id: "tran_5IBycUgI0ffpwPJrynSsZE",
      object: "transaction",
      amount: 2999,
      amount_paid: 2999,
      currency: "USD",
      type: "invoice",
      tax_country: "US",
      tax_amount: 500,
      status: "paid",
      refunded_amount: null,
      order: "ord_7gBxgjGj76o6LO2iAlvqXd",
      subscription: "sub_4yINJXEk48ie8UrVXW6Hki",
      customer: null,
      description: "Subscription payment",
      period_start: 1772265436355,
      period_end: 1774857436355,
      created_at: 1772265436355,
      mode: "test",
    },
    last_transaction_date: "2026-02-28T07:57:16.355Z",
    next_transaction_date: "2026-03-30T07:57:16.355Z",
    current_period_start_date: "2026-02-28T07:57:16.355Z",
    current_period_end_date: "2026-03-30T07:57:16.355Z",
    canceled_at: null,
    created_at: "2026-02-28T07:57:16.355Z",
    updated_at: "2026-02-28T07:57:16.355Z",
    mode: "test",
  },
};

const REFUND_CREATED = {
  id: "evt_2IW5Ur2LYdq3AQDgMyeV3j",
  eventType: "refund.created",
  created_at: 1772265452403,
  object: {
    id: "ref_1mqUZAF4STf0CpHFzT5Qs0",
    object: "refund",
    status: "succeeded",
    refund_amount: 2999,
    refund_currency: "USD",
    reason: "requested_by_customer",
    transaction: {
      id: "tran_3x6ImUPFqSe93cv2z40V2O",
      object: "transaction",
      amount: 2999,
      amount_paid: 2999,
      currency: "USD",
      type: "payment",
      tax_country: "US",
      tax_amount: 500,
      status: "paid",
      refunded_amount: null,
      order: "ord_49E2Q97ydLjZJbPoERGGWl",
      customer: null,
      description: "One-time payment",
      created_at: 1772265452403,
      mode: "test",
    },
    order: {
      object: "order",
      id: "ord_49E2Q97ydLjZJbPoERGGWl",
      customer: "cust_5CApbQUEDoejRwCvbTUGy4",
      product: "prod_7krsbs3yJ0j2SPYuzhlPs5",
      amount: 2999,
      currency: "USD",
      sub_total: 2999,
      tax_amount: 500,
      amount_due: 2999,
      amount_paid: 2999,
      status: "paid",
      type: "onetime",
      transaction: "tran_3x6ImUPFqSe93cv2z40V2O",
      created_at: "2026-02-28T07:57:32.403Z",
      updated_at: "2026-02-28T07:57:32.403Z",
      mode: "test",
    },
    customer: {
      id: "cust_5CApbQUEDoejRwCvbTUGy4",
      object: "customer",
      email: "test-customer@creem.io",
      name: "Test Customer",
      country: "US",
      created_at: "2026-02-28T07:57:32.403Z",
      updated_at: "2026-02-28T07:57:32.403Z",
      mode: "test",
    },
    created_at: 1772265452403,
    mode: "test",
  },
};

const DISPUTE_CREATED = {
  id: "evt_13PSy7K8v9t2rOblwcse52",
  eventType: "dispute.created",
  created_at: 1772265464066,
  object: {
    id: "disp_26jKdaVrGiOQ0qsZ1CUckR",
    object: "dispute",
    amount: 2999,
    currency: "USD",
    transaction: {
      id: "tran_125zeFXV7V3wQTOQcmwwUN",
      object: "transaction",
      amount: 2999,
      amount_paid: 2999,
      currency: "USD",
      type: "payment",
      tax_country: "US",
      tax_amount: 500,
      status: "paid",
      refunded_amount: null,
      order: "ord_21590VszfDxvEbtVRpzJrx",
      customer: null,
      description: "One-time payment",
      created_at: 1772265464066,
      mode: "test",
    },
    order: {
      object: "order",
      id: "ord_21590VszfDxvEbtVRpzJrx",
      customer: "cust_41ejpMs1YtRqCVtu5QE6Mm",
      product: "prod_2KXuN53r0sxlJFV4B6v44Y",
      amount: 2999,
      currency: "USD",
      sub_total: 2999,
      tax_amount: 500,
      amount_due: 2999,
      amount_paid: 2999,
      status: "paid",
      type: "onetime",
      transaction: "tran_125zeFXV7V3wQTOQcmwwUN",
      created_at: "2026-02-28T07:57:44.066Z",
      updated_at: "2026-02-28T07:57:44.066Z",
      mode: "test",
    },
    customer: {
      id: "cust_41ejpMs1YtRqCVtu5QE6Mm",
      object: "customer",
      email: "test-customer@creem.io",
      name: "Test Customer",
      country: "US",
      created_at: "2026-02-28T07:57:44.066Z",
      updated_at: "2026-02-28T07:57:44.066Z",
      mode: "test",
    },
    created_at: 1772265464066,
    mode: "test",
  },
};

// ── Tests ───────────────────────────────────────────────────────────

describe("getEventType", () => {
  it("returns eventType from Creem webhook format", () => {
    expect(getEventType(CHECKOUT_COMPLETED)).toBe("checkout.completed");
  });

  it("returns eventType from subscription events", () => {
    expect(getEventType(SUBSCRIPTION_ACTIVE)).toBe("subscription.active");
    expect(getEventType(SUBSCRIPTION_CANCELED)).toBe("subscription.canceled");
    expect(getEventType(SUBSCRIPTION_PAUSED)).toBe("subscription.paused");
  });

  it("prefers type over eventType", () => {
    expect(getEventType({ type: "a", eventType: "b" })).toBe("a");
  });

  it("returns empty string when both are missing", () => {
    expect(getEventType({})).toBe("");
  });

  it("handles refund and dispute events", () => {
    expect(getEventType(REFUND_CREATED)).toBe("refund.created");
    expect(getEventType(DISPUTE_CREATED)).toBe("dispute.created");
  });
});

describe("getEventData", () => {
  it("returns object from Creem webhook format", () => {
    const data = getEventData(CHECKOUT_COMPLETED);
    expect(data).toBeDefined();
    expect((data as Record<string, unknown>).id).toBe(
      "ch_6u5rCq19LEsXpltlDGtc9Y",
    );
  });

  it("prefers data over object", () => {
    expect(getEventData({ data: "x", object: "y" })).toBe("x");
  });

  it("returns undefined when both are missing", () => {
    expect(getEventData({})).toBeUndefined();
  });

  it("returns subscription object from subscription event", () => {
    const data = getEventData(SUBSCRIPTION_ACTIVE) as Record<string, unknown>;
    expect(data.id).toBe("sub_35c5ooVUuIUtru83zXjrjC");
    expect(data.status).toBe("active");
  });
});

describe("getCustomerId", () => {
  it("returns null for null/undefined", () => {
    expect(getCustomerId(null)).toBeNull();
    expect(getCustomerId(undefined)).toBeNull();
  });

  it("returns string customer ID directly", () => {
    expect(getCustomerId("cust_123")).toBe("cust_123");
  });

  it("extracts id from CustomerEntity object", () => {
    const customer = {
      id: "cust_abc",
      object: "customer" as const,
      email: "test@test.com",
      name: "Test",
      country: "US",
      createdAt: new Date(),
      updatedAt: new Date(),
      mode: "test" as const,
    };
    expect(getCustomerId(customer)).toBe("cust_abc");
  });

  it("returns null for empty string (falsy)", () => {
    expect(getCustomerId("")).toBeNull();
  });
});

describe("getConvexEntityId", () => {
  it("returns null for null/undefined", () => {
    expect(getConvexEntityId(null)).toBeNull();
    expect(getConvexEntityId(undefined)).toBeNull();
  });

  it("returns null for non-object", () => {
    expect(getConvexEntityId("string")).toBeNull();
    expect(getConvexEntityId(42)).toBeNull();
  });

  it("prefers convexBillingEntityId over convexUserId", () => {
    expect(
      getConvexEntityId({
        convexBillingEntityId: "org_123",
        convexUserId: "user_456",
      }),
    ).toBe("org_123");
  });

  it("falls back to convexUserId", () => {
    expect(getConvexEntityId({ convexUserId: "user_789" })).toBe("user_789");
  });

  it("returns null for empty metadata", () => {
    expect(getConvexEntityId({})).toBeNull();
  });

  it("returns null when keys have non-string values", () => {
    expect(getConvexEntityId({ convexUserId: 42 })).toBeNull();
  });
});

describe("parseCheckout", () => {
  it("parses a real checkout.completed payload", () => {
    const raw = CHECKOUT_COMPLETED.object as Record<string, unknown>;
    const result = parseCheckout(raw);
    expect(result).not.toBeNull();
    expect(result!.id).toBe("ch_6u5rCq19LEsXpltlDGtc9Y");
    expect(result!.status).toBe("completed");
    expect(result!.mode).toBe("test");
  });

  it("extracts customer from checkout", () => {
    const raw = CHECKOUT_COMPLETED.object as Record<string, unknown>;
    const result = parseCheckout(raw);
    expect(result).not.toBeNull();
    expect(typeof result!.customer).toBe("object");
    if (typeof result!.customer === "object") {
      expect(result!.customer.id).toBe("cust_6aVJrSJi8h9r7cGzWPVBF0");
      expect(result!.customer.email).toBe("test-customer@creem.io");
    }
  });

  it("extracts product from checkout", () => {
    const raw = CHECKOUT_COMPLETED.object as Record<string, unknown>;
    const result = parseCheckout(raw);
    expect(result).not.toBeNull();
    if (typeof result!.product === "object") {
      expect(result!.product.id).toBe("prod_35PR89LmiAjsR8JJwO7uM7");
      expect(result!.product.name).toBe("Test Product");
    }
  });

  it("returns null for invalid data", () => {
    const result = parseCheckout({ id: 123 });
    expect(result).toBeNull();
  });
});

describe("parseProduct", () => {
  it("parses a real product from checkout payload", () => {
    const productData = (CHECKOUT_COMPLETED.object as Record<string, unknown>)
      .product as Record<string, unknown>;
    const result = parseProduct(productData);
    expect(result).not.toBeNull();
    expect(result!.id).toBe("prod_35PR89LmiAjsR8JJwO7uM7");
    expect(result!.name).toBe("Test Product");
    expect(result!.price).toBe(2999);
    expect(result!.currency).toBe("USD");
    expect(result!.billingType).toBe("onetime");
    expect(result!.status).toBe("active");
  });

  it("parses a recurring product from subscription payload", () => {
    const productData = (SUBSCRIPTION_ACTIVE.object as Record<string, unknown>)
      .product as Record<string, unknown>;
    const result = parseProduct(productData);
    expect(result).not.toBeNull();
    expect(result!.billingType).toBe("recurring");
  });

  it("returns null for invalid data", () => {
    expect(parseProduct({ bad: "data" })).toBeNull();
  });
});

describe("parseSubscription", () => {
  it("parses active subscription from real webhook", () => {
    const raw = SUBSCRIPTION_ACTIVE.object as Record<string, unknown>;
    const result = parseSubscription(raw);
    expect(result).not.toBeNull();
    expect(result!.id).toBe("sub_35c5ooVUuIUtru83zXjrjC");
    expect(result!.status).toBe("active");
    expect(result!.collectionMethod).toBe("charge_automatically");
  });

  it("parses trialing subscription", () => {
    const raw = SUBSCRIPTION_TRIALING.object as Record<string, unknown>;
    const result = parseSubscription(raw);
    expect(result).not.toBeNull();
    expect(result!.status).toBe("trialing");
  });

  it("parses canceled subscription with canceledAt", () => {
    const raw = SUBSCRIPTION_CANCELED.object as Record<string, unknown>;
    const result = parseSubscription(raw);
    expect(result).not.toBeNull();
    expect(result!.status).toBe("canceled");
    expect(result!.canceledAt).not.toBeNull();
  });

  it("parses scheduled_cancel subscription", () => {
    const raw = SUBSCRIPTION_SCHEDULED_CANCEL.object as Record<string, unknown>;
    const result = parseSubscription(raw);
    expect(result).not.toBeNull();
    // scheduled_cancel may be parsed by SDK or fall back to manual parser
    expect(result!.id).toBe("sub_5Nq3ne8vXuL0FvU356xKMc");
  });

  it("parses past_due subscription", () => {
    const raw = SUBSCRIPTION_PAST_DUE.object as Record<string, unknown>;
    const result = parseSubscription(raw);
    expect(result).not.toBeNull();
    expect(result!.id).toBe("sub_1WRdOPrNNefOsSXDbPVi2d");
  });

  it("parses paused subscription", () => {
    const raw = SUBSCRIPTION_PAUSED.object as Record<string, unknown>;
    const result = parseSubscription(raw);
    expect(result).not.toBeNull();
    expect(result!.id).toBe("sub_4yINJXEk48ie8UrVXW6Hki");
  });

  it("extracts embedded customer object", () => {
    const raw = SUBSCRIPTION_ACTIVE.object as Record<string, unknown>;
    const result = parseSubscription(raw);
    expect(result).not.toBeNull();
    if (typeof result!.customer === "object") {
      expect(result!.customer.id).toBe("cust_50fklVtISQkWoAydmZ1LJb");
    }
  });

  it("extracts embedded product object", () => {
    const raw = SUBSCRIPTION_ACTIVE.object as Record<string, unknown>;
    const result = parseSubscription(raw);
    expect(result).not.toBeNull();
    if (typeof result!.product === "object") {
      expect(result!.product.id).toBe("prod_3prhYLElQzQaZMq7pePQqf");
    }
  });

  it("returns a fallback object for garbage data (manual parser is lenient)", () => {
    // manualParseSubscription is intentionally lenient — it's a last-resort fallback
    // for unknown statuses. It produces a partial object rather than null.
    const result = parseSubscription({ random: "garbage" });
    expect(result).not.toBeNull();
    expect(result!.id).toBeUndefined();
  });
});

describe("manualParseSubscription", () => {
  it("parses a subscription with embedded product object", () => {
    const raw = SUBSCRIPTION_ACTIVE.object as Record<string, unknown>;
    const result = manualParseSubscription(raw);
    expect(result).not.toBeNull();
    expect(result!.id).toBe("sub_35c5ooVUuIUtru83zXjrjC");
    expect(result!.status).toBe("active");
    expect(result!.collectionMethod).toBe("charge_automatically");
  });

  it("handles string product ID", () => {
    const result = manualParseSubscription({
      id: "sub_test",
      status: "active",
      product: "prod_123",
      customer: "cust_456",
      collection_method: "charge_automatically",
      current_period_start_date: "2026-01-01T00:00:00Z",
      current_period_end_date: "2026-02-01T00:00:00Z",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.product).toBe("prod_123");
  });

  it("handles string customer ID", () => {
    const result = manualParseSubscription({
      id: "sub_test",
      status: "active",
      product: "prod_123",
      customer: "cust_string",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.customer).toBe("cust_string");
  });

  it("parses customer object to extract id", () => {
    const result = manualParseSubscription({
      id: "sub_test",
      status: "active",
      product: "prod_123",
      customer: { id: "cust_obj_id", email: "x@y.com" },
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.customer).toBe("cust_obj_id");
  });

  it("parses canceledAt date", () => {
    const raw = SUBSCRIPTION_CANCELED.object as Record<string, unknown>;
    const result = manualParseSubscription(raw);
    expect(result).not.toBeNull();
    expect(result!.canceledAt).toBeInstanceOf(Date);
  });

  it("sets canceledAt to null when not present", () => {
    const raw = SUBSCRIPTION_ACTIVE.object as Record<string, unknown>;
    const result = manualParseSubscription(raw);
    expect(result).not.toBeNull();
    expect(result!.canceledAt).toBeNull();
  });

  it("defaults mode to test", () => {
    const result = manualParseSubscription({
      id: "sub_no_mode",
      status: "active",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.mode).toBe("test");
  });

  it("defaults object to subscription", () => {
    const result = manualParseSubscription({
      id: "sub_no_obj",
      status: "active",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.object).toBe("subscription");
  });

  it("parses unpaid subscription (SDK may not know this status)", () => {
    const raw = SUBSCRIPTION_UNPAID.object as Record<string, unknown>;
    const result = manualParseSubscription(raw);
    expect(result).not.toBeNull();
    expect(result!.id).toBe("sub_3xx35QzxsnpFiJ3vRB9YKt");
    // Status is passed through even if SDK doesn't recognize it
    expect(result!.status).toBe("unpaid");
  });
});
