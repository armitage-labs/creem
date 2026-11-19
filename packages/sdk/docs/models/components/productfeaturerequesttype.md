# ProductFeatureRequestType

The feature type of a credit grant entry. `licenseKey`, `custom` and `file` entries have their own variants; `githubRepository` features are managed in the dashboard, and an entry of that type answers `400` with code `feature_type_not_writable`.

## Example Usage

```typescript
import { ProductFeatureRequestType } from "creem/models/components";

let value: ProductFeatureRequestType = "customerCredits";
```

## Values

```typescript
"customerCredits"
```