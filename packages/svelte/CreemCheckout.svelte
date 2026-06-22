<!--
  CreemCheckout — opens the Creem checkout overlay when the wrapped element is
  clicked. Recommended, beginner-friendly Svelte API.

    <CreemCheckout {checkoutUrl} onComplete={fn}>
      <button>Subscribe</button>
    </CreemCheckout>

  Authored with Svelte 4 slot syntax so it compiles under both Svelte 4 and 5.
-->
<script>
  import { openCheckout } from "@creem_io/embed";

  export let checkoutUrl;
  export let theme = undefined;
  export let locale = undefined;
  export let onReady = undefined;
  export let onComplete = undefined;
  export let onClose = undefined;

  function open() {
    openCheckout({ checkoutUrl, theme, locale, onReady, onComplete, onClose });
  }
</script>

<span
  on:click={open}
  on:keydown={(e) => (e.key === "Enter" || e.key === " ") && open()}
  role="button"
  tabindex="0"
  style="cursor:pointer;display:inline-block"
>
  <slot />
</span>
