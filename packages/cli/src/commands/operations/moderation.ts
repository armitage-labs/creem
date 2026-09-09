import * as components from "creem/models/components";
import { decode, type OperationHandler } from "../../lib/operation";

export const handlers: Record<string, OperationHandler> = {
  screenPrompt: (client, parameters, body, options) => {
    const b = decode(
      components.ScreenPromptRequest$outboundSchema,
      components.ScreenPromptRequest$inboundSchema,
      body,
    );
    return client.moderation.screenPrompt(b, options);
  },
};
