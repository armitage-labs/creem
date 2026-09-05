import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PUBLISHED_TYPES = new Set(["published", "published-cli", "generated-sdk"]);
const NON_PUBLISHED_TYPES = new Set(["private", "example", "test-fixture"]);
const REPOSITORY_URL = "https://github.com/armitage-labs/creem.git";
const REPOSITORY_WEB_URL = "https://github.com/armitage-labs/creem";
const ISSUES_URL = `${REPOSITORY_WEB_URL}/issues`;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function normalize(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function discoverDirectories(rootDir, ignoredDirectories, match) {
  const found = [];

  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || ignoredDirectories.has(entry.name)) continue;
      const child = path.join(directory, entry.name);
      if (match(child)) found.push(normalize(path.relative(rootDir, child)));
      walk(child);
    }
  }

  walk(path.join(rootDir, "packages"));
  return found.sort();
}

function categoryAcceptsPath(category, packagePath) {
  const patterns = {
    sdk: /^packages\/sdk$/,
    cli: /^packages\/cli$/,
    shared: /^packages\/(?:core|webhook-types)$/,
    integration: /^packages\/integrations\/[^/]+$/,
    ui: /^packages\/ui\/[^/]+$/,
    docs: /^packages\/docs$/,
    example: /^(?:packages\/examples\/[^/]+|packages\/.+\/(?:example|examples)(?:\/[^/]+)?)$/,
    "test-fixture": /^packages\/.+\/test\/[^/]+$/,
    deprecated: /^packages\/creem-io$/,
  };
  return patterns[category]?.test(packagePath) ?? false;
}

function validatePublishedPackage(rootDir, packagePath, manifest, rootLicense, errors) {
  const packageDir = path.join(rootDir, packagePath);
  const requiredFiles = ["README.md", "LICENSE", "CHANGELOG.md"];

  if (
    manifest.repository?.type !== "git" ||
    manifest.repository?.url !== REPOSITORY_URL ||
    manifest.repository?.directory !== packagePath
  ) {
    errors.push(`${packagePath}: repository metadata must point to its monorepo directory`);
  }
  const homepage = `${REPOSITORY_WEB_URL}/tree/main/${packagePath}`;
  if (manifest.homepage !== homepage) errors.push(`${packagePath}: homepage must be ${homepage}`);
  if (manifest.bugs?.url !== ISSUES_URL)
    errors.push(`${packagePath}: bugs.url must be ${ISSUES_URL}`);

  for (const file of requiredFiles) {
    const localFile = path.join(packageDir, file);
    if (!fs.existsSync(localFile)) errors.push(`${packagePath}: missing ${file}`);
    if (!manifest.files?.includes(file)) errors.push(`${packagePath}: files must include ${file}`);
  }

  const localLicense = path.join(packageDir, "LICENSE");
  if (fs.existsSync(localLicense) && fs.readFileSync(localLicense, "utf8") !== rootLicense) {
    errors.push(`${packagePath}: LICENSE must exactly match the root LICENSE`);
  }
}

function validateGeneratedSdk(rootDir, packagePath, errors) {
  const packageDir = path.join(rootDir, packagePath);
  const generatorFile = path.join(packageDir, ".speakeasy", "gen.yaml");
  const generator = fs.existsSync(generatorFile) ? fs.readFileSync(generatorFile, "utf8") : "";
  for (const fragment of [
    `repoSubDirectory: ${packagePath}`,
    "- LICENSE",
    "- CHANGELOG.md",
    "publint --strict --pack pnpm && attw --pack .",
  ]) {
    if (!generator.includes(fragment)) {
      errors.push(`${packagePath}: generator config must preserve ${fragment}`);
    }
  }

  if (!fs.existsSync(path.join(packageDir, "RELEASES.md"))) {
    errors.push(`${packagePath}: generated SDK must retain RELEASES.md`);
  }
  const genIgnoreFile = path.join(packageDir, ".genignore");
  const ignored = fs.existsSync(genIgnoreFile)
    ? fs.readFileSync(genIgnoreFile, "utf8").split(/\r?\n/)
    : [];
  for (const file of ["LICENSE", "CHANGELOG.md", "CONTRIBUTING.md", ".attw.json"]) {
    if (!ignored.includes(file)) errors.push(`${packagePath}: .genignore must preserve ${file}`);
  }
}

export function validateRepositoryContracts({
  rootDir = path.resolve(import.meta.dirname, ".."),
  policyFile = path.join(rootDir, "package-policy.json"),
} = {}) {
  const errors = [];
  const policy = readJson(policyFile);
  const ignoredDirectories = new Set(policy.ignoredDirectories ?? []);
  const registered = Object.keys(policy.packages).sort();
  const discovered = discoverDirectories(rootDir, ignoredDirectories, (directory) =>
    fs.existsSync(path.join(directory, "package.json")),
  );
  const rootLicenseFile = path.join(rootDir, "LICENSE");
  const rootLicense = fs.existsSync(rootLicenseFile)
    ? fs.readFileSync(rootLicenseFile, "utf8")
    : "";

  if (!rootLicense) errors.push("repository: missing root LICENSE");
  for (const packagePath of discovered.filter((item) => !registered.includes(item))) {
    errors.push(`${packagePath}: package is not classified in package-policy.json`);
  }
  for (const packagePath of registered.filter((item) => !discovered.includes(item))) {
    errors.push(`${packagePath}: registered package does not exist`);
  }

  for (const packagePath of registered.filter((item) => discovered.includes(item))) {
    const rules = policy.packages[packagePath];
    const packageDir = path.join(rootDir, packagePath);
    const manifest = readJson(path.join(packageDir, "package.json"));

    if (!categoryAcceptsPath(rules.category, packagePath)) {
      errors.push(`${packagePath}: path is invalid for category ${rules.category}`);
    }
    if (!fs.existsSync(path.join(packageDir, "README.md"))) {
      errors.push(`${packagePath}: missing README.md`);
    }
    if (PUBLISHED_TYPES.has(rules.type)) {
      validatePublishedPackage(rootDir, packagePath, manifest, rootLicense, errors);
    }
    if (rules.type === "generated-sdk") validateGeneratedSdk(rootDir, packagePath, errors);
    if (NON_PUBLISHED_TYPES.has(rules.type)) {
      if (manifest.private !== true) errors.push(`${packagePath}: must set private: true`);
      if (manifest.publishConfig?.access === "public") {
        errors.push(`${packagePath}: non-published package must not enable public npm publishing`);
      }
    }
    if (rules.type === "deprecated") {
      if (typeof manifest.deprecated !== "string" || !manifest.deprecated.trim()) {
        errors.push(`${packagePath}: deprecated package must declare a deprecation message`);
      }
      const readme = fs.existsSync(path.join(packageDir, "README.md"))
        ? fs.readFileSync(path.join(packageDir, "README.md"), "utf8")
        : "";
      if (!readme.includes("creem")) {
        errors.push(`${packagePath}: deprecated README must name the creem migration target`);
      }
      for (const file of ["LICENSE", "CHANGELOG.md"]) {
        if (!fs.existsSync(path.join(packageDir, file))) {
          errors.push(`${packagePath}: deprecated package must retain ${file}`);
        }
      }
    }
  }

  const ignoredByChangesets = new Set(
    readJson(path.join(rootDir, ".changeset/config.json")).ignore,
  );
  for (const [packagePath, rules] of Object.entries(policy.packages)) {
    if (!discovered.includes(packagePath)) continue;
    if (!/^packages\/(?:[^/]+|(?:integrations|ui)\/[^/]+)$/.test(packagePath)) continue;
    const name = readJson(path.join(rootDir, packagePath, "package.json")).name;
    if (["private", "deprecated"].includes(rules.type) && !ignoredByChangesets.has(name)) {
      errors.push(`${packagePath}: private/deprecated workspace must be ignored by Changesets`);
    }
    if (PUBLISHED_TYPES.has(rules.type) && ignoredByChangesets.has(name)) {
      errors.push(`${packagePath}: active published package must be eligible for Changesets`);
    }
  }

  const approvedWorkflows = new Set(policy.allowedNestedWorkflowDirectories ?? []);
  const nestedWorkflows = discoverDirectories(
    rootDir,
    ignoredDirectories,
    (directory) =>
      path.basename(directory) === "workflows" &&
      path.basename(path.dirname(directory)) === ".github",
  );
  for (const workflowPath of nestedWorkflows) {
    if (!approvedWorkflows.has(workflowPath)) {
      errors.push(`${workflowPath}: nested workflows are inert and must be explicitly approved`);
    }
  }
  for (const workflowPath of approvedWorkflows) {
    if (!nestedWorkflows.includes(workflowPath)) {
      errors.push(`${workflowPath}: approved nested workflow directory does not exist`);
    }
  }

  return errors;
}

function main() {
  const errors = validateRepositoryContracts();
  if (errors.length) {
    console.error("Repository contract check failed:\n");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log("Repository contracts are valid.");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
