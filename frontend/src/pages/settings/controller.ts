export type AppSettings = {
  autoSave: boolean
  compactMode: boolean
}

export type SettingsPageContext = {
  storageKey: string
  defaults: AppSettings
  read<T>(key: string, fallback: T): T
  write<T>(key: string, value: T): void
  toast(message: string): void
}

export function renderSettingsPage(context: SettingsPageContext): void {
  const settings = context.read(context.storageKey, context.defaults)
  const autoSave = document.querySelector<HTMLInputElement>('#setting-auto-save')
  const compact = document.querySelector<HTMLInputElement>('#setting-compact')
  if (autoSave) autoSave.checked = settings.autoSave
  if (compact) compact.checked = settings.compactMode
  document.body.classList.toggle('compact-layout', settings.compactMode)
}

export function saveSettingsPage(context: SettingsPageContext): void {
  const settings: AppSettings = {
    autoSave: document.querySelector<HTMLInputElement>('#setting-auto-save')?.checked ?? true,
    compactMode: document.querySelector<HTMLInputElement>('#setting-compact')?.checked ?? false
  }
  context.write(context.storageKey, settings)
  document.body.classList.toggle('compact-layout', settings.compactMode)
  context.toast('Settings saved.')
}

export function bindSettingsPage(context: SettingsPageContext): void {
  document.querySelector('#save-settings')?.addEventListener('click', () => saveSettingsPage(context))
}
