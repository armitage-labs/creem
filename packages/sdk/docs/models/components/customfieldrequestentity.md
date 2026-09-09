# CustomFieldRequestEntity

## Example Usage

```typescript
import { CustomFieldRequestEntity } from "creem/models/components";

let value: CustomFieldRequestEntity = {
  type: "checkbox",
  key: "companyName",
  label: "Company Name",
  text: {
    maxLength: 200,
    minLength: 1,
  },
  checkbox: {
    label: "I agree to the [terms and conditions](https://example.com/terms)",
  },
};
```

## Fields

| Field                                                                                              | Type                                                                                               | Required                                                                                           | Description                                                                                        | Example                                                                                            |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `type`                                                                                             | [components.CustomFieldRequestType](../../models/components/customfieldrequesttype.md)             | :heavy_check_mark:                                                                                 | The type of the field.                                                                             |                                                                                                    |
| `key`                                                                                              | *string*                                                                                           | :heavy_check_mark:                                                                                 | Unique key for custom field. Must be unique to this field, alphanumeric, and up to 200 characters. | companyName                                                                                        |
| `label`                                                                                            | *string*                                                                                           | :heavy_check_mark:                                                                                 | The label for the field, displayed to the customer, up to 50 characters.                           | Company Name                                                                                       |
| `optional`                                                                                         | *boolean*                                                                                          | :heavy_minus_sign:                                                                                 | Whether the customer is required to complete the field. Defaults to `false`                        |                                                                                                    |
| `text`                                                                                             | [components.TextFieldConfig](../../models/components/textfieldconfig.md)                           | :heavy_minus_sign:                                                                                 | Configuration for text field type.                                                                 |                                                                                                    |
| `checkbox`                                                                                         | [components.CheckboxFieldConfig](../../models/components/checkboxfieldconfig.md)                   | :heavy_minus_sign:                                                                                 | Configuration for checkbox field type.                                                             |                                                                                                    |