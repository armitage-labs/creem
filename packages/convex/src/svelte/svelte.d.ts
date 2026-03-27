declare module "*.svelte" {
  import type { Component } from "svelte";

  const SvelteComponent: Component<any>;
  export default SvelteComponent;
}
