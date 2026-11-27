import type { Creem } from "creem";
import type {
  DiscountEntity,
  MeterApiResponseDto,
  ProductEntity,
  ProductGroupEntity,
} from "creem/models/components";

/** The Creem objects a migrator matches its keys against. */
export interface CreemCatalog {
  products: ProductEntity[];
  productGroups: ProductGroupEntity[];
  discounts: DiscountEntity[];
  /** Read only for a migrator that writes meters (`readCreemCatalog(…, { meters: true })`). */
  meters?: MeterApiResponseDto[];
}

const PAGE_SIZE = 100;

/**
 * Reads the store's whole catalog with GETs only. Keys are matched client-side
 * (`external_id`), so one paged read per kind serves every lookup of a run.
 */
export async function readCreemCatalog(
  client: Creem,
  options: { meters?: boolean } = {},
): Promise<CreemCatalog> {
  const products: ProductEntity[] = [];
  for (let pageNumber = 1; ; ) {
    const page = await client.products.search({ pageNumber, pageSize: PAGE_SIZE });
    products.push(...page.result.items);
    const next = page.result.pagination.nextPage;
    if (next == null || next <= pageNumber || !page.result.items.length) break;
    pageNumber = next;
  }
  const discounts: DiscountEntity[] = [];
  for (let pageNumber = 1; ; ) {
    const page = await client.discounts.search({ pageNumber, pageSize: PAGE_SIZE });
    discounts.push(...page.result.items);
    const next = page.result.pagination.nextPage;
    if (next == null || next <= pageNumber || !page.result.items.length) break;
    pageNumber = next;
  }
  const productGroups: ProductGroupEntity[] = [];
  for (let startingAfter: string | undefined; ; ) {
    const page = await client.productGroups.list({
      limit: PAGE_SIZE,
      ...(startingAfter ? { startingAfter } : {}),
    });
    productGroups.push(...page.result.data);
    const last = page.result.data.at(-1)?.id;
    if (!page.result.hasMore || !last || last === startingAfter) break;
    startingAfter = last;
  }
  if (!options.meters) return { products, productGroups, discounts };
  // Archived meters too: a keyed upsert finds them, so their keys are taken.
  const meters: MeterApiResponseDto[] = [];
  for (let startingAfter: string | undefined; ; ) {
    const page = await client.meters.listMeters({
      limit: PAGE_SIZE,
      includeArchived: true,
      ...(startingAfter ? { startingAfter } : {}),
    });
    meters.push(...page.result.data);
    const last = page.result.data.at(-1)?.id;
    if (!page.result.hasMore || !last || last === startingAfter) break;
    startingAfter = last;
  }
  return { products, productGroups, discounts, meters };
}
