/**
 * Framer Code File Utilities
 *
 * Inserting a code component is a two-step dance that the obvious code gets
 * wrong: `createCodeFile` returns immediately, but Framer compiles the file in
 * the background, so its `exports` (and the component's `insertURL`) are NOT
 * available on the returned object. Reading them right away yields "component
 * export not found". `getCodeFile` returns a stale snapshot and never sees the
 * compiled result either — the only reliable signal is `subscribeToCodeFiles`,
 * which fires once compilation finishes.
 */

import { framer, type CodeFile } from '@framer/plugin'
import FRAMER_ICONS_SOURCE from '@/framer/icons.tsx?raw'
import pkg from '../../package.json'

/** Stamped into every generated code file; drives the "same version → don't overwrite" guard. */
const PLUGIN_VERSION = pkg.version
const VERSION_RE = /^\/\/ creem-plugin: (.+)$/m

/** How long to wait for Framer to compile a freshly created/updated code file. */
const COMPILE_TIMEOUT_MS = 20_000

const FRAMER_ICONS_IMPORT = /import\s+\{[^}]+\}\s+from\s+['"]\.\/icons(?:\.tsx)?['"];?\s*\n?/g

/** Inlines icon components and strips local imports — Framer code files cannot resolve sibling modules. */
export function withFramerIcons(componentSource: string): string {
  const iconsSource = FRAMER_ICONS_SOURCE.replace(/^export /gm, '')
  const componentWithoutIconImports = componentSource.replace(FRAMER_ICONS_IMPORT, '')
  // Stamp the plugin version at the top so a re-insert only refreshes the shared code
  // file on a real version bump — not when the user has hand-edited it (see T-OVERWRITE).
  return `// creem-plugin: ${PLUGIN_VERSION}\n${iconsSource}\n${componentWithoutIconImports}`
}

/** Reads the `// creem-plugin: <version>` stamp from a generated file, or null if unstamped. */
function readCodeFileVersion(content: string): string | null {
  const match = content.match(VERSION_RE)
  return match ? match[1].trim() : null
}

/**
 * Ensures the component's code file exists, creating it if necessary. If it already
 * exists, it is refreshed to the current source ONLY when it came from a different
 * plugin version (a genuine upgrade, or an old unversioned file) — never merely because
 * it differs from the bundled source. That keeps the auto-upgrade path while preserving
 * hand-edits made in Framer's code editor for the same plugin version (see T-OVERWRITE).
 *
 * @throws if the user lacks permission to create the code file
 */
export async function ensureCodeFileExists(filename: string, source: string): Promise<CodeFile> {
  const codeFiles = await framer.getCodeFiles()
  const existing = codeFiles.find(f => f.name === filename)
  if (existing) {
    // In dev we always refresh so edits to the component source show up on the next
    // insert without a version bump. In production we only refresh on a genuine
    // version change, to preserve users' hand-edits between updates (see T-OVERWRITE).
    const versionChanged = readCodeFileVersion(existing.content) !== PLUGIN_VERSION
    if ((import.meta.env.DEV || versionChanged) && framer.isAllowedTo('CodeFile.setFileContent')) {
      const updated = await existing.setFileContent(source)
      if (versionChanged) {
        framer.notify(`Refreshed ${filename} to Creem plugin v${PLUGIN_VERSION}. Manual edits to this file are overwritten on plugin updates.`, { variant: 'warning' })
      }
      return updated
    }
    return existing
  }
  if (!framer.isAllowedTo('createCodeFile')) throw new Error("You don't have permission to create code files in this project")
  return framer.createCodeFile(filename, source)
}

function componentInsertURL(file: CodeFile): string | null {
  return file.exports.find(e => e.type === 'component')?.insertURL ?? null
}

/**
 * Ensures the component's code file exists and resolves its `insertURL`,
 * waiting (via `subscribeToCodeFiles`) for Framer to finish compiling the file
 * so the component export becomes available. Resolves `null` if it doesn't
 * compile within the timeout.
 */
export async function ensureComponentInsertURL(filename: string, source: string): Promise<string | null> {
  const file = await ensureCodeFileExists(filename, source)
  // Already compiled (e.g. the file existed and was unchanged).
  const immediate = componentInsertURL(file)
  if (immediate) return immediate
  return new Promise<string | null>(resolve => {
    let settled = false
    const settle = (url: string | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      unsubscribe()
      resolve(url)
    }
    // Fires whenever code files change — including once this file compiles.
    const unsubscribe = framer.subscribeToCodeFiles(files => {
      const updated = files.find(f => f.id === file.id)
      if (!updated) return
      const url = componentInsertURL(updated)
      if (url) settle(url)
    })
    const timer = setTimeout(() => settle(null), COMPILE_TIMEOUT_MS)
  })
}
