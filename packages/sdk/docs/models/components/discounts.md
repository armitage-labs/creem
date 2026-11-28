# Discounts

`"all"` for every test discount, or a list of test discount ids. Leave it out to promote no discounts. A discount is matched by its `code`, ignoring case; its `external_id` is copied.


## Supported Types

### `components.Discounts1`

```typescript
const value: components.Discounts1 = "all";
```

### `string[]`

```typescript
const value: string[] = [
  "<value 1>",
  "<value 2>",
];
```

