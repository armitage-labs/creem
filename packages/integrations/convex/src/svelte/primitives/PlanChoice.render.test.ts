// @vitest-environment jsdom
import { flushSync, mount, tick, unmount } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import PlanChoice from "./PlanChoice.svelte";
import type { UIPlanEntry } from "../../core/types.js";
import type { ConnectedProduct } from "../widgets/types.js";

// jsdom has no `CSS.escape`, which Ark's radio group uses to find its inputs.
globalThis.CSS ??= { escape: (value: string) => value } as typeof CSS;

const plan = (planId: string, extra: Partial<UIPlanEntry> = {}): UIPlanEntry =>
  ({
    planId,
    title: planId[0].toUpperCase() + planId.slice(1),
    category: "paid",
    billingCycles: ["every-month"],
    creemProductIds: { "every-month": `${planId}_monthly` },
    ...extra,
  }) as UIPlanEntry;

const product = (id: string, price: number) =>
  ({
    id,
    price,
    currency: "EUR",
    billingType: "recurring",
    billingPeriod: "every-month",
  }) as unknown as ConnectedProduct;

let component: ReturnType<typeof mount> | undefined;
let target: HTMLDivElement;

afterEach(async () => {
  if (component) await unmount(component);
  component = undefined;
  target?.remove();
});

function show(props: Record<string, unknown>) {
  target = document.createElement("div");
  document.body.append(target);
  component = mount(PlanChoice, { target, props });
  flushSync();
}

describe("<PlanChoice> (Svelte)", () => {
  it("offers the plans as one choice, the recommended one first chosen, and checks out the one chosen", async () => {
    const onCheckout = vi.fn();
    show({
      plans: [
        plan("basic", { description: "Reads only" }),
        plan("pro", { recommended: true }),
        plan("trial", { category: "trial" }),
      ],
      selectedCycle: "every-month",
      products: [product("basic_monthly", 3900), product("pro_monthly", 9900)],
      onCheckout,
    });

    const radios = [
      ...target.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
    ];
    expect(radios.map((radio) => radio.value)).toEqual(["basic", "pro"]);
    expect(radios.find((radio) => radio.checked)?.value).toBe("pro");
    expect(target.textContent).toContain("Reads only");
    expect(
      target.querySelector('[role="radiogroup"]')?.getAttribute("aria-label"),
    ).toBe("Choose a plan");

    radios[0].click();
    flushSync();
    await tick();
    const button = target.querySelector<HTMLButtonElement>(
      '[data-part="checkout"]',
    )!;
    expect(button.textContent?.trim()).toBe("Continue to checkout");
    button.click();
    expect(onCheckout).toHaveBeenCalledWith({
      plan: expect.objectContaining({ planId: "basic" }),
      productId: "basic_monthly",
    });
  });

  it("shows the subscribed plan as current and never chooses it", () => {
    show({
      plans: [plan("basic"), plan("pro")],
      selectedCycle: "every-month",
      subscriptionProductId: "basic_monthly",
      onCheckout: vi.fn(),
    });
    const basic = target.querySelector<HTMLInputElement>(
      'input[value="basic"]',
    )!;
    expect(basic.disabled).toBe(true);
    expect(
      target.querySelector<HTMLInputElement>('input[value="pro"]')!.checked,
    ).toBe(true);
    expect(target.textContent).toContain("Current plan");
  });

  it("applies only the classes passed when unstyled", () => {
    show({
      plans: [plan("basic")],
      selectedCycle: "every-month",
      unstyled: true,
      class: "mine",
      itemClass: "my-item",
      actionClass: "my-action",
    });
    expect(target.firstElementChild?.className).toBe("mine");
    expect(target.querySelector('[data-part="item"]')?.className).toBe(
      "my-item",
    );
    expect(target.querySelector('[data-part="checkout"]')?.className).toBe(
      "my-action",
    );
  });
});
