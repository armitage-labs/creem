import * as components from "creem/models/components";
import * as operations from "creem/models/operations";
import { decode, type OperationHandler } from "../../lib/operation";

export const handlers: Record<string, OperationHandler> = {
  createCustomerCreditsAccount: (client, parameters, body, options) => {
    const b = decode(
      components.CreateAccountDto$outboundSchema,
      components.CreateAccountDto$inboundSchema,
      body,
    );
    return client.customerCredits.createAccount(b, options);
  },
  listCustomerCreditsAccounts: (client, parameters, body, options) => {
    const p = decode(
      operations.ListCustomerCreditsAccountsRequest$outboundSchema,
      operations.ListCustomerCreditsAccountsRequest$inboundSchema,
      parameters,
    );
    return client.customerCredits.listAccounts(
      p.limit,
      p.customerId,
      p.startingAfter,
      p.endingBefore,
      options,
    );
  },
  getCustomerCreditsAccount: (client, parameters, body, options) => {
    const p = decode(
      operations.GetCustomerCreditsAccountRequest$outboundSchema,
      operations.GetCustomerCreditsAccountRequest$inboundSchema,
      parameters,
    );
    return client.customerCredits.getAccount(p.id, options);
  },
  getCustomerCreditsAccountBalance: (client, parameters, body, options) => {
    const p = decode(
      operations.GetCustomerCreditsAccountBalanceRequest$outboundSchema,
      operations.GetCustomerCreditsAccountBalanceRequest$inboundSchema,
      parameters,
    );
    return client.customerCredits.getAccountBalance(p.id, p.at, options);
  },
  listCustomerCreditsAccountEntries: (client, parameters, body, options) => {
    const p = decode(
      operations.ListCustomerCreditsAccountEntriesRequest$outboundSchema,
      operations.ListCustomerCreditsAccountEntriesRequest$inboundSchema,
      parameters,
    );
    return client.customerCredits.listEntries(
      p.id,
      p.limit,
      p.startingAfter,
      p.endingBefore,
      options,
    );
  },
  freezeCustomerCreditsAccount: (client, parameters, body, options) => {
    const p = decode(
      operations.FreezeCustomerCreditsAccountRequest$outboundSchema,
      operations.FreezeCustomerCreditsAccountRequest$inboundSchema,
      parameters,
    );
    return client.customerCredits.freezeAccount(p.id, options);
  },
  unfreezeCustomerCreditsAccount: (client, parameters, body, options) => {
    const p = decode(
      operations.UnfreezeCustomerCreditsAccountRequest$outboundSchema,
      operations.UnfreezeCustomerCreditsAccountRequest$inboundSchema,
      parameters,
    );
    return client.customerCredits.unfreezeAccount(p.id, options);
  },
  creditCustomerCreditsAccount: (client, parameters, body, options) => {
    const p = decode(
      operations.CreditCustomerCreditsAccountRequest$outboundSchema,
      operations.CreditCustomerCreditsAccountRequest$inboundSchema,
      { ...parameters, creditDebitRequestDto: body },
    );
    const b = decode(
      components.CreditDebitRequestDto$outboundSchema,
      components.CreditDebitRequestDto$inboundSchema,
      body,
    );
    return client.customerCredits.creditAccount(p.id, b, options);
  },
  debitCustomerCreditsAccount: (client, parameters, body, options) => {
    const p = decode(
      operations.DebitCustomerCreditsAccountRequest$outboundSchema,
      operations.DebitCustomerCreditsAccountRequest$inboundSchema,
      { ...parameters, creditDebitRequestDto: body },
    );
    const b = decode(
      components.CreditDebitRequestDto$outboundSchema,
      components.CreditDebitRequestDto$inboundSchema,
      body,
    );
    return client.customerCredits.debitAccount(p.id, b, options);
  },
  reverseCustomerCreditsAccountTransaction: (client, parameters, body, options) => {
    const p = decode(
      operations.ReverseCustomerCreditsAccountTransactionRequest$outboundSchema,
      operations.ReverseCustomerCreditsAccountTransactionRequest$inboundSchema,
      { ...parameters, reverseTransactionRequestDto: body },
    );
    const b = decode(
      components.ReverseTransactionRequestDto$outboundSchema,
      components.ReverseTransactionRequestDto$inboundSchema,
      body,
    );
    return client.customerCredits.reverseTransaction(p.id, b, options);
  },
  closeCustomerCreditsAccount: (client, parameters, body, options) => {
    const p = decode(
      operations.CloseCustomerCreditsAccountRequest$outboundSchema,
      operations.CloseCustomerCreditsAccountRequest$inboundSchema,
      parameters,
    );
    return client.customerCredits.closeAccount(p.id, options);
  },
};
