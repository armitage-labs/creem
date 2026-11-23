// Lists the SDK's public API as the type checker sees it: every name each entry
// point exports (values and types), and the members of every exported const
// enum. tests/public-exports.test.ts compares it with the last release's list
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

/** `{ entry: { name: enum members or null } }` for the SDK at `root`. */
export function listPublicExports(root) {
  const files = ENTRY_POINTS.map((entry) => path.join(root, "src", entry));
  const program = ts.createProgram(files, {
    noEmit: true,
    skipLibCheck: true,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ES2022,
  });
  const checker = program.getTypeChecker();
  const result = {};
  for (const [index, file] of files.entries()) {
    const module = checker.getSymbolAtLocation(program.getSourceFile(file));
    const names = {};
    for (const symbol of checker.getExportsOfModule(module)) {
      const target =
        symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
      names[symbol.getName()] = enumMembers(target);
    }
    result[ENTRY_POINTS[index]] = Object.fromEntries(
      Object.entries(names).sort(([a], [b]) => a.localeCompare(b)),
    );
  }
  return result;
}

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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  process.stdout.write(JSON.stringify(listPublicExports(root), null, 2) + "\n");
}
