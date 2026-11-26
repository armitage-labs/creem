# UpdateProductRequestEntityFeatures


## Supported Types

### `components.ProductFeatureEditRequestEntity`

```typescript
const value: components.ProductFeatureEditRequestEntity = {
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

### `components.ProductLicenseKeyFeatureEditRequestEntity`

```typescript
const value: components.ProductLicenseKeyFeatureEditRequestEntity = {
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

### `components.ProductPrivateNoteFeatureEditRequestEntity`

```typescript
const value: components.ProductPrivateNoteFeatureEditRequestEntity = {
  id: "feat_abc123",
  externalId: "welcome-note",
  type: "custom",
  description: "Private note",
  privateNote: "Thanks for your purchase! Your access code is XYZ123.",
};
```

### `components.ProductFileFeatureEditRequestEntity`

```typescript
const value: components.ProductFileFeatureEditRequestEntity = {
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

### `components.ProductFeatureDeletionRequestEntity`

```typescript
const value: components.ProductFeatureDeletionRequestEntity = {
  id: "feat_abc123",
  externalId: "welcome-note",
  type: "custom",
  deleted: true,
};
```

