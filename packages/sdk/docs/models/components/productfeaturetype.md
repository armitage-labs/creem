# ProductFeatureType

The type of the feature: `custom` (private note), `file` (downloadable files), `licenseKey` (license key), `customerCredits` (customer credit grant), or `githubRepository` (access to a private GitHub repository).

## Example Usage

```typescript
import { ProductFeatureType } from "creem/models/components";

let value: ProductFeatureType = "licenseKey";
```

## Values

```typescript
"custom" | "file" | "licenseKey" | "customerCredits" | "githubRepository"
```