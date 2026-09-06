import { handlers as products } from "./products";
import { handlers as customers } from "./customers";
import { handlers as subscriptions } from "./subscriptions";
import { handlers as checkouts } from "./checkouts";
import { handlers as licenses } from "./licenses";
import { handlers as discounts } from "./discounts";
import { handlers as transactions } from "./transactions";
import { handlers as stats } from "./stats";
import { handlers as moderation } from "./moderation";
import { handlers as customerCredits } from "./customer-credits";
import { handlers as affiliates } from "./affiliates";
import { handlers as splits } from "./splits";
export const handlers = {
  ...products,
  ...customers,
  ...subscriptions,
  ...checkouts,
  ...licenses,
  ...discounts,
  ...transactions,
  ...stats,
  ...moderation,
  ...customerCredits,
  ...affiliates,
  ...splits,
};
