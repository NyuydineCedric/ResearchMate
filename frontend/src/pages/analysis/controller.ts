export type AnalysisPageContext = {
  request<T>(url: string, options?: RequestInit): Promise<T>
  readCsvFile(file: File): Promise<string>
  toast(message: string, isError?: boolean): void
  refreshProjectSelect(): void
  loadDatasetsPage(selectedId?: number): Promise<void>
}

export async function readCsvFile(file: File): Promise<string> {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer())
  } catch {
    throw new Error('CSV files must use valid UTF-8 encoding. Re-save the file as UTF-8 and retry.')
  }
}

export function bindAnalysisPage(context: AnalysisPageContext, onSelectDataset: (value: string) => void): void {
  const importPanel = document.querySelector<HTMLElement>('#dataset-import-panel')
  document.querySelector('#open-dataset-import')?.addEventListener('click', () => {
    if (importPanel) importPanel.hidden = !importPanel.hidden
  })
  document.querySelector('#close-dataset-import')?.addEventListener('click', () => {
    if (importPanel) importPanel.hidden = true
  })
  document.querySelector<HTMLSelectElement>('#dataset-select')?.addEventListener('change', (event) => {
    onSelectDataset((event.currentTarget as HTMLSelectElement).value)
  })
  document.querySelector<HTMLFormElement>('#dataset-form')?.addEventListener('submit', (event) => {
    void importDataset(event, context)
  })
}

async function importDataset(event: SubmitEvent, context: AnalysisPageContext): Promise<void> {
  event.preventDefault()
  const form = event.currentTarget as HTMLFormElement
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!
  const file = form.querySelector<HTMLInputElement>('#dataset-file')?.files?.[0]
  const status = document.querySelector<HTMLElement>('#dataset-upload-status')!
  if (!file) {
    status.textContent = 'Choose a CSV or Excel .xlsx file to import.'
    return
  }
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension !== 'csv' && extension !== 'xlsx') {
    status.textContent = 'Only CSV and Excel .xlsx files are supported.'
    return
  }
  if (file.size > 800_000) {
    status.textContent = 'Dataset files must be 800 KB or smaller.'
    return
  }
  submit.disabled = true
  status.textContent = `Reading and analyzing ${extension.toUpperCase()}…`
  try {
    const projectValue = document.querySelector<HTMLSelectElement>('#dataset-project')!.value
    const workbookBase64 = extension === 'xlsx'
      ? await file.arrayBuffer().then((buffer) => {
        const bytes = new Uint8Array(buffer)
        let binary = ''
        for (let offset = 0; offset < bytes.length; offset += 0x8000) {
          binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
        }
        return btoa(binary)
      })
      : undefined
    const csv = extension === 'csv' ? await context.readCsvFile(file) : undefined
    const result = await context.request<{ dataset: { id: number; rowCount: number; columnCount: number } }>('/api/datasets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceName: file.name,
        ...(extension === 'csv' ? { csv } : { workbookBase64 }),
        projectId: projectValue ? Number(projectValue) : null
      })
    })
    status.textContent = `Imported ${result.dataset.rowCount} responses and ${result.dataset.columnCount} variables.`
    context.toast('Dataset imported and analyzed.')
    form.reset()
    context.refreshProjectSelect()
    await context.loadDatasetsPage(result.dataset.id)
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Unable to import this CSV file.'
  } finally {
    submit.disabled = false
  }
}
