import { readdir, rm } from "node:fs/promises";
import { join, relative } from "node:path";
import process from "node:process";

const root = process.cwd();

const removeIfExists = (path) => rm(path, { recursive: true, force: true });

const walkFiles = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true }).catch((error) => {
    if (error?.code === "ENOENT") return [];
    throw error;
  });

  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(path)));
    } else {
      files.push(path);
    }
  }
  return files;
};

const removeMatchingFiles = async (dir, shouldRemove) => {
  const files = await walkFiles(dir);
  await Promise.all(
    files
      .filter((file) => shouldRemove(relative(dir, file).replaceAll("\\", "/")))
      .map(removeIfExists),
  );
};

await removeIfExists(join(root, ".svelte-kit"));

// svelte-package emits declarations for imported shared TypeScript modules next
// to their source files. Core declarations are already emitted by the main tsc
// build into dist/core, so source-tree copies are build artifacts.
await removeMatchingFiles(
  join(root, "src", "core"),
  (file) => file.endsWith(".d.ts") || file.endsWith(".d.ts.map"),
);

// svelte-package scans the full input directory and has no test exclude option.
// Tests should not be part of the Svelte package output.
await removeMatchingFiles(join(root, "dist", "svelte"), (file) =>
  /\.(test|spec)\.(js|js\.map|d\.ts|d\.ts\.map)$/.test(file),
);
