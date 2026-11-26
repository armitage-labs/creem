# CreateProductRequestEntityFeatures


## Supported Types

### `components.ProductFeatureRequestEntity`

```typescript
const value: components.ProductFeatureRequestEntity = {
  id: "feat_abc123",
  externalId: "pro-credits",
  type: "customerCredits",
  description: "500 image credits",
  customerCredits: {
    amount: "100",
    unitLabel: "tokens",
    bucketName: "images",
    requiresModeration: false,
    resetsEachPeriod: false,
  },
};
```

### `components.ProductLicenseKeyFeatureRequestEntity`

```typescript
const value: components.ProductLicenseKeyFeatureRequestEntity = {
  id: "feat_abc123",
  externalId: "pro-license",
  type: "licenseKey",
  description: "License key",
  licenseKey: {
    activationLimit: 3,
    expiry: {
      interval: "month",
      intervalCount: 1,
    },
  },
};
```

### `components.ProductPrivateNoteFeatureRequestEntity`

```typescript
const value: components.ProductPrivateNoteFeatureRequestEntity = {
  id: "feat_abc123",
  externalId: "welcome-note",
  type: "custom",
  description: "Private note",
  privateNote: "Thanks for your purchase! Your access code is XYZ123.",
};
```

### `components.ProductFileFeatureRequestEntity`

```typescript
const value: components.ProductFileFeatureRequestEntity = {
  id: "feat_abc123",
  externalId: "ebook-downloads",
  type: "file",
  description: "Ebook download",
  file: {
    files: [
      {
        id: "file_4dGTkmBdnTnU9vV3KZ2Hcz",
        fileName: "ebook.pdf",
        type: "application/pdf",
        size: 1024000,
        sha256: "n4bQgYhMfWWaL+qgxVrQFaO/TxsrC4Is0V1sFbDwCgg=",
      },
    ],
  },
};
```

