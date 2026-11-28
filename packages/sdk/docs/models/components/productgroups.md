# ProductGroups

`"all"` for every test product group, or a list of test product group ids. Leave it out to promote no product groups. A group is matched by `external_id`; its members are named by their products’ keys.


## Supported Types

### `components.One`

```typescript
const value: components.One = "all";
```

### `string[]`

```typescript
const value: string[] = [
  "<value 1>",
  "<value 2>",
];
```

