# CancelSubscriptionRequestEntity

## Example Usage

```typescript
import { CancelSubscriptionRequestEntity } from "creem/models/components";

let value: CancelSubscriptionRequestEntity = {
  mode: "immediate",
  onExecute: "cancel",
};
```

## Fields

| Field                                                                                                                         | Type                                                                                                                          | Required                                                                                                                      | Description                                                                                                                   | Example                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `mode`                                                                                                                        | [components.Mode](../../models/components/mode.md)                                                                            | :heavy_minus_sign:                                                                                                            | The mode of cancellation (immediate or scheduled), default can be configured in the store billing settings.                   | immediate                                                                                                                     |
| `onExecute`                                                                                                                   | [components.OnExecute](../../models/components/onexecute.md)                                                                  | :heavy_minus_sign:                                                                                                            | The action to execute when canceling (cancel or pause) when mode is scheduled, ignored when mode is immediate or not provided | cancel                                                                                                                        |