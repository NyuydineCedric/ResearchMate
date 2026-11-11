import { bindWritingAssistant, type WritingAssistantContext } from './writingAssistant'

export function bindEditorPage(onMount: () => void, writingAssistantContext: WritingAssistantContext): void {
  document.querySelector('#new-document')?.addEventListener('click', onMount)
  bindWritingAssistant(writingAssistantContext)
}
