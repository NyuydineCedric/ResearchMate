export function bindReferencesPage(handlers: {
  add(): void
  export(): void
  cancel(): void
  submit(event: SubmitEvent): void
}): void {
  document.querySelector('#add-reference-button')?.addEventListener('click', handlers.add)
  document.querySelector('#export-bibliography')?.addEventListener('click', handlers.export)
  document.querySelector('#cancel-reference')?.addEventListener('click', handlers.cancel)
  document.querySelector<HTMLFormElement>('#reference-form')?.addEventListener('submit', handlers.submit)
}
