# Developing guide

## Running locally

```sh
pnpm i
pnpm dev:svelte
pnpm dev:react
```

## Development setup

Create a demo user (since this example doesn't have real auth):

```sh
npx convex run example:createDemoUser
```

Sync Creem products to the local Convex database:

```sh
npx convex run billing:syncBillingProducts
```

## Testing

```sh
pnpm clean
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

## Deploying

### Building a one-off package

```sh
pnpm clean
pnpm ci
pnpm pack
```

### Deploying a new version

```sh
pnpm release
```

or for alpha release:

```sh
pnpm alpha
```
