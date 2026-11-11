export type AssistantPageHandlers = {
  submit(): void
  clear(): void
  newConversation(): void
  selectConversation(value: string): void
}

export function bindAssistantPage(handlers: AssistantPageHandlers): void {
  document.querySelector('#assistant-submit')?.addEventListener('click', handlers.submit)
  document.querySelector('#assistant-clear')?.addEventListener('click', handlers.clear)
  document.querySelector('#assistant-new-conversation')?.addEventListener('click', handlers.newConversation)
  document.querySelector<HTMLSelectElement>('#assistant-conversations')?.addEventListener('change', (event) => {
    handlers.selectConversation((event.currentTarget as HTMLSelectElement).value)
  })
}
