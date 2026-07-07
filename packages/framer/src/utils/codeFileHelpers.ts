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

/** How long to wait for Framer to compile a freshly created/updated code file. */
const COMPILE_TIMEOUT_MS = 20_000

const FRAMER_ICONS_IMPORT = /import\s+\{[^}]+\}\s+from\s+['"]\.\/icons(?:\.tsx)?['"];?\s*\n?/g

/** Inlines icon components and strips local imports — Framer code files cannot resolve sibling modules. */
export function withFramerIcons(componentSource: string): string {
  const iconsSource = FRAMER_ICONS_SOURCE.replace(/^export /gm, '')
  const componentWithoutIconImports = componentSource.replace(FRAMER_ICONS_IMPORT, '')
  return `${iconsSource}\n${componentWithoutIconImports}`
}

/**
 * Ensures a code file exists in the project, creating it if necessary and
 * self-healing a stale one (e.g. left over from an older plugin version) by
 * refreshing its content to the current source.
 *
 * @throws if the user lacks permission to create the code file
 */
export async function ensureCodeFileExists(filename: string, source: string): Promise<CodeFile> {
  const codeFiles = await framer.getCodeFiles()
  const existing = codeFiles.find(f => f.name === filename)
  if (existing) {
    // Refresh stale/broken content so a bad earlier version can't get stuck.
    if (existing.content !== source && framer.isAllowedTo('CodeFile.setFileContent')) return existing.setFileContent(source)
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
