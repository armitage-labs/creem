import { describe, it, expect } from "vitest";
import { toCamelCase } from "../utils";

describe("toCamelCase", () => {
  it("converts snake_case keys to camelCase", () => {
    expect(toCamelCase({ my_key: "value" })).toEqual({ myKey: "value" });
  });

  it("converts deeply nested objects", () => {
    const input = {
      top_level: {
        nested_key: {
          deep_value: 42,
        },
      },
    };
    expect(toCamelCase(input)).toEqual({
      topLevel: {
        nestedKey: {
          deepValue: 42,
        },
      },
    });
  });

  it("converts keys inside arrays", () => {
    const input = [{ first_name: "Alice" }, { last_name: "Bob" }];
    expect(toCamelCase(input)).toEqual([{ firstName: "Alice" }, { lastName: "Bob" }]);
  });

  it("handles arrays nested inside objects", () => {
    const input = { my_items: [{ item_name: "a" }] };
    expect(toCamelCase(input)).toEqual({ myItems: [{ itemName: "a" }] });
  });

  it("returns primitives unchanged", () => {
    expect(toCamelCase("hello")).toBe("hello");
    expect(toCamelCase(42)).toBe(42);
    expect(toCamelCase(true)).toBe(true);
  });

  it("returns null unchanged", () => {
    expect(toCamelCase(null)).toBe(null);
  });

  it("throws on undefined (does not handle undefined input)", () => {
    expect(() => toCamelCase(undefined)).toThrow();
  });

  it("handles empty objects and arrays", () => {
    expect(toCamelCase({})).toEqual({});
    expect(toCamelCase([])).toEqual([]);
  });

  it("leaves already camelCase keys unchanged", () => {
    expect(toCamelCase({ alreadyCamel: 1 })).toEqual({ alreadyCamel: 1 });
  });

  it("handles multiple underscores", () => {
    expect(toCamelCase({ a_b_c: 1 })).toEqual({ aBC: 1 });
  });

  it("converts custom_fields with nested text/checkbox values from webhook payload", () => {
    const apiPayload = {
      custom_fields: [
        {
          type: "text",
          key: "company",
          label: "Company Name",
          optional: false,
          text: {
            max_length: 200,
            minimum_length: 1,
            value: "Acme Corp",
          },
        },
        {
          type: "checkbox",
          key: "terms",
          label: "Accept Terms",
          optional: false,
          checkbox: {
            label: "I agree",
            value: true,
          },
        },
      ],
    };

    const result = toCamelCase(apiPayload);

    expect(result.customFields[0].text.value).toBe("Acme Corp");
    expect(result.customFields[0].text.maxLength).toBe(200);
    expect(result.customFields[0].text.minimumLength).toBe(1);
    expect(result.customFields[1].checkbox.value).toBe(true);
    expect(result.customFields[1].checkbox.label).toBe("I agree");
  });

  it("converts min_length to minLength for backward compatibility", () => {
    const apiPayload = {
      custom_fields: [
        {
          type: "text",
          key: "name",
          label: "Name",
          text: {
            min_length: 2,
            max_length: 100,
            value: "test",
          },
        },
      ],
    };

    const result = toCamelCase(apiPayload);

    // min_length converts to minLength (backward compat)
    expect(result.customFields[0].text.minLength).toBe(2);
    expect(result.customFields[0].text.maxLength).toBe(100);
    expect(result.customFields[0].text.value).toBe("test");
  });
});
