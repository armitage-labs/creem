## Testing and Validation

Ensure new code is covered by meaningful tests.

Before finishing, evaluate if your changes require running:

```bash
pnpm test
pnpm check 2>&1
pnpm format
pnpm lint

# Convex
timeout 30 npx convex dev --once 2>&1 || true
```
