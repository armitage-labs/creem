<!--
  CreemCheckoutInline — mounts the Creem checkout iframe inline into the page.

    <CreemCheckoutInline {checkoutUrl} onComplete={fn} style="height:820px" />

  Authored with Svelte 4 syntax so it compiles under both Svelte 4 and 5.
-->
<script>
  import { onMount, onDestroy } from "svelte";
  import { mount } from "@creem_io/embed";

  export let checkoutUrl;
  export let theme = undefined;
  export let locale = undefined;
  export let onReady = undefined;
  export let onComplete = undefined;
  export let style = undefined;

  let el;
  let handle;

  onMount(() => {
    handle = mount({ checkoutUrl, theme, locale, onReady, onComplete, container: el });
  });
  onDestroy(() => {
    if (handle) handle.destroy();
  });
</script>

<div bind:this={el} {style}></div>
