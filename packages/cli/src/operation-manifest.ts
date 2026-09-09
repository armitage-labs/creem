import manifest from "./operation-manifest.json";

export interface InputSchema {
  type?: string;
  enum?: readonly unknown[];
  format?: string;
  minimum?: number;
  maximum?: number;
  nullable?: boolean;
  properties?: Record<string, InputSchema>;
  required?: string[];
  items?: InputSchema;
  additionalProperties?: boolean;
}
export interface OperationMapping {
  operationId: string;
  sdkMethod: string;
  cliPath: string;
  disposition: "implemented" | "planned" | "excluded";
  description: string;
  argument?: string;
  parameters: Array<{
    name: string;
    sdkName: string;
    in: string;
    cliFlagOrArgument: string;
    required: boolean;
    schema: InputSchema;
  }>;
  body?: {
    viaData: boolean;
    schema: InputSchema;
    primaryFlags: Record<string, string>;
    positional?: string;
  };
  pagination: "none" | "page" | "cursor";
  destructive: boolean;
}
// Checked independently against OpenAPI, generated SDK signatures and Commander in CI.
export const operationManifest = manifest as OperationMapping[];
