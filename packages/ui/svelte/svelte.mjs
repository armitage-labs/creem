// Entry resolved via the package's "svelte" export condition (vite-plugin-svelte
// et al). Ships the raw .svelte components for the consumer's Svelte compiler,
// plus everything from the framework-agnostic core (openCheckout, mount,
// attachments, types) built by tsup into ./dist.
export { default as CreemCheckout } from "./CreemCheckout.svelte";
export { default as CreemCheckoutInline } from "./CreemCheckoutInline.svelte";
export * from "./dist/index.mjs";
