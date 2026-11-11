export function bindDashboardPage(handlers: { newProject(): void; openEditor(): void; openAssistant(): void }): void {
  document.querySelector('#new-project-button')?.addEventListener('click', handlers.newProject)
  document.querySelector('#quick-project')?.addEventListener('click', handlers.newProject)
  document.querySelector('#quick-document')?.addEventListener('click', handlers.openEditor)
  document.querySelector('#quick-assistant')?.addEventListener('click', handlers.openAssistant)
}
