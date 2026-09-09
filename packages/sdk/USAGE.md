<!-- Start SDK Example Usage [usage] -->
```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.products.search();

  for await (const page of result) {
    console.log(page);
  }
}

run();

```
<!-- End SDK Example Usage [usage] -->