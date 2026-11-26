# DiscountWriteChangeEntityTo

The value after the write: the field as a read returns it (`currency` as stored, also on a percentage discount, whose read leaves it out). `null` for a removed product.


## Supported Types

### `string`

```typescript
const value: string = "2026-12-31T23:59:59.000Z";
```

### `number`

```typescript
const value: number = 1284.03;
```

### `boolean`

```typescript
const value: boolean = true;
```

### `any[]`

```typescript
const value: any[] = [
  "<value 1>",
  "<value 2>",
  "<value 3>",
];
```

### `{ [k: string]: any }`

```typescript
const value: { [k: string]: any } = {
  "key": "<value>",
  "key1": "<value>",
  "key2": "<value>",
};
```

