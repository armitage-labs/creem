// Lists the SDK's public API as the type checker sees it: every name each entry
// point exports, with what the name declares:
//
// - `enum`: the members of an exported const enum (`export const X = { A: "a" }`);
// - `properties`: each property of an exported interface, object type or class
//   instance, with its type as the checker prints it (`?` marks an optional one);
// - `union`: the members of an exported union type, `text` any other type;
// - `value`: the type of an exported function or constant.
//
// Types print by name (`status?: Status | undefined`), and each name is listed
// on its own, so a retyped property and a changed type both show. Listed by
// name only: `SDK_METADATA`, whose versions `version-packages` rewrites every
// release, and what the generator marks `@internal` (the zod schemas and
// `$Outbound` types), whose printed types follow the zod version.
//
// tests/public-exports.test.ts compares it with the last release's list
// (tests/public-exports.baseline.json); `node tests/public-exports.mjs <sdk
// root>` prints it, which is how the baseline is made.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");

export const ENTRY_POINTS = [
  "index.ts",
  "models/components/index.ts",
  "models/operations/index.ts",
  "models/errors/index.ts",
];

/** Exports listed by name only: their values change with every release. */
const NAME_ONLY = new Set(["SDK_METADATA"]);

const FORMAT =
  ts.TypeFormatFlags.NoTruncation |
  ts.TypeFormatFlags.UseFullyQualifiedType |
  ts.TypeFormatFlags.WriteArrowStyleSignature;

/**
 * `{ entry: { name: declaration or null } }` for the SDK at `root`. `edit`, if
 * given, changes a source file's text as it is read (the tests' in-memory copy).
 */
export function listPublicExports(root, edit) {
  root = path.resolve(root);
  const files = ENTRY_POINTS.map((entry) => path.join(root, "src", entry));
  const options = {
    noEmit: true,
    skipLibCheck: true,
    strict: true,
    exactOptionalPropertyTypes: true,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ES2022,
  };
  const host = ts.createCompilerHost(options);
  if (edit) {
    const readFile = host.readFile.bind(host);
    host.readFile = (file) => {
      const text = readFile(file);
      return text === undefined ? text : edit(file, text);
    };
    host.getSourceFile = (file, language) => {
      const text = host.readFile(file);
      return text === undefined ? undefined : ts.createSourceFile(file, text, language);
    };
  }
  const program = ts.createProgram(files, options, host);
  const checker = program.getTypeChecker();
  // Paths print inside `import("…")`; the same file reads the same in any copy.
  const sources = path.join(root, "src");
  const text = (type) =>
    checker
      .typeToString(type, undefined, FORMAT)
      .split(sources)
      .join("<sdk>")
      .replaceAll(', { with: { "resolution-mode": "import" } }', "")
      .replace(
        /import\("[^"]*\/node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?([^"]+)"\)/g,
        'import("$1")',
      );
  const result = {};
  for (const [index, file] of files.entries()) {
    const module = checker.getSymbolAtLocation(program.getSourceFile(file));
    const names = {};
    for (const symbol of checker.getExportsOfModule(module)) {
      const target =
        symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
      names[symbol.getName()] =
        NAME_ONLY.has(symbol.getName()) || isInternal(target)
          ? null
          : declarationOf(checker, target, text);
    }
    result[ENTRY_POINTS[index]] = Object.fromEntries(
      Object.entries(names).sort(([a], [b]) => a.localeCompare(b)),
    );
  }
  return result;
}

function declarationOf(checker, symbol, text) {
  const declaration = {};
  const members = enumMembers(symbol);
  if (members) declaration.enum = members;
  if (symbol.flags & (ts.SymbolFlags.Interface | ts.SymbolFlags.TypeAlias | ts.SymbolFlags.Class)) {
    const type = checker.getDeclaredTypeOfSymbol(symbol);
    if (type.isUnion()) declaration.union = [...new Set(type.types.map(text))].sort();
    else if (symbol.flags & (ts.SymbolFlags.Interface | ts.SymbolFlags.Class) || isObject(type)) {
      const properties = {};
      for (const property of checker.getPropertiesOfType(type)) {
        if (!isPublic(property)) continue;
        const optional = property.flags & ts.SymbolFlags.Optional ? "?" : "";
        properties[property.getName() + optional] = text(checker.getTypeOfSymbol(property));
      }
      declaration.properties = sorted(properties);
    } else declaration.text = text(type);
  }
  if (
    !members &&
    symbol.flags & (ts.SymbolFlags.Function | ts.SymbolFlags.Variable) &&
    !(symbol.flags & ts.SymbolFlags.Class)
  )
    declaration.value = text(checker.getTypeOfSymbol(symbol));
  return Object.keys(declaration).length ? declaration : null;
}

/** Marked `@internal` (the zod schemas, `$Outbound` types): only its name counts. */
const isInternal = (symbol) =>
  (symbol.declarations ?? []).some((d) =>
    ts.getJSDocTags(d).some((tag) => tag.tagName.text === "internal"),
  );

const isObject = (type) => Boolean(type.flags & ts.TypeFlags.Object);

/** Not private, protected, `#private` or `_`-prefixed (the generator's own). */
function isPublic(property) {
  if (/^[#_]/.test(property.getName())) return false;
  return !(property.declarations ?? []).some(
    (d) =>
      ts.getCombinedModifierFlags(d) & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected) ||
      (d.name && ts.isPrivateIdentifier(d.name)),
  );
}

const sorted = (object) =>
  Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)));

/** The members of `export const X = { A: "a" } as const`, else null. */
function enumMembers(symbol) {
  const declaration = symbol.valueDeclaration;
  if (!declaration || !ts.isVariableDeclaration(declaration)) return null;
  let init = declaration.initializer;
  while (init && (ts.isAsExpression(init) || ts.isSatisfiesExpression?.(init)))
    init = init.expression;
  if (!init || !ts.isObjectLiteralExpression(init)) return null;
  const members = {};
  for (const property of init.properties) {
    if (!ts.isPropertyAssignment(property) || !ts.isStringLiteral(property.initializer))
      return null;
    members[property.name.getText()] = property.initializer.text;
  }
  return members;
}

/** The members of a printed union, split at its top level only. */
function unionOf(type) {
  const members = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < type.length; i++) {
    const c = type[i];
    if ("<({[".includes(c)) depth++;
    else if (">)}]".includes(c) && type[i - 1] !== "=") depth--;
    else if (depth === 0 && type.startsWith(" | ", i)) {
      members.push(type.slice(start, i));
      start = i + 3;
    }
  }
  members.push(type.slice(start));
  return members;
}

/**
 * A type the caller builds and the SDK sends (a request body, an operation's
 * request): it may take more than before without breaking a caller.
 */
const isInput = (name) => /Request(Entity|Dto)?$/.test(name);

/**
 * What `current` takes away from or changes in `baseline`: a missing name, a
 * lost enum or union member, a property removed or retyped, a changed type or
 * value. Additions (names, members, properties) are allowed, and an input type
 * (`isInput`) may widen: a required property may become optional, and a
 * property's type may gain union members (`| null`).
 */
export function breakingChanges(baseline, current) {
  const found = [];
  for (const [entry, names] of Object.entries(baseline)) {
    const now = current[entry] ?? {};
    for (const [name, before] of Object.entries(names)) {
      const where = `${entry} ${name}`;
      if (!(name in now)) {
        found.push(`${where}: no longer exported`);
        continue;
      }
      const after = now[name] ?? {};
      if (!before) continue;
      for (const [member, value] of Object.entries(before.enum ?? {}))
        if (after.enum?.[member] !== value) found.push(`${where}: enum member ${member} changed`);
      for (const member of before.union ?? [])
        if (!after.union?.includes(member)) found.push(`${where}: union member ${member} removed`);
      for (const [property, type] of Object.entries(before.properties ?? {})) {
        const optional = property.endsWith("?");
        const bare = optional ? property.slice(0, -1) : property;
        let now = after.properties?.[property];
        if (now === undefined && !optional && isInput(name)) now = after.properties?.[`${bare}?`];
        if (now === type) continue;
        const widened =
          now !== undefined &&
          isInput(name) &&
          unionOf(type).every((member) => unionOf(now).includes(member));
        if (widened) continue;
        const what =
          now ??
          (after.properties?.[optional ? bare : `${bare}?`] ? "optional changed" : "removed");
        found.push(`${where}.${property}: ${type} -> ${what}`);
      }
      if (before.text !== undefined && after.text !== before.text)
        found.push(`${where}: ${before.text} -> ${after.text}`);
      if (before.value !== undefined && after.value !== before.value)
        found.push(`${where}: ${before.value} -> ${after.value}`);
    }
  }
  return found;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  process.stdout.write(JSON.stringify(listPublicExports(root), null, 2) + "\n");
}
