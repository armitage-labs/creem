// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlanChoice, type PlanChoiceProps } from "./PlanChoice.js";
import type { UIPlanEntry } from "../../core/types.js";

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

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const show = async (props: PlanChoiceProps) => {
  await act(async () => root.render(<PlanChoice {...props} />));
};

describe("<PlanChoice> (React)", () => {
  it("offers the plans as one choice, the recommended one first chosen, and checks out the one chosen", async () => {
    const onCheckout = vi.fn();
    await show({
      plans: [
        plan("basic"),
        plan("pro", { recommended: true }),
        plan("trial", { category: "trial" }),
      ],
      selectedCycle: "every-month",
      onCheckout,
    });
    const radios = [
      ...container.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
    ];
    expect(radios.map((radio) => radio.value)).toEqual(["basic", "pro"]);
    expect(radios.find((radio) => radio.checked)?.value).toBe("pro");

    await act(async () => radios[0].click());
    const button = container.querySelector<HTMLButtonElement>(
      '[data-part="checkout"]',
    )!;
    expect(button.textContent).toBe("Continue to checkout");
    await act(async () => button.click());
    expect(onCheckout).toHaveBeenCalledWith({
      plan: expect.objectContaining({ planId: "basic" }),
      productId: "basic_monthly",
    });
  });

  it("shows the subscribed plan as current and never chooses it", async () => {
    await show({
      plans: [plan("basic"), plan("pro")],
      selectedCycle: "every-month",
      subscriptionProductId: "basic_monthly",
      onCheckout: vi.fn(),
    });
    expect(
      container.querySelector<HTMLInputElement>('input[value="basic"]')!
        .disabled,
    ).toBe(true);
    expect(
      container.querySelector<HTMLInputElement>('input[value="pro"]')!.checked,
    ).toBe(true);
    expect(container.textContent).toContain("Current plan");
  });
});
