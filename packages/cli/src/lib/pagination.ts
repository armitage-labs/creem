import type { OperationMapping } from "../operation-manifest";
import { CliError } from "./errors";
import { isRecord } from "./operation";

export function unwrapResult(response: unknown): unknown {
  return isRecord(response) && "result" in response ? response.result : response;
}
export function pageItems(page: unknown): unknown[] {
  if (isRecord(page)) {
    if (Array.isArray(page.items)) return page.items;
    if (Array.isArray(page.data)) return page.data;
  }
  return Array.isArray(page) ? page : [];
}
// Invoke each page explicitly: some SDK list methods return plain entities,
// others PageIterators; backward cursor traversal also needs its own direction.
export async function* pages(
  row: OperationMapping,
  parameters: Record<string, unknown>,
  all: boolean,
  call: (p: Record<string, unknown>) => Promise<unknown>,
): AsyncGenerator<unknown> {
  let p = { ...parameters };
  const seen = new Set<string>();
  while (true) {
    const page = unwrapResult(await call(p));
    yield page;
    if (!all || row.pagination === "none") return;
    const items = pageItems(page);
    if (!isRecord(page)) throw new CliError("Unexpected pagination response.", 4);
    if (row.pagination === "cursor") {
      if (!page.hasMore) return;
      const backward = Boolean(p.endingBefore);
      const edge = items[backward ? 0 : items.length - 1];
      const cursor = isRecord(edge) ? edge.id : undefined;
      if (
        typeof cursor !== "string" ||
        seen.has(cursor) ||
        cursor === p.startingAfter ||
        cursor === p.endingBefore
      )
        throw new CliError("API returned a non-advancing pagination cursor.", 4);
      seen.add(cursor);
      p = { ...p, [backward ? "endingBefore" : "startingAfter"]: cursor };
    } else {
      const pagination = isRecord(page.pagination) ? page.pagination : {};
      const current = Number(p.pageNumber ?? 1);
      if (typeof pagination.totalPages === "number" && current >= pagination.totalPages) return;
      const next =
        typeof pagination.nextPage === "number"
          ? pagination.nextPage
          : typeof pagination.totalPages === "number" && current < pagination.totalPages
            ? current + 1
            : undefined;
      if (next === undefined) return;
      if (!items.length || next <= current)
        throw new CliError("API returned non-advancing page metadata.", 4);
      p = { ...p, pageNumber: next };
    }
  }
}
