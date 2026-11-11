export type QuestionnairePageHandlers = {
  start(): void
  select(value: string): void
  addQuestion(): void
  generate(): void
  save(): void
  delete(): void
  export(): void
  preview(): void
  exportResponses(): void
  analyzeResponses(): void
  submitResponse(form: HTMLFormElement): void
}

export function bindQuestionnairePage(handlers: QuestionnairePageHandlers): void {
  document.querySelector('#new-questionnaire')?.addEventListener('click', handlers.start)
  document.querySelector<HTMLSelectElement>('#questionnaire-select')?.addEventListener('change', (event) => {
    handlers.select((event.currentTarget as HTMLSelectElement).value)
  })
  document.querySelector('#add-question-button')?.addEventListener('click', handlers.addQuestion)
  document.querySelector('#generate-questionnaire')?.addEventListener('click', handlers.generate)
  document.querySelector('#save-questionnaire')?.addEventListener('click', handlers.save)
  document.querySelector('#delete-questionnaire')?.addEventListener('click', handlers.delete)
  document.querySelector('#export-questionnaire')?.addEventListener('click', handlers.export)
  document.querySelector('#preview-questionnaire')?.addEventListener('click', handlers.preview)
  document.querySelector('#export-questionnaire-responses')?.addEventListener('click', handlers.exportResponses)
  document.querySelector('#analyze-questionnaire-responses')?.addEventListener('click', handlers.analyzeResponses)
  document.querySelector('#questionnaire-preview')?.addEventListener('submit', (event) => {
    const form = event.target
    if (!(form instanceof HTMLFormElement) || form.id !== 'questionnaire-response-form') return
    event.preventDefault()
    handlers.submitResponse(form)
  })
}
