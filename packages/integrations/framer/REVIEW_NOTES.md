# Creem Framer Plugin — Reviewer Notes

This submission contains both the optimized production runtime and the original,
readable application source in `review-source/`. The production bundle includes
the `@framer/plugin` SDK, whose internal method implementations should not be
mistaken for unguarded calls made by this plugin. The plugin's own Framer API
usage is easiest to review in `review-source/src/`.

## Protected Framer operations

Every protected mutation is reactively permission-gated in
`src/components/InsertWizard.tsx`, checked again immediately before execution,
awaited inside explicit error handling, and covered by failure-path tests in
`src/utils/codeFileHelpers.test.ts`.

| Operation | Permission and error handling |
| --- | --- |
| Create a code file | `src/utils/codeFileHelpers.ts` checks `isAllowedTo("createCodeFile")`, then wraps and awaits `createCodeFile` in `try/catch`. |
| Update a code file | `src/utils/codeFileHelpers.ts` checks `isAllowedTo("CodeFile.setFileContent")`, then wraps and awaits `setFileContent` in `try/catch`. |
| Insert a component | `src/utils/codeFileHelpers.ts` checks `isAllowedTo("addComponentInstance")`, then wraps and awaits `addComponentInstance` in `try/catch`. |

The plugin also handles code-file inspection failures, compilation subscription
failures, compilation timeouts, and permission changes that occur between a
preflight check and the protected call. Each failure becomes a step-specific,
actionable notification in the plugin UI.

## External checkout dependency

The generated checkout button and pricing table open Creem-hosted checkout URLs
at runtime. The plugin provides a persistent link to the Creem Framer integration
documentation (`https://docs.creem.io/integrations/framer`) during setup and
component selection.
