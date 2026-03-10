import { describe, it, expect } from "vitest";
import { required, requiredWhen, isString, isNumber, isBoolean, isArray } from "../validate";

describe("required", () => {
  it("throws on undefined", () => {
    expect(() => required(undefined, "field")).toThrow("Missing required parameter: field");
  });

  it("throws on null", () => {
    expect(() => required(null, "field")).toThrow("Missing required parameter: field");
  });

  it("throws on empty string", () => {
    expect(() => required("", "field")).toThrow("Missing required parameter: field");
  });

  it("passes for valid values", () => {
    expect(() => required("value", "field")).not.toThrow();
    expect(() => required(0, "field")).not.toThrow();
    expect(() => required(false, "field")).not.toThrow();
  });
});

describe("requiredWhen", () => {
  it("throws with condition context", () => {
    expect(() => requiredWhen(undefined, "billingPeriod", "billingType is 'recurring'")).toThrow(
      "Missing required parameter: billingPeriod. billingPeriod is required when billingType is 'recurring'",
    );
  });

  it("passes for valid values", () => {
    expect(() =>
      requiredWhen("monthly", "billingPeriod", "billingType is 'recurring'"),
    ).not.toThrow();
  });
});

describe("isString", () => {
  it("throws when value is not a string", () => {
    expect(() => isString(123, "name")).toThrow("Parameter 'name' must be a string");
  });

  it("allows undefined", () => {
    expect(() => isString(undefined, "name")).not.toThrow();
  });

  it("passes for strings", () => {
    expect(() => isString("hello", "name")).not.toThrow();
  });
});

describe("isNumber", () => {
  it("throws when value is not a number", () => {
    expect(() => isNumber("abc", "count")).toThrow("Parameter 'count' must be a number");
  });

  it("allows undefined", () => {
    expect(() => isNumber(undefined, "count")).not.toThrow();
  });

  it("passes for numbers", () => {
    expect(() => isNumber(42, "count")).not.toThrow();
  });
});

describe("isBoolean", () => {
  it("throws when value is not a boolean", () => {
    expect(() => isBoolean("true", "flag")).toThrow("Parameter 'flag' must be a boolean");
  });

  it("allows undefined", () => {
    expect(() => isBoolean(undefined, "flag")).not.toThrow();
  });

  it("passes for booleans", () => {
    expect(() => isBoolean(true, "flag")).not.toThrow();
    expect(() => isBoolean(false, "flag")).not.toThrow();
  });
});

describe("isArray", () => {
  it("throws when value is not an array", () => {
    expect(() => isArray("not-array", "items")).toThrow("Parameter 'items' must be an array");
  });

  it("allows undefined", () => {
    expect(() => isArray(undefined, "items")).not.toThrow();
  });

  it("passes for arrays", () => {
    expect(() => isArray([], "items")).not.toThrow();
    expect(() => isArray([1, 2], "items")).not.toThrow();
  });
});
