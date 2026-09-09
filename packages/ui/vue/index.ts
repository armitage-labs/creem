import { defineComponent, h, onBeforeUnmount, onMounted, ref, type PropType } from "vue";
import {
  openCheckout,
  mount,
  captureAffiliateRef,
  CreemEmbedCheckout,
  type CreemCheckoutCompleted,
  type CreemCheckoutOptions,
  type CreemCheckoutHandle,
} from "@creem_io/embed";

// @creem_io/vue — Vue 3 components + composable to embed Creem checkout.
// Thin wrapper over @creem_io/embed.

export {
  openCheckout,
  captureAffiliateRef,
  CreemEmbedCheckout,
  type CreemCheckoutCompleted,
  type CreemCheckoutOptions,
  type CreemCheckoutHandle,
};

/** Composable returning an imperative checkout opener. */
export function useCreemCheckout(): (options: CreemCheckoutOptions) => CreemCheckoutHandle {
  return (options) => openCheckout(options);
}

/** Declarative trigger — wraps the default slot; clicking opens the overlay. */
export const CreemCheckout = defineComponent({
  name: "CreemCheckout",
  props: {
    checkoutUrl: { type: String, required: true },
    theme: { type: String as PropType<"light" | "dark">, default: undefined },
    locale: { type: String, default: undefined },
  },
  emits: {
    ready: () => true,
    complete: (_detail: CreemCheckoutCompleted) => true,
    close: () => true,
  },
  setup(props, { slots, emit }) {
    const open = () =>
      openCheckout({
        checkoutUrl: props.checkoutUrl,
        theme: props.theme,
        locale: props.locale,
        onReady: () => emit("ready"),
        onComplete: (detail) => emit("complete", detail),
        onClose: () => emit("close"),
      });
    return () =>
      h(
        "span",
        { onClick: open, style: "cursor:pointer;display:inline-block" },
        slots.default ? slots.default() : [],
      );
  },
});

/** Inline embed — mounts the checkout iframe into a div. */
export const CreemCheckoutInline = defineComponent({
  name: "CreemCheckoutInline",
  props: {
    checkoutUrl: { type: String, required: true },
    theme: { type: String as PropType<"light" | "dark">, default: undefined },
    locale: { type: String, default: undefined },
  },
  emits: {
    ready: () => true,
    complete: (_detail: CreemCheckoutCompleted) => true,
  },
  setup(props, { emit }) {
    const el = ref<HTMLDivElement | null>(null);
    let handle: { destroy: () => void } | null = null;
    onMounted(() => {
      if (el.value) {
        handle = mount({
          checkoutUrl: props.checkoutUrl,
          theme: props.theme,
          locale: props.locale,
          container: el.value,
          onReady: () => emit("ready"),
          onComplete: (detail) => emit("complete", detail),
        });
      }
    });
    onBeforeUnmount(() => handle?.destroy());
    return () => h("div", { ref: el });
  },
});
