# Creem Framer Plugin

`@creem_io/framer` &mdash; the source for the [Creem plugin for Framer](https://www.framer.com/community/marketplace/plugins/creem/). It adds Creem checkout buttons and pricing tables to a Framer site with no custom code.

> **Using the plugin?** This README is for developers working on the plugin itself. If you just want to add checkout to your Framer site, install it from the [Framer Marketplace](https://www.framer.com/community/marketplace/plugins/creem/) and follow the [user documentation](https://docs.creem.io/integrations/framer).

## What's inside

The plugin is a Framer canvas plugin that inserts two code components:

- **Checkout button** &mdash; a single-product buy button
- **Pricing table** &mdash; a multi-product table that mixes one-time and subscription products, with an automatic billing-interval toggle

The plugin UI walks the user through connecting one or more Creem **stores** (each holding a Live and/or Test API key), picking products, and configuring a component. A store/environment switcher in the header lets the user browse either catalog and flip between test and live. Insertion writes the component's code file into the Framer project and drops a component instance onto the canvas; from there, all styling is done through Framer property controls.

## Local development

From the monorepo root:

```bash
pnpm install
pnpm --filter @creem_io/framer dev
```

Or from this package:

```bash
cd packages/framer
pnpm dev
```

Then load it in Framer:

1. Open your project &rarr; **Canvas** &rarr; **Plugins**
2. Click **Open Development Plugin**

## Project structure

```
src/
├── App.tsx                 # Root: store state, product fetching, screen routing
├── main.tsx                # Entry point
├── components/
│   ├── SetupScreen.tsx     # Create a store (name + Live/Test API keys)
│   ├── StoreSwitcher.tsx   # Header switcher: change store + environment, manage keys
│   ├── TestModeChrome.tsx  # Peach frame + "Test mode on" bar when env is test
│   ├── InsertWizard.tsx    # 3-step insert flow (choose → select → configure)
│   ├── ProductPicker.tsx   # Product list, single/multi select
│   ├── ProductSearchInput.tsx
│   └── Markdown.tsx        # Renders Markdown in tier descriptions
├── framer/                 # Code components inserted into the user's project
│   ├── checkout-button.tsx # <CreemCheckoutButton> + property controls
│   ├── pricing-table.tsx   # <CreemPricingTable> + property controls
│   └── icons.tsx
├── hooks/
│   └── useStores.ts        # Multi-store state (add/switch/rename/remove, active env)
├── services/
│   ├── api.ts              # Creem API client (product fetching)
│   └── stores.ts           # Store persistence, key-prefix env routing, legacy migration
├── utils/                  # Formatters, product helpers, validation, code-file helpers
├── styles/ui.ts            # Shared class strings
└── types.ts
```

The files under `src/framer/` are the components that ship into the user's Framer project. They are imported `?raw` by `InsertWizard.tsx` and written into the project at insert time, so their `addPropertyControls` definitions are the source of truth for every on-canvas customization option.

## Tech stack

- **React** + **Vite** &mdash; plugin UI
- **Tailwind CSS** &mdash; styling
- **Framer Plugin API** (`framer-plugin`) &mdash; canvas integration
- **TypeScript**

## Releasing a new version

Bump the version, build, and package the plugin for the Framer Marketplace in one step:

```bash
pnpm release
```

This runs `npm version patch --no-git-tag-version`, `pnpm build`, and `pnpm pack`, producing a `plugin.zip` you upload to the [Framer Marketplace listing](https://www.framer.com/community/marketplace/plugins/creem/). Use `pnpm pack` on its own to repackage without bumping the version.

`pnpm release` only bumps the **patch** version. For a minor or major release, set the `version` in `package.json` manually first (or run `npm version minor|major --no-git-tag-version`), then `pnpm build && pnpm pack`.

> **Always bump the version when you change a component.** The components inserted into a user's Framer project are stamped with the package version (`// creem-plugin: <version>`, see [`src/utils/codeFileHelpers.ts`](src/utils/codeFileHelpers.ts)). On re-insert, the shared code file is refreshed **only when that stamp differs** from the current version; otherwise it's left untouched to preserve any hand-edits made in Framer's code editor. So if you change anything under `src/framer/` without bumping the version, existing users will **not** receive the update when they re-insert.

## Documentation

End-user documentation lives in the docs site:

- Source: [`packages/docs/integrations/framer.mdx`](../docs/integrations/framer.mdx)
- Published: [docs.creem.io/integrations/framer](https://docs.creem.io/integrations/framer)

Keep the two in sync when you change the plugin's UI or the components' property controls.

## License

Licensed under the [MIT license](LICENSE).

Contributors: Heet Bhalodiya, Rishi Raj Jain
