import { it, expect, vi } from "vitest";
import { harness } from "./helpers";

const upload = {
  id: "file_1",
  uploadUrl: "https://creem-files.s3.eu-west-1.amazonaws.com/",
  uploadFields: { key: "store/sto_1/ebook.epub", "Content-Type": "application/epub+zip" },
  expiresAt: "2026-11-17T11:00:00.000Z",
};

it("files create-upload sends the exact SDK arguments and prints the upload as JSON", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.files, "createUpload").mockResolvedValue(upload as never);
  const result = await h.run([
    "files",
    "create-upload",
    "--purpose",
    "product_file",
    "--filename",
    "ebook.epub",
    "--content-type",
    "application/epub+zip",
    "--size",
    "52000",
    "--sha256",
    "n4bQgYhMfWWaL+qgxVrQFaO/TxsrC4Is0V1sFbDwCgg=",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    {
      purpose: "product_file",
      filename: "ebook.epub",
      contentType: "application/epub+zip",
      size: 52000,
      sha256: "n4bQgYhMfWWaL+qgxVrQFaO/TxsrC4Is0V1sFbDwCgg=",
    },
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.code, result.stderr).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual(upload);
});

it("files create-upload takes the body from --data", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.files, "createUpload").mockRejectedValue(new Error("SDK_SENTINEL"));
  const body = {
    purpose: "product_file",
    filename: "ebook.epub",
    contentType: "application/epub+zip",
    size: 52000,
    sha256: "n4bQgYhMfWWaL+qgxVrQFaO/TxsrC4Is0V1sFbDwCgg=",
  };
  const result = await h.run(["files", "create-upload", "--data", JSON.stringify(body), "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    body,
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
});

it("files create-upload refuses a body without the required fields before calling the API", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.files, "createUpload");
  const result = await h.run(["files", "create-upload", "--filename", "ebook.epub", "--json"]);
  expect(result.code).toBe(2);
  expect(spy).not.toHaveBeenCalled();
});

it("files confirm-upload sends the exact SDK arguments and prints the file as JSON", async () => {
  const h = harness();
  const file = { id: "file_1", object: "file", purpose: "product_file", filename: "ebook.epub" };
  const spy = vi.spyOn(h.client.files, "confirmUpload").mockResolvedValue(file as never);
  const result = await h.run(["files", "confirm-upload", "file_1", "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    { id: "file_1" },
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.code, result.stderr).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual(file);
});

it("files confirm-upload requires the upload ID", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.files, "confirmUpload");
  const result = await h.run(["files", "confirm-upload", "--json"]);
  expect(result.code).toBe(2);
  expect(spy).not.toHaveBeenCalled();
});

it.each([
  [
    ["files", "--help"],
    ["create-upload", "confirm-upload"],
  ],
  [
    ["files", "create-upload", "--help"],
    ["--data", "--purpose", "--filename", "--content-type", "--size", "--sha256"],
  ],
  [["files", "confirm-upload", "--help"], ["<id>"]],
])("%j documents its commands and flags", async (args, expected) => {
  const result = await harness().run(args);
  expect(result.code, result.stderr).toBe(0);
  for (const text of expected) expect(result.stdout).toContain(text);
});
