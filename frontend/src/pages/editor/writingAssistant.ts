type WritingAction = 'draft' | 'continue' | 'improve' | 'proofread' | 'academic-tone' | 'outline' | 'brainstorm' | 'summarize'

export type WritingAssistantContext = {
  request<T>(url: string, options?: RequestInit): Promise<T>
  captureCursor(): string
  getDocumentText(): string
  insertText(text: string, replaceSelection: boolean): void
  createSummaryDocument(text: string): Promise<void>
  releaseCursor(): void
}

const sourceRequiredActions = new Set<WritingAction>([
  'continue', 'improve', 'proofread', 'academic-tone', 'summarize'
])
const promptRequiredActions = new Set<WritingAction>(['draft', 'outline', 'brainstorm'])

export function bindWritingAssistant(context: WritingAssistantContext): void {
  const dialog = document.querySelector<HTMLDialogElement>('#writing-assistant-dialog')!
  const actionSelect = document.querySelector<HTMLSelectElement>('#writing-assistant-action')!
  const promptInput = document.querySelector<HTMLTextAreaElement>('#writing-assistant-prompt')!
  const resultInput = document.querySelector<HTMLTextAreaElement>('#writing-assistant-result')!
  const status = document.querySelector<HTMLElement>('#writing-assistant-status')!
  const generateButton = document.querySelector<HTMLButtonElement>('#generate-writing-assistance')!
  const replaceButton = document.querySelector<HTMLButtonElement>('#replace-writing-selection')!
  const insertButton = document.querySelector<HTMLButtonElement>('#insert-writing-result')!
  const copyButton = document.querySelector<HTMLButtonElement>('#copy-writing-result')!
  const contextMessage = document.querySelector<HTMLElement>('#writing-assistant-context')!
  let selectedText = ''
  let generatedText = ''
  let capturedSelection = ''
  let cursorCaptured = false

  const updateActions = (): void => {
    const summarize = actionSelect.value === 'summarize'
    replaceButton.hidden = summarize
    replaceButton.disabled = summarize || !selectedText || !generatedText
    insertButton.textContent = summarize ? 'Create new summary document' : 'Insert at cursor'
    insertButton.disabled = !generatedText
    copyButton.disabled = !generatedText
  }

  const openButton = document.querySelector('#open-writing-assistant')
  openButton?.addEventListener('mousedown', () => {
    capturedSelection = context.captureCursor()
    cursorCaptured = true
  })
  openButton?.addEventListener('click', () => {
    if (!cursorCaptured) capturedSelection = context.captureCursor()
    cursorCaptured = false
    selectedText = capturedSelection
    capturedSelection = ''
    generatedText = ''
    resultInput.value = ''
    status.textContent = ''
    status.classList.remove('error-message')
    contextMessage.textContent = selectedText
      ? `Using your selected passage (${selectedText.length.toLocaleString()} characters).`
      : 'Uses the current document as context when it is within the context limit.'
    updateActions()
    dialog.showModal()
    promptInput.focus()
  })
  dialog.addEventListener('close', context.releaseCursor)
  actionSelect.addEventListener('change', updateActions)

  generateButton.addEventListener('click', async () => {
    const action = actionSelect.value as WritingAction
    const prompt = promptInput.value.trim()
    if (promptRequiredActions.has(action) && !prompt) {
      status.textContent = 'Add a prompt for this writing task.'
      status.classList.add('error-message')
      promptInput.focus()
      return
    }

    let sourceText = selectedText
    if (!sourceText) {
      try {
        sourceText = context.getDocumentText()
      } catch (error) {
        if (sourceRequiredActions.has(action)) {
          status.textContent = error instanceof Error ? error.message : 'Select a shorter passage and retry.'
          status.classList.add('error-message')
          return
        }
      }
    }
    if (sourceRequiredActions.has(action) && !sourceText.trim()) {
      status.textContent = 'Add document text or select a passage first.'
      status.classList.add('error-message')
      return
    }

    generatedText = ''
    resultInput.value = ''
    updateActions()
    status.classList.remove('error-message')
    status.textContent = 'Generating suggestion…'
    generateButton.disabled = true
    try {
      const response = await context.request<{ action: WritingAction; text: string }>('/api/writing-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, prompt, sourceText })
      })
      generatedText = response.text
      resultInput.value = generatedText
      status.textContent = 'Suggestion ready. Review it before applying.'
      updateActions()
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Could not generate a writing suggestion.'
      status.classList.add('error-message')
    } finally {
      generateButton.disabled = false
    }
  })

  replaceButton.addEventListener('click', () => {
    if (!generatedText || !selectedText) return
    context.insertText(generatedText, true)
    dialog.close()
  })
  insertButton.addEventListener('click', async () => {
    if (!generatedText) return
    if (actionSelect.value === 'summarize') {
      insertButton.disabled = true
      status.classList.remove('error-message')
      status.textContent = 'Saving summary as a new document…'
      try {
        await context.createSummaryDocument(generatedText)
        dialog.close()
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : 'Could not create the summary document.'
        status.classList.add('error-message')
        insertButton.disabled = false
      }
      return
    }
    context.insertText(generatedText, false)
    dialog.close()
  })
  copyButton.addEventListener('click', async () => {
    if (!generatedText) return
    try {
      await navigator.clipboard.writeText(generatedText)
      status.textContent = 'Suggestion copied.'
    } catch {
      status.textContent = 'Clipboard access is unavailable in this browser.'
      status.classList.add('error-message')
    }
  })
}
