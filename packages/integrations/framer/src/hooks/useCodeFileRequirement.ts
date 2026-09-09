import { useEffect, useState } from 'react'
import { framer, type CodeFile } from '@framer/plugin'
import { getCodeFileRequirement, type CodeFileRequirement } from '@/utils/codeFileHelpers'

export type CodeFileRequirementState =
  | { filename: string; status: 'checking' }
  | { filename: string; status: 'ready'; requirement: CodeFileRequirement }
  | { filename: string; status: 'error' }

/**
 * Tracks the exact code-file permission an insert currently requires. The
 * subscription keeps the CTA correct when another collaborator adds or updates
 * the generated file while the plugin is open.
 */
export function useCodeFileRequirement(filename: string): CodeFileRequirementState {
  const [state, setState] = useState<CodeFileRequirementState>({ filename, status: 'checking' })

  useEffect(() => {
    let active = true
    const update = (files: readonly CodeFile[]) => {
      if (!active) return
      setState({ filename, status: 'ready', requirement: getCodeFileRequirement(files, filename) })
    }
    const fail = () => {
      if (!active) return
      setState({ filename, status: 'error' })
    }

    setState({ filename, status: 'checking' })
    let unsubscribe = () => {}
    try {
      unsubscribe = framer.subscribeToCodeFiles(update)
      void framer.getCodeFiles().then(update, fail)
    } catch {
      fail()
    }

    return () => {
      active = false
      unsubscribe()
    }
  }, [filename])

  return state.filename === filename ? state : { filename, status: 'checking' }
}
