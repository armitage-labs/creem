// Lists the SDK's public API as the type checker sees it: every name each entry
// point exports, with what the name declares:
//
// - `enum`: the members of an exported const enum (`export const X = { A: "a" }`);
// - `properties`: each property of an exported interface, object type or class
//   instance, with its type as the checker prints it (`?` marks an optional one);
// - `union`: the members of an exported union type, `text` any other type;
// - `signatures`: each call signature of a callable type (`Fetcher`), and
//   `construct` each constructor of a class, with parameters and return type;
// - `value`: the type of an exported function or constant.
//
// `reachable` lists, the same way, the SDK's classes, interfaces and type
// aliases that no entry point exports but an exported name's property has as
// its type, or a method or callable takes as a parameter, and those theirs
// have, and so on: the sub-SDKs (`Creem.products` is a `Products`), each method
// with its signature, and the methods' `RequestOptions`. One reached only
// through parameters is marked `input`: the caller builds it.
//
// `ref` is how the checker prints a reference to an exported type (its module
// and declared name), so a property's type finds its declaration even where
// two entry points export the same name (`Status`).
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
  const clean = (printed) =>
    printed
      .split(sources)
      .join("<sdk>")
      .replaceAll(', { with: { "resolution-mode": "import" } }', "")
      .replace(
        /import\("[^"]*\/node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?([^"]+)"\)/g,
        'import("$1")',
      );
  const text = (type) => clean(checker.typeToString(type, undefined, FORMAT));
  const signature = (sig) => clean(checker.signatureToString(sig, undefined, FORMAT));
  const print = { text, signature };
  const result = {};
  const exported = new Set();
  /** Types to walk for `reachable`, each with whether the caller builds it. */
  const queue = [];
  const walk = (input) =>
    Object.assign((type) => queue.push({ type, input }), {
      input: (type) => queue.push({ type, input: true }),
    });
  /** The SDK's own declaration of `symbol`, else null. */
  const own = (symbol) =>
    (symbol?.declarations ?? []).find((d) => d.getSourceFile().fileName.startsWith(sources));
  for (const [index, file] of files.entries()) {
    const module = checker.getSymbolAtLocation(program.getSourceFile(file));
    const names = {};
    for (const symbol of checker.getExportsOfModule(module)) {
      const target =
        symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
      exported.add(target);
      const name = symbol.getName();
      const declaration =
        NAME_ONLY.has(name) || isInternal(target)
          ? null
          : declarationOf(checker, target, print, walk(isInput(name)));
      const at = own(target);
      if (declaration && at && target.flags & TYPE)
        declaration.ref = `import("${clean(at.getSourceFile().fileName.replace(/\.ts$/, ""))}").${target.getName()}`;
      names[name] = declaration;
    }
    result[ENTRY_POINTS[index]] = Object.fromEntries(
      Object.entries(names).sort(([a], [b]) => a.localeCompare(b)),
    );
  }
  // The SDK's own classes, interfaces and aliases the exported names lead to.
  const reachable = {};
  /** For each, whether it was reached as something the SDK gives the caller. */
  const output = {};
  while (queue.length) {
    const { type, input } = queue.shift();
    const alias = type.aliasSymbol;
    const named = Boolean(alias && alias.flags & ts.SymbolFlags.TypeAlias && own(alias));
    if (!named && type.isUnion()) {
      // `RetryConfig | undefined` flattens the alias's own union into its
      // members; without `undefined` and `null` it is the alias again.
      const defined = checker.getNonNullableType(type);
      if (defined !== type && defined.aliasSymbol) queue.push({ type: defined, input });
      else for (const member of type.types) queue.push({ type: member, input });
      continue;
    }
    const symbol = named ? alias : type.getSymbol();
    if (
      !symbol ||
      !(
        symbol.flags &
        (ts.SymbolFlags.Class | ts.SymbolFlags.Interface | ts.SymbolFlags.TypeAlias)
      ) ||
      exported.has(symbol) ||
      isInternal(symbol) ||
      !own(symbol)
    )
      continue;
    const name = text(type);
    if (name in output && (input || output[name])) continue;
    output[name] = !input;
    reachable[name] = declarationOf(checker, symbol, print, walk(input));
  }
  for (const [name, declaration] of Object.entries(reachable))
    if (declaration && !output[name]) declaration.input = true;
  result.reachable = sorted(reachable);
  return result;
}

/** What can carry a `ref`: a type the SDK declares. */
const TYPE =
  ts.SymbolFlags.Interface | ts.SymbolFlags.TypeAlias | ts.SymbolFlags.Class | ts.SymbolFlags.Enum;

/**
 * What `symbol` declares. `walk` is given each property's type, with the role
 * of the declaration, and each parameter type its methods, call signatures and
 * constructors take, which the caller builds (`walk.input`).
 */
function declarationOf(checker, symbol, { text, signature }, walk) {
  const parameters = (signatures) => {
    for (const sig of signatures)
      for (const parameter of sig.getParameters()) walk.input(checker.getTypeOfSymbol(parameter));
    return signatures;
  };
  const declaration = {};
  const members = enumMembers(symbol);
  if (members) declaration.enum = members;
  if (symbol.flags & (ts.SymbolFlags.Interface | ts.SymbolFlags.TypeAlias | ts.SymbolFlags.Class)) {
    const type = checker.getDeclaredTypeOfSymbol(symbol);
    if (type.isUnion()) {
      declaration.union = [...new Set(type.types.map(text))].sort();
      // A member written out in place (`{ backoff?: BackoffStrategy }`) leads on.
      for (const member of type.types)
        if (member.getSymbol()?.flags & ts.SymbolFlags.TypeLiteral)
          for (const property of checker.getPropertiesOfType(member))
            walk(checker.getTypeOfSymbol(property));
    } else if (symbol.flags & (ts.SymbolFlags.Interface | ts.SymbolFlags.Class) || isObject(type)) {
      const properties = {};
      for (const property of checker.getPropertiesOfType(type)) {
        if (!isPublic(property)) continue;
        const optional = property.flags & ts.SymbolFlags.Optional ? "?" : "";
        const propertyType = checker.getTypeOfSymbol(property);
        properties[property.getName() + optional] = text(propertyType);
        walk(propertyType);
        parameters(checker.getSignaturesOfType(propertyType, ts.SignatureKind.Call));
      }
      declaration.properties = sorted(properties);
      const calls = parameters(checker.getSignaturesOfType(type, ts.SignatureKind.Call));
      if (calls.length) declaration.signatures = calls.map(signature);
    } else declaration.text = text(type);
  }
  if (symbol.flags & ts.SymbolFlags.Class) {
    const constructors = parameters(
      checker.getSignaturesOfType(checker.getTypeOfSymbol(symbol), ts.SignatureKind.Construct),
    );
    if (constructors.length) declaration.construct = constructors.map(signature);
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

/** An object type, or an intersection of them (`RequestOptions`). */
const isObject = (type) => Boolean(type.flags & (ts.TypeFlags.Object | ts.TypeFlags.Intersection));

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

/** `(params) => result` split at its top-level arrow, else null. */
function arrowOf(type) {
  if (!type.startsWith("(")) return null;
  let depth = 0;
  for (let i = 0; i < type.length; i++) {
    const c = type[i];
    if ("<({[".includes(c)) depth++;
    else if (">)}]".includes(c) && type[i - 1] !== "=") depth--;
    if (depth === 0)
      return type.startsWith(" => ", i + 1)
        ? { params: type.slice(0, i + 1), result: type.slice(i + 5) }
        : null;
  }
  return null;
}

/** A printed reference to one of the SDK's own types, else null. */
const refOf = (type) => (/^import\("<sdk>\/[^"]+"\)\.\w+$/.test(type) ? type : null);

/** An open enum's catch-all member: any other string still has a place. */
const isOpen = (member) => member.startsWith('import("<sdk>/types/unrecognized").Unrecognized<');

/**
 * `covers(before, after)`: whether a value of the printed type `after`
 * (current) still is a `before` (baseline) to a caller that reads it: the same
 * text; `Promise<…>` of such; a union (`unionCovers`); or an SDK type with each
 * of `before`'s properties, of such a type (it may have more, and an optional
 * one may become required). How a sub-SDK method's result may change.
 *
 * Types refer to each other in cycles, so a comparison already in progress
 * further up holds for now. Results are kept per pair: a failure always (it
 * failed even with that assumption), a pass only once it no longer rests on a
 * comparison still in progress.
 */
function comparer(lookup) {
  const known = new Map();
  /** Comparisons in progress, with their depth. */
  const active = new Map();
  /** The lowest depth of a comparison in progress that a result below rested on. */
  let assumed = Infinity;
  const covers = (before, after) => {
    if (before === after) return true;
    const pair = `${before}\u0000${after}`;
    if (known.has(pair)) return known.get(pair);
    if (active.has(pair)) {
      assumed = Math.min(assumed, active.get(pair));
      return true;
    }
    const depth = active.size;
    active.set(pair, depth);
    const outer = assumed;
    assumed = Infinity;
    const result = compare(before, after);
    active.delete(pair);
    const settled = assumed >= depth;
    if (!result || settled) known.set(pair, result);
    assumed = Math.min(outer, settled ? Infinity : assumed);
    return result;
  };
  /**
   * Each member of `after` is one of `before`'s. `before`'s members all stay
   * too, so a caller's `case "pdf":` still compiles, except `undefined` and
   * `null`, and except when both are open enums (`Unrecognized<…>`), which the
   * caller compares with any string.
   */
  const unionCovers = (was, now) =>
    now.every((a) => was.some((b) => covers(b, a))) &&
    ((was.some(isOpen) && now.some(isOpen)) ||
      was.every((b) => b === "undefined" || b === "null" || now.some((a) => covers(b, a))));
  const compare = (before, after) => {
    const promise = /^Promise<(.*)>$/s;
    if (promise.test(before) && promise.test(after))
      return covers(before.replace(promise, "$1"), after.replace(promise, "$1"));
    const afterMembers = unionOf(after);
    const beforeMembers = unionOf(before);
    if (afterMembers.length > 1 || beforeMembers.length > 1)
      return unionCovers(beforeMembers, afterMembers);
    const was = lookup.before(refOf(before));
    const now = lookup.after(refOf(after));
    if (!was || !now) return false;
    if (was.union || now.union)
      return Boolean(was.union && now.union && unionCovers(was.union, now.union));
    if (!was.properties || !now.properties || was.text || now.text) return false;
    return Object.entries(was.properties).every(([property, type]) => {
      const bare = property.replace(/\?$/, "");
      const found =
        now.properties[property] ?? (property.endsWith("?") ? now.properties[bare] : undefined);
      return found !== undefined && covers(type, found);
    });
  };
  return covers;
}

/** Finds a type's declaration in a listing by its printed reference (`ref`). */
function finder(listing) {
  const all = new Map();
  for (const [entry, names] of Object.entries(listing))
    for (const [name, declaration] of Object.entries(names))
      if (entry === "reachable") all.set(name, declaration);
      else if (declaration?.ref) all.set(declaration.ref, declaration);
  return (ref) => (ref ? all.get(ref) : undefined);
}

/** A sub-SDK class (`Creem.products`): the SDK implements it, the caller calls it. */
const isSubSdk = (entry, name) => entry === "reachable" && name.startsWith('import("<sdk>/sdk/');

/**
 * What `current` takes away from or changes in `baseline`: a missing name, a
 * lost enum or union member, a property removed or retyped, a changed type,
 * value or signature. Additions (names, members, properties) are allowed, and
 * a type the caller builds may widen: a required property may become optional,
 * and a property's type may gain union members (`| null`). That is a request
 * type by name (`isInput`), or one reached only through parameters (`input`:
 * `RequestOptions`). A method's parameters must stay the same. A sub-SDK
 * method's result may change in a way that still gives the caller what it read
 * before (`covers`); anything else the caller implements (`Logger`, the hooks)
 * compares as it is, since the SDK reads what the caller's code returns.
 */
export function breakingChanges(baseline, current) {
  const found = [];
  const covers = comparer({ before: finder(baseline), after: finder(current) });
  for (const [entry, names] of Object.entries(baseline)) {
    const now = current[entry] ?? {};
    for (const [name, before] of Object.entries(names)) {
      const where = `${entry} ${name}`;
      if (!(name in now)) {
        found.push(`${where}: no longer ${entry === "reachable" ? "reachable" : "exported"}`);
        continue;
      }
      const after = now[name] ?? {};
      if (!before) continue;
      const input = isInput(name) || before.input === true;
      for (const [member, value] of Object.entries(before.enum ?? {}))
        if (after.enum?.[member] !== value) found.push(`${where}: enum member ${member} changed`);
      for (const member of before.union ?? [])
        if (!after.union?.includes(member)) found.push(`${where}: union member ${member} removed`);
      for (const [property, type] of Object.entries(before.properties ?? {})) {
        const optional = property.endsWith("?");
        const bare = optional ? property.slice(0, -1) : property;
        let now = after.properties?.[property];
        if (now === undefined && !optional && input) now = after.properties?.[`${bare}?`];
        if (now === type) continue;
        const widened =
          now !== undefined &&
          input &&
          unionOf(type).every((member) => unionOf(now).includes(member));
        if (widened) continue;
        const was = isSubSdk(entry, name) ? arrowOf(type) : null;
        const is = now === undefined ? null : arrowOf(now);
        if (was && is && was.params === is.params && covers(was.result, is.result)) continue;
        const what =
          now ??
          (after.properties?.[optional ? bare : `${bare}?`] ? "optional changed" : "removed");
        found.push(`${where}.${property}: ${type} -> ${what}`);
      }
      for (const kind of ["signatures", "construct"])
        for (const sig of before[kind] ?? [])
          if (!after[kind]?.includes(sig))
            found.push(
              `${where}: ${kind === "construct" ? "constructor" : "call signature"} ${sig} removed`,
            );
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
