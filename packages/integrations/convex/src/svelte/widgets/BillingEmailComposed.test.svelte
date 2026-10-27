<!-- Test fixture: a custom BillingEmail layout built from its parts. -->
<script lang="ts">
  import { BillingEmail } from "./index.js";
</script>

<BillingEmail.Root class="custom-root">
  <BillingEmail.Label>Invoice address</BillingEmail.Label>
  <div class="row">
    <BillingEmail.Input class="custom-input" data-testid="email" />
    <BillingEmail.Save>Update</BillingEmail.Save>
  </div>
  <BillingEmail.Error />
</BillingEmail.Root>
