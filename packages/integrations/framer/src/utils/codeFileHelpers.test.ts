import type { CodeFile } from '@framer/plugin'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import pkg from '../../package.json'

const { framerMock } = vi.hoisted(() => ({
  framerMock: {
    getCodeFiles: vi.fn(),
    isAllowedTo: vi.fn(),
    createCodeFile: vi.fn(),
    addComponentInstance: vi.fn(),
    subscribeToCodeFiles: vi.fn(),
    notify: vi.fn()
  }
}))

vi.mock('@framer/plugin', () => ({ framer: framerMock }))

import { ensureCodeFileExists, ensureComponentInsertURL, getCodeFileRequirement, insertComponentInstance } from '@/utils/codeFileHelpers'

const FILENAME = 'CreemCheckoutButton.tsx'

function codeFile({ content = `// creem-plugin: ${pkg.version}`, insertURL = null }: { content?: string; insertURL?: string | null } = {}): CodeFile {
  return {
    id: 'code-file-1',
    name: FILENAME,
    content,
    exports: insertURL ? [{ type: 'component', name: 'CreemCheckoutButton', insertURL }] : [],
    setFileContent: vi.fn()
  } as unknown as CodeFile
}

beforeEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
  framerMock.isAllowedTo.mockReturnValue(true)
  framerMock.subscribeToCodeFiles.mockReturnValue(vi.fn())
})

describe('getCodeFileRequirement', () => {
  it('requires only the mutation matching the current file state', () => {
    expect(getCodeFileRequirement([], FILENAME, false)).toBe('create')
    expect(getCodeFileRequirement([codeFile()], FILENAME, false)).toBe('none')
    expect(getCodeFileRequirement([codeFile({ content: '// creem-plugin: 0.0.9' })], FILENAME, false)).toBe('update')
  })
})

describe('ensureCodeFileExists', () => {
  it('does not require create permission when the current file already exists', async () => {
    const existing = codeFile({ insertURL: 'https://framer.test/component' })
    framerMock.getCodeFiles.mockResolvedValue([existing])
    framerMock.isAllowedTo.mockReturnValue(false)

    await expect(ensureCodeFileExists(FILENAME, 'source', false)).resolves.toBe(existing)
    expect(framerMock.createCodeFile).not.toHaveBeenCalled()
  })

  it('blocks a stale file when update permission is unavailable', async () => {
    const existing = codeFile({ content: '// creem-plugin: 0.0.9', insertURL: 'https://framer.test/old-component' })
    framerMock.getCodeFiles.mockResolvedValue([existing])
    framerMock.isAllowedTo.mockReturnValue(false)

    await expect(ensureCodeFileExists(FILENAME, 'new source', false)).rejects.toMatchObject({ step: 'update-code-file' })
    expect(existing.setFileContent).not.toHaveBeenCalled()
  })

  it('blocks code-file creation when permission is unavailable', async () => {
    framerMock.getCodeFiles.mockResolvedValue([])
    framerMock.isAllowedTo.mockReturnValue(false)

    await expect(ensureCodeFileExists(FILENAME, 'source', false)).rejects.toMatchObject({
      step: 'create-code-file',
      message: expect.stringContaining("don't have permission")
    })
    expect(framerMock.createCodeFile).not.toHaveBeenCalled()
  })

  it('identifies code-file update failures', async () => {
    const existing = codeFile({ content: '// creem-plugin: 0.0.9' })
    framerMock.getCodeFiles.mockResolvedValue([existing])
    vi.mocked(existing.setFileContent).mockRejectedValue(new Error('Framer rejected the update'))

    await expect(ensureCodeFileExists(FILENAME, 'new source', false)).rejects.toMatchObject({
      step: 'update-code-file',
      message: expect.stringContaining('temporary Framer issue')
    })
  })

  it('identifies permission loss during a code-file update', async () => {
    const existing = codeFile({ content: '// creem-plugin: 0.0.9' })
    framerMock.getCodeFiles.mockResolvedValue([existing])
    framerMock.isAllowedTo.mockReturnValueOnce(true).mockReturnValueOnce(false)
    vi.mocked(existing.setFileContent).mockRejectedValue(new Error('Permission changed'))

    await expect(ensureCodeFileExists(FILENAME, 'new source', false)).rejects.toMatchObject({
      step: 'update-code-file',
      message: expect.stringContaining('no longer have permission')
    })
  })

  it('identifies code-file creation failures', async () => {
    framerMock.getCodeFiles.mockResolvedValue([])
    framerMock.createCodeFile.mockRejectedValue(new Error('Framer rejected the write'))

    await expect(ensureCodeFileExists(FILENAME, 'source', false)).rejects.toMatchObject({
      step: 'create-code-file',
      message: expect.stringContaining('temporary Framer issue')
    })
  })

  it('identifies permission loss during code-file creation', async () => {
    framerMock.getCodeFiles.mockResolvedValue([])
    framerMock.isAllowedTo.mockReturnValueOnce(true).mockReturnValueOnce(false)
    framerMock.createCodeFile.mockRejectedValue(new Error('Permission changed'))

    await expect(ensureCodeFileExists(FILENAME, 'source', false)).rejects.toMatchObject({
      step: 'create-code-file',
      message: expect.stringContaining('no longer have permission')
    })
  })
})

describe('ensureComponentInsertURL', () => {
  it('identifies compilation timeouts and keeps the prepared file reusable', async () => {
    vi.useFakeTimers()
    const created = codeFile()
    framerMock.getCodeFiles.mockResolvedValue([])
    framerMock.createCodeFile.mockResolvedValue(created)

    const result = ensureComponentInsertURL(FILENAME, 'source')
    const assertion = expect(result).rejects.toMatchObject({ step: 'compile-code-file' })
    await vi.advanceTimersByTimeAsync(20_000)
    await assertion
  })
})

describe('insertComponentInstance', () => {
  it('blocks canvas insertion when permission is unavailable', async () => {
    framerMock.isAllowedTo.mockReturnValue(false)

    await expect(insertComponentInstance({ url: 'https://framer.test/component' })).rejects.toMatchObject({
      step: 'insert-component',
      message: expect.stringContaining("don't have permission")
    })
    expect(framerMock.addComponentInstance).not.toHaveBeenCalled()
  })

  it('identifies final canvas insertion failures', async () => {
    framerMock.addComponentInstance.mockRejectedValue(new Error('Canvas write failed'))

    const result = insertComponentInstance({ url: 'https://framer.test/component' })

    await expect(result).rejects.toMatchObject({
      step: 'insert-component',
      message: expect.stringContaining('could not add it to the canvas')
    })
  })

  it('identifies permission loss during final canvas insertion', async () => {
    framerMock.isAllowedTo.mockReturnValueOnce(true).mockReturnValueOnce(false)
    framerMock.addComponentInstance.mockRejectedValue(new Error('Permission changed'))

    const result = insertComponentInstance({ url: 'https://framer.test/component' })

    await expect(result).rejects.toMatchObject({
      step: 'insert-component',
      message: expect.stringContaining('no longer have permission')
    })
  })
})
