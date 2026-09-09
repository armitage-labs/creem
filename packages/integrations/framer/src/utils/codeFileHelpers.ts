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

export type CodeFileRequirement = 'none' | 'create' | 'update'

export type ComponentInsertStep = 'inspect-code-files' | 'create-code-file' | 'update-code-file' | 'compile-code-file' | 'insert-component'

/** An insert failure with enough context to show the user exactly which step failed. */
export class ComponentInsertError extends Error {
  constructor(
    readonly step: ComponentInsertStep,
    message: string,
    cause?: unknown
  ) {
    super(message, { cause })
    this.name = 'ComponentInsertError'
  }
}

type ProtectedInsertMethod = 'CodeFile.setFileContent' | 'createCodeFile' | 'addComponentInstance'

/**
 * Permissions can change after a preflight check (for example when collaboration
 * access is revoked). Re-check after a protected call fails so the UI can tell a
 * permission problem from a temporary Framer failure.
 */
function protectedActionError(method: ProtectedInsertMethod, step: ComponentInsertStep, permissionMessage: string, temporaryMessage: string, cause: unknown): ComponentInsertError {
  return new ComponentInsertError(step, framer.isAllowedTo(method) ? temporaryMessage : permissionMessage, cause)
}

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

/** Determines the exact file mutation needed before a component can be inserted. */
export function getCodeFileRequirement(codeFiles: readonly CodeFile[], filename: string, refreshExisting = import.meta.env.DEV): CodeFileRequirement {
  const existing = codeFiles.find(file => file.name === filename)
  if (!existing) return 'create'
  return refreshExisting || readCodeFileVersion(existing.content) !== PLUGIN_VERSION ? 'update' : 'none'
}

/**
 * Ensures the component's code file exists, creating it if necessary. If it already
 * exists, it is refreshed to the current source ONLY when it came from a different
 * plugin version (a genuine upgrade, or an old unversioned file) — never merely because
 * it differs from the bundled source. That keeps the auto-upgrade path while preserving
 * hand-edits made in Framer's code editor for the same plugin version (see T-OVERWRITE).
 *
 * @throws a step-specific {@link ComponentInsertError} if inspection, creation,
 * or updating fails.
 */
export async function ensureCodeFileExists(filename: string, source: string, refreshExisting = import.meta.env.DEV): Promise<CodeFile> {
  let codeFiles: readonly CodeFile[]
  try {
    codeFiles = await framer.getCodeFiles()
  } catch (error) {
    throw new ComponentInsertError('inspect-code-files', `Framer could not inspect project code files before inserting ${filename}. Try again.`, error)
  }

  const existing = codeFiles.find(f => f.name === filename)
  if (existing) {
    const requirement = getCodeFileRequirement(codeFiles, filename, refreshExisting)
    if (requirement === 'none') return existing

    if (!framer.isAllowedTo('CodeFile.setFileContent')) {
      throw new ComponentInsertError('update-code-file', `You don't have permission to update ${filename}. Ask the project owner for code editing access, then try again.`)
    }

    try {
      const updated = await existing.setFileContent(source)
      if (readCodeFileVersion(existing.content) !== PLUGIN_VERSION) {
        framer.notify(`Refreshed ${filename} to Creem plugin v${PLUGIN_VERSION}. Manual edits to this file are overwritten on plugin updates.`, { variant: 'warning' })
      }
      return updated
    } catch (error) {
      throw protectedActionError(
        'CodeFile.setFileContent',
        'update-code-file',
        `You no longer have permission to update ${filename}. Ask the project owner for code editing access, then try again.`,
        `Framer could not update ${filename}. No component was inserted. This may be a temporary Framer issue; try again.`,
        error
      )
    }
  }

  if (!framer.isAllowedTo('createCodeFile')) {
    throw new ComponentInsertError('create-code-file', `You don't have permission to create ${filename}. Ask the project owner for code editing access, then try again.`)
  }

  try {
    return await framer.createCodeFile(filename, source)
  } catch (error) {
    throw protectedActionError(
      'createCodeFile',
      'create-code-file',
      `You no longer have permission to create ${filename}. Ask the project owner for code editing access, then try again.`,
      `Framer could not create ${filename}. No component was inserted. This may be a temporary Framer issue; try again.`,
      error
    )
  }
}

function componentInsertURL(file: CodeFile): string | null {
  return file.exports.find(e => e.type === 'component')?.insertURL ?? null
}

/**
 * Ensures the component's code file exists and resolves its `insertURL`,
 * waiting (via `subscribeToCodeFiles`) for Framer to finish compiling the file
 * so the component export becomes available.
 *
 * @throws a step-specific {@link ComponentInsertError} when compilation does
 * not finish within the timeout.
 */
export async function ensureComponentInsertURL(filename: string, source: string): Promise<string> {
  const file = await ensureCodeFileExists(filename, source)
  // Already compiled (e.g. the file existed and was unchanged).
  const immediate = componentInsertURL(file)
  if (immediate) return immediate
  return new Promise<string>((resolve, reject) => {
    let settled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let unsubscribe = () => {}
    const cleanup = () => {
      if (timer !== undefined) clearTimeout(timer)
      unsubscribe()
    }
    const settle = (url: string) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(url)
    }
    const fail = (error: ComponentInsertError) => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    }

    try {
      // Fires whenever code files change — including once this file compiles.
      const subscription = framer.subscribeToCodeFiles(files => {
        const updated = files.find(f => f.id === file.id)
        if (!updated) return
        const url = componentInsertURL(updated)
        if (url) settle(url)
      })
      if (settled) {
        subscription()
      } else {
        unsubscribe = subscription
        timer = setTimeout(
          () => fail(new ComponentInsertError('compile-code-file', `${filename} was prepared, but Framer did not finish compiling it. Wait a moment and try inserting again.`)),
          COMPILE_TIMEOUT_MS
        )
      }
    } catch (error) {
      fail(new ComponentInsertError('compile-code-file', `Framer could not monitor ${filename} while it compiled. Wait a moment and try inserting again.`, error))
    }
  })
}

/** Performs the final protected canvas mutation with a step-specific failure. */
export async function insertComponentInstance(options: Parameters<typeof framer.addComponentInstance>[0]) {
  if (!framer.isAllowedTo('addComponentInstance')) {
    throw new ComponentInsertError(
      'insert-component',
      "The component code is ready, but you don't have permission to add it to the canvas. Ask the project owner for canvas editing access."
    )
  }

  try {
    return await framer.addComponentInstance(options)
  } catch (error) {
    throw protectedActionError(
      'addComponentInstance',
      'insert-component',
      'The component code is ready, but you no longer have permission to add it to the canvas. Ask the project owner for canvas editing access.',
      'The component code is ready, but Framer could not add it to the canvas. Try inserting again; the prepared code file will be reused.',
      error
    )
  }
}

/** Converts unknown failures into a safe, actionable notification message. */
export function componentInsertErrorMessage(error: unknown): string {
  if (error instanceof ComponentInsertError) return error.message
  return 'An unexpected insert error occurred before the component could be added. Try again.'
}
