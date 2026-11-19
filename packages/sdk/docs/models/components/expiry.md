# Expiry

How long a license key stays valid after it is issued. `null` for keys that never expire. Each key keeps the expiry it was issued with, so a change applies only to keys issued later.


## Supported Types

### `components.LicenseKeyExpiryEntity`

```typescript
const value: components.LicenseKeyExpiryEntity = {
  interval: "month",
  intervalCount: 1,
};
```

