---
"creem": minor
"@creem_io/cli": minor
---

Expose the Customer Credits transactions surface. The SDK gains `customerCredits.postTransaction` (balanced multi-entry transactions across accounts), `customerCredits.getTransaction`, `customerCredits.reverseTransactionById`, and `customerCredits.listTransactionsByReference`, with matching `creem customer-credits transactions …` CLI commands (create, get, reverse, list). Posting and reversing transactions are destructive operations and prompt for confirmation or require `--yes`.
