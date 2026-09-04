import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { validateRepositoryContracts } from "./check-repository-contracts.mjs";

const LICENSE = "fixture MIT license\n";
const REPOSITORY_URL = "https://github.com/armitage-labs/creem.git";
const REPOSITORY_WEB_URL = "https://github.com/armitage-labs/creem";

function write(root, relativePath, contents) {
  const file = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

function writeJson(root, relativePath, value) {
  write(root, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function publicManifest(packagePath) {
  return {
    name: "@creem_io/core",
    version: "1.0.0",
    repository: { type: "git", url: REPOSITORY_URL, directory: packagePath },
    homepage: `${REPOSITORY_WEB_URL}/tree/main/${packagePath}`,
    bugs: { url: `${REPOSITORY_WEB_URL}/issues` },
    files: ["dist", "README.md", "LICENSE", "CHANGELOG.md"],
  };
}

function writePackage(root, packagePath, manifest, { published = false } = {}) {
  writeJson(root, `${packagePath}/package.json`, manifest);
  write(root, `${packagePath}/README.md`, "# Package\n\nUse `creem`.\n");
  if (published) {
    write(root, `${packagePath}/LICENSE`, LICENSE);
    write(root, `${packagePath}/CHANGELOG.md`, "# Changelog\n");
  }
}

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "creem-repository-contracts-"));
  write(root, "LICENSE", LICENSE);
  writeJson(root, "package-policy.json", {
    $schemaVersion: 1,
    ignoredDirectories: ["dist", "node_modules"],
    allowedNestedWorkflowDirectories: [],
    packages: {
      "packages/core": { type: "published", category: "shared" },
      "packages/docs": { type: "private", category: "docs" },
      "packages/creem-io": { type: "deprecated", category: "deprecated" },
    },
  });
  writeJson(root, ".changeset/config.json", { ignore: ["creem-docs", "creem_io"] });
  writePackage(root, "packages/core", publicManifest("packages/core"), { published: true });
  writePackage(root, "packages/docs", { name: "creem-docs", private: true });
  writePackage(root, "packages/creem-io", {
    name: "creem_io",
    deprecated: "Migrate to creem.",
  });
  write(root, "packages/creem-io/LICENSE", "historical license\n");
  write(root, "packages/creem-io/CHANGELOG.md", "# Changelog\n");
  return root;
}

function errorsAfter(mutate) {
  const root = createFixture();
  try {
    mutate(root);
    return validateRepositoryContracts({ rootDir: root });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("accepts a valid repository contract", () => {
  assert.deepEqual(
    errorsAfter(() => {}),
    [],
  );
});

const failures = [
  {
    name: "unclassified source package",
    expected: "package is not classified",
    mutate(root) {
      writePackage(root, "packages/ui/new-package", { name: "new-package", private: true });
    },
  },
  {
    name: "published package without a changelog",
    expected: "missing CHANGELOG.md",
    mutate(root) {
      fs.unlinkSync(path.join(root, "packages/core/CHANGELOG.md"));
    },
  },
  {
    name: "drifted package license",
    expected: "LICENSE must exactly match",
    mutate(root) {
      write(root, "packages/core/LICENSE", "different license\n");
    },
  },
  {
    name: "public private package",
    expected: "must set private: true",
    mutate(root) {
      writePackage(root, "packages/docs", { name: "creem-docs" });
    },
  },
  {
    name: "published package excluded from Changesets",
    expected: "must be eligible for Changesets",
    mutate(root) {
      writeJson(root, ".changeset/config.json", {
        ignore: ["@creem_io/core", "creem-docs", "creem_io"],
      });
    },
  },
  {
    name: "unapproved nested workflow",
    expected: "nested workflows are inert",
    mutate(root) {
      write(root, "packages/core/.github/workflows/release.yml", "name: inert\n");
    },
  },
];

for (const failure of failures) {
  test(`rejects ${failure.name}`, () => {
    assert.ok(
      errorsAfter(failure.mutate).some((error) => error.includes(failure.expected)),
      `expected an error containing: ${failure.expected}`,
    );
  });
}
