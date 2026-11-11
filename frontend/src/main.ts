import './style.css'
import { dashboardPage } from './pages/dashboard'
import { projectsPage } from './pages/projects'
import { assistantPage } from './pages/assistant'
import { analysisPage } from './pages/analysis'
import { referencesPage } from './pages/references'
import { questionnairePage } from './pages/questionnaire'
import { settingsPage } from './pages/settings'
import { bindDashboardPage } from './pages/dashboard/controller'
import { bindProjectsPage } from './pages/projects/controller'
import { bindAssistantPage } from './pages/assistant/controller'
import { bindAnalysisPage, readCsvFile } from './pages/analysis/controller'
import { bindReferencesPage } from './pages/references/controller'
import { bindQuestionnairePage } from './pages/questionnaire/controller'
import { bindSettingsPage, renderSettingsPage, type AppSettings, type SettingsPageContext } from './pages/settings/controller'
import { bindEditorPage } from './pages/editor/controller'

type ProjectStatus = 'planning' | 'active' | 'paused' | 'completed'

type Project = {
  id: number
  title: string
  researchArea: string
  description: string
  status: ProjectStatus
  progress: number
  dueDate: string | null
  createdAt: string
  updatedAt: string
}

type ResearchDocument = {
  id: number
  title: string
  content: string
  projectId: number | null
  projectTitle: string | null
  createdAt: string
  updatedAt: string
}

type Dashboard = {
  generatedAt: string
  summary: {
    activeProjects: number
    documents: number
    upcomingDeadlines: number
  }
  projects: Project[]
  deadlines: Project[]
  documents: ResearchDocument[]
}

type ProjectList = { projects: Project[] }
type DocumentList = { documents: ResearchDocument[] }

type ReferenceRecord = {
  id: number
  title: string
  authors: string
  type: string
  year: string
  abstract: string
  url: string
}

const referenceTypeLabels: Record<string, string> = {
  article: 'Journal article',
  book: 'Book',
  chapter: 'Book chapter',
  thesis: 'Thesis',
  website: 'Website',
  other: 'Source'
}

type QuestionnaireItem = {
  id: number
  prompt: string
  type: 'text' | 'multiple-choice' | 'scale'
  options: string[]
  required: boolean
}

type Questionnaire = {
  id: number
  title: string
  projectId: number | null
  projectTitle: string | null
  responseCount: number
  items: QuestionnaireItem[]
  createdAt: string
  updatedAt: string
}

type QuestionnaireAnswer = {
  questionId: number
  prompt: string
  type: QuestionnaireItem['type']
  answer: string
}

type QuestionnaireResponse = {
  id: number
  submittedAt: string
  answers: QuestionnaireAnswer[]
}

type LocalDraft = {
  title: string
  content: string
  projectId: string
  documentId: string
  savedAt: string
}

type DatasetSummary = {
  id: number
  sourceName: string
  projectId: number | null
  projectTitle: string | null
  questionnaireId: number | null
  createdAt: string
  rowCount: number
  columnCount: number
}

type ColumnStatistic = {
  name: string
  kind: 'numeric' | 'categorical'
  nonMissing: number
  missing: number
  count?: number
  mean?: number
  median?: number
  standardDeviation?: number | null
  variance?: number | null
  min?: number
  max?: number
  quartiles?: { q1: number; q2: number; q3: number }
  histogram?: Array<{ start: number; end: number; count: number }>
  unique?: number
  frequencies?: Array<{ value: string; count: number; percentage: number }>
}

type DatasetDetail = DatasetSummary & {
  columns: string[]
  columnStats: ColumnStatistic[]
  sampleRows: Array<Record<string, string | null>>
  duplicateRows: number
  qualityWarnings: string[]
}

type AssistantConversation = {
  id: number
  title: string
  projectId: number | null
  projectTitle: string | null
  createdAt: string
  updatedAt: string
}

type AssistantMessage = {
  id: number
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

const STORAGE_KEYS = {
  settings: 'researchmate.settings',
  localDraft: 'researchmate.local-draft'
}

const readStoredValue = <T>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown local storage error.'
    const status = document.querySelector<HTMLElement>('#document-save-status')
    if (status) status.textContent = `Could not read saved workspace data: ${message}`
    return fallback
  }
}

const writeStoredValue = <T>(key: string, value: T): void => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown local storage error.'
    const status = document.querySelector<HTMLElement>('#document-save-status')
    if (status) status.textContent = `Could not save local workspace data: ${message}`
    if (typeof toast !== 'undefined') showToast(`Could not save local workspace data: ${message}`, true)
  }
}

const defaultSettings: AppSettings = {
  autoSave: true,
  compactMode: false
}

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('App root not found')
}

const icon = (name: string, size = 20): string => {
  const paths: Record<string, string> = {
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
    projects: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/><path d="M3 10h18"/>',
    assistant: '<path d="M12 3 9.5 9.5 3 12l6.5 2.5L12 21l2.5-6.5L21 12l-6.5-2.5z"/><path d="m19 3 .8 2.2L22 6l-2.2.8L19 9l-.8-2.2L16 6l2.2-.8z"/>',
    analysis: '<path d="M4 19V5"/><path d="M4 19h17"/><path d="m7 15 4-4 3 2 5-6"/><path d="M16 7h3v3"/>',
    references: '<path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H20v17H7.5A2.5 2.5 0 0 0 5 21.5z"/><path d="M5 4.5v17"/><path d="M9 7h7M9 11h7"/>',
    editor: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/>',
    questionnaire: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    settings: '<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="m19.4 15 .1.1a1.7 1.7 0 0 1-2.4 2.4l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a1.7 1.7 0 0 1-3.4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 0 1-2.4-2.4l.1-.1a1.7 1.7 0 0 0-1.2-2.9H4a1.7 1.7 0 0 1 0-3.4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.7 1.7 0 0 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2V2a1.7 1.7 0 0 1 3.4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.7 1.7 0 0 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a1.7 1.7 0 0 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2 2.9Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    close: '<path d="m18 6-12 12M6 6l12 12"/>'
  }
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[name] ?? ''}</svg>`
}

const navItems = [
  { label: 'Dashboard', section: 'dashboard', icon: 'dashboard', ready: true },
  { label: 'My Projects', section: 'projects', icon: 'projects', ready: true },
  { label: 'AI Research Assistant', section: 'assistant', icon: 'assistant', ready: true },
  { label: 'Data Analysis', section: 'analysis', icon: 'analysis', ready: true },
  { label: 'Literature & References', section: 'references', icon: 'references', ready: true },
  { label: 'Document Editor', section: 'editor', icon: 'editor', ready: true },
  { label: 'Questionnaire Builder', section: 'questionnaire', icon: 'questionnaire', ready: true },
  { label: 'Settings', section: 'settings', icon: 'settings', ready: true }
]

app.innerHTML = `
  <div class="app-shell">
    <aside class="sidebar">
      <a class="brand" href="#dashboard" aria-label="ResearchMate AI dashboard">
        <span class="brand-icon">${icon('references', 22)}</span>
        <span class="brand-copy"><strong>ResearchMate</strong><small>AI RESEARCH WORKSPACE</small></span>
      </a>
      <div class="workspace-label">WORKSPACE</div>
      <nav class="nav-list" aria-label="Main navigation">
        ${navItems.map((item) => `
          <a class="nav-link${item.ready ? '' : ' nav-unavailable'}${item.section === 'dashboard' ? ' active' : ''}"
            href="${item.ready ? `#${item.section}` : '#'}"
            data-section="${item.section}"
            ${item.ready ? '' : 'aria-label="' + item.label + ', coming soon"'}
            ${item.ready ? '' : 'title="This workspace is not implemented yet"'}>
            ${icon(item.icon)}
            <span>${item.label}</span>
            ${item.ready ? '' : '<span class="nav-soon">Soon</span>'}
          </a>
        `).join('')}
      </nav>
      <div class="sidebar-bottom">
        <div class="study-card">
          <span class="study-card-icon">${icon('assistant', 18)}</span>
          <strong>Your research, in one place</strong>
          <p>Plan projects and keep your academic work organized.</p>
        </div>
        <div class="profile">
          <span class="avatar">S</span>
          <span><strong>Student workspace</strong><small>Saved on this device</small></span>
        </div>
      </div>
    </aside>

    <main class="main-content">
      <header class="topbar">
        <div class="breadcrumb"><span>Workspace</span>${icon('arrow', 14)}<strong id="breadcrumb-current">Dashboard</strong></div>
        <div class="topbar-right"><span class="local-badge"><span class="online-dot"></span>Local workspace</span></div>
      </header>

      ${dashboardPage(icon)}

      ${projectsPage(icon)}

      ${assistantPage()}

      ${analysisPage()}

      ${referencesPage(icon)}

      <section class="page-content secondary-page" id="editor-page" hidden aria-busy="false"></section>

      ${questionnairePage(icon)}

      ${settingsPage()}
    </main>
  </div>
  <dialog id="project-dialog" class="modal">
    <form id="project-form" class="modal-form">
      <div class="modal-heading"><div><span class="section-kicker">NEW RESEARCH</span><h2>Start a project</h2></div><button type="button" id="close-project-dialog" class="icon-button" aria-label="Close">${icon('close')}</button></div>
      <label for="project-title">Project title</label><input id="project-title" name="title" required maxlength="200" placeholder="e.g. Social media use and student wellbeing">
      <label for="project-area">Research area <span class="optional-label">Optional</span></label><input id="project-area" name="researchArea" maxlength="120" placeholder="e.g. Psychology, Public Health">
      <label for="project-description">Research question or notes <span class="optional-label">Optional</span></label><textarea id="project-description" name="description" maxlength="5000" rows="3" placeholder="What are you investigating?"></textarea>
      <label for="project-due-date">Target deadline <span class="optional-label">Optional</span></label><input id="project-due-date" name="dueDate" type="date">
      <p id="project-form-error" class="form-error" role="alert"></p>
      <div class="form-actions"><button type="button" id="cancel-project" class="button button-secondary">Cancel</button><button class="button button-primary" type="submit">Create project</button></div>
    </form>
  </dialog>
  <div id="toast" class="toast" role="status" aria-live="polite"></div>
`

const $ = <T extends HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector)
  if (!element) throw new Error(`Required interface element not found: ${selector}`)
  return element
}

const toast = $('#toast')
let toastTimeout: number | undefined
let projects: Project[] = []
let savedReferences: ReferenceRecord[] = []
let questionnaires: Questionnaire[] = []
let questionnaireItems: QuestionnaireItem[] = []
let questionnaireResponses: QuestionnaireResponse[] = []
let activeQuestionnaireId: number | null = null
let assistantConversations: AssistantConversation[] = []
let activeAssistantConversationId: number | null = null
let assistantMessages: AssistantMessage[] = []
let projectsLoadPromise: Promise<void> = Promise.resolve()
let documentPaginationPending = true
let documentPaginationFrame: number | undefined
let documentPaginationVersion = 0
let documentMetricsTimer: number | undefined
let editorPageInitialized = false
let editorPagePromise: Promise<void> | undefined
let documentEditable: HTMLElement
let localDraftTimer: number | undefined
let pendingLocalDraft: LocalDraft | null = null
const progressSaveTimers = new Map<number, number>()

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options)
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(body?.error ?? `Request failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

function showToast(message: string, isError = false): void {
  window.clearTimeout(toastTimeout)
  toast.textContent = message
  toast.classList.toggle('toast-error', isError)
  toast.classList.add('visible')
  toastTimeout = window.setTimeout(() => toast.classList.remove('visible'), 4000)
}

function formatDate(value: string | null): string {
  if (!value) return 'No deadline set'
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? 'Date not set' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function relativeDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently updated'
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  if (days <= 0) return 'Updated today'
  if (days === 1) return 'Updated yesterday'
  if (days < 7) return `Updated ${days} days ago`
  return `Updated ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
    return entities[character] ?? character
  })
}

function renderSummary(data: Dashboard): void {
  const cards = [
    { label: 'Active research projects', value: data.summary.activeProjects, icon: 'projects', style: 'lavender' },
    { label: 'Upcoming deadlines', value: data.summary.upcomingDeadlines, icon: 'calendar', style: 'peach' },
    { label: 'Saved documents', value: data.summary.documents, icon: 'file', style: 'mint' }
  ]
  $('#summary-cards').innerHTML = cards.map((card) => `
    <article class="summary-card">
      <span class="summary-icon ${card.style}">${icon(card.icon)}</span>
      <span class="summary-copy"><span>${card.label}</span><strong>${card.value}</strong></span>
      <span class="summary-note">in your workspace</span>
    </article>
  `).join('')
}

function projectMarkup(project: Project): string {
  const statusLabels: Record<ProjectStatus, string> = {
    planning: 'Planning',
    active: 'In progress',
    paused: 'Paused',
    completed: 'Completed'
  }
  const safeProgress = Math.max(0, Math.min(100, project.progress))
  return `
    <article class="project-item">
      <span class="project-mark">${icon('projects', 19)}</span>
      <div class="project-main">
        <div class="project-title-row"><h3>${escapeHtml(project.title)}</h3><span class="status-chip status-${project.status}">${statusLabels[project.status]}</span></div>
        <p class="project-area">${escapeHtml(project.researchArea || 'Research area not specified')}</p>
        <div class="progress-row"><label for="project-progress-${project.id}">Project progress</label><strong class="progress-value">${safeProgress}%</strong></div>
        <div class="progress-track" role="progressbar" aria-label="${escapeHtml(project.title)} progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${safeProgress}"><span class="progress-fill" style="width:${safeProgress}%"></span></div>
        <input class="progress-input" id="project-progress-${project.id}" data-project-id="${project.id}" type="range" min="0" max="100" step="5" value="${safeProgress}" aria-label="Update progress for ${escapeHtml(project.title)}">
      </div>
      <span class="project-deadline">${icon('calendar', 15)} ${formatDate(project.dueDate)}</span>
    </article>
  `
}

async function saveProjectProgress(input: HTMLInputElement, projectId: number, progress: number): Promise<void> {
  progressSaveTimers.delete(projectId)
  input.disabled = true
  try {
    const result = await request<{ project: Project }>(`/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progress })
    })
    projects = projects.map((project) => project.id === result.project.id ? result.project : project)
    document.querySelectorAll<HTMLInputElement>(`.progress-input[data-project-id="${projectId}"]`).forEach((progressInput) => {
      progressInput.value = String(result.project.progress)
      const main = progressInput.closest('.project-main')
      if (!main) return
      main.querySelector<HTMLElement>('.progress-value')!.textContent = `${result.project.progress}%`
      main.querySelector<HTMLElement>('.progress-fill')!.style.width = `${result.project.progress}%`
      main.querySelector<HTMLElement>('.progress-track')!.setAttribute('aria-valuenow', String(result.project.progress))
    })
    showToast('Project progress saved.')
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Unable to update project progress.', true)
    if (!$('#projects-page').hidden) await loadProjectsPage()
    else await loadDashboard()
  } finally {
    input.disabled = false
  }
}

function renderProjects(target: HTMLElement, items: Project[], emptyMessage: string): void {
  target.innerHTML = items.length
    ? items.map(projectMarkup).join('')
    : `<div class="empty-state"><span class="empty-icon">${icon('projects', 24)}</span><strong>No research projects yet</strong><p>${emptyMessage}</p><button type="button" class="button button-primary empty-new-project">${icon('plus', 17)} Start a project</button></div>`
  target.querySelectorAll<HTMLButtonElement>('.empty-new-project').forEach((button) => button.addEventListener('click', openProjectDialog))
  target.querySelectorAll<HTMLInputElement>('.progress-input').forEach((input) => {
    input.addEventListener('input', () => {
      const main = input.closest('.project-main')
      if (!main) return
      const progress = Number(input.value)
      main.querySelector<HTMLElement>('.progress-value')!.textContent = `${progress}%`
      main.querySelector<HTMLElement>('.progress-fill')!.style.width = `${progress}%`
      main.querySelector<HTMLElement>('.progress-track')!.setAttribute('aria-valuenow', String(progress))
    })
    input.addEventListener('change', () => {
      const projectId = Number(input.dataset.projectId)
      if (!Number.isInteger(projectId) || projectId < 1) return
      const existingTimer = progressSaveTimers.get(projectId)
      if (existingTimer !== undefined) window.clearTimeout(existingTimer)
      const timer = window.setTimeout(() => {
        void saveProjectProgress(input, projectId, Number(input.value))
      }, 300)
      progressSaveTimers.set(projectId, timer)
    })
  })
}

function renderDeadlines(items: Project[]): void {
  const target = $('#deadline-list')
  if (!items.length) {
    target.innerHTML = '<div class="empty-state compact-empty"><strong>No upcoming deadlines</strong><p>Add a target date to a research project to see it here.</p></div>'
    return
  }
  target.innerHTML = items.map((project) => `
    <article class="deadline-item">
      <span class="deadline-date">${icon('calendar', 17)}</span>
      <span class="deadline-copy"><strong>${escapeHtml(project.title)}</strong><small>${escapeHtml(project.researchArea || 'Research project')}</small></span>
      <time datetime="${escapeHtml(project.dueDate ?? '')}">${formatDate(project.dueDate)}</time>
    </article>
  `).join('')
}

function documentMarkup(document: ResearchDocument): string {
  return `
    <article class="document-item">
      <span class="document-icon">${icon('file', 19)}</span>
      <span class="document-copy"><strong>${escapeHtml(document.title)}</strong><small>${escapeHtml(document.projectTitle || 'Personal research notes')}</small></span>
      <time>${relativeDate(document.updatedAt)}</time>
      <button class="button button-secondary document-edit-button" type="button" data-edit-document="${document.id}">Edit</button>
    </article>
  `
}

function renderDocuments(target: HTMLElement, items: ResearchDocument[]): void {
  target.innerHTML = items.length
    ? items.map(documentMarkup).join('')
    : '<div class="empty-state compact-empty"><strong>No saved documents yet</strong><p>Create a research note or academic draft to keep it here.</p></div>'
  target.querySelectorAll<HTMLButtonElement>('[data-edit-document]').forEach((button) => {
    button.addEventListener('click', () => {
      const selected = items.find((item) => item.id === Number(button.dataset.editDocument))
      if (!selected) return
      if ($('#editor-page').hidden) {
        void navigate('editor').then(() => projectsLoadPromise).then(() => fillDocumentEditor(selected))
      } else {
        fillDocumentEditor(selected)
      }
    })
  })
}

function renderDashboard(data: Dashboard): void {
  projects = data.projects
  renderSummary(data)
  renderProjects($('#project-list'), data.projects, 'Create your first project to start planning your research.')
  renderDeadlines(data.deadlines)
  renderDocuments($('#document-list'), data.documents)
  $('#today-date').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

async function loadDashboard(): Promise<void> {
  try {
    const data = await request<Dashboard>('/api/dashboard')
    renderDashboard(data)
    $('#status-message').textContent = ''
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load your workspace.'
    $('#status-message').textContent = `Could not load workspace data: ${message}. Check that the backend is running and retry.`
    $('#status-message').classList.add('error')
    $('#project-list').innerHTML = '<div class="empty-state"><strong>Workspace data is unavailable</strong><p>Start the backend and refresh to load your research projects.</p><button type="button" class="button button-secondary" id="retry-dashboard">Retry</button></div>'
    $('#deadline-list').innerHTML = ''
    $('#document-list').innerHTML = ''
    $('#retry-dashboard').addEventListener('click', () => void loadDashboard())
  }
}

function openProjectDialog(): void {
  $('#project-form-error').textContent = ''
  $<HTMLDialogElement>('#project-dialog').showModal()
  $('#project-title').focus()
}

function refreshProjectSelect(): void {
  const options: Array<[string, string]> = [
    ['#document-project', 'No project selected'],
    ['#assistant-project', 'Workspace documents only'],
    ['#dataset-project', 'No project selected'],
    ['#questionnaire-project', 'No project selected']
  ]
  options.forEach(([selector, placeholder]) => {
    const select = document.querySelector<HTMLSelectElement>(selector)
    if (!select) return
    const selected = select.value
    select.innerHTML = `<option value="">${placeholder}</option>` + projects.map((project) => `<option value="${project.id}">${escapeHtml(project.title)}</option>`).join('')
    if (projects.some((project) => String(project.id) === selected)) select.value = selected
  })
}

async function loadProjectsPage(): Promise<void> {
  try {
    const data = await request<ProjectList>('/api/projects')
    projects = data.projects
    renderProjects($('#all-projects-list'), projects, 'Create a project to organize your research topic, progress, and deadline.')
    refreshProjectSelect()
  } catch (error) {
    $('#all-projects-list').textContent = error instanceof Error ? error.message : 'Could not load projects.'
  }
}

async function loadDocumentsPage(): Promise<void> {
  try {
    const data = await request<DocumentList>('/api/documents')
    renderDocuments($('#all-documents-list'), data.documents)
  } catch (error) {
    $('#all-documents-list').textContent = error instanceof Error ? error.message : 'Could not load documents.'
  }
}

function formatStatistic(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(value)
}

let activeDatasetDetail: DatasetDetail | null = null

function exportAnalysisCsv(): void {
  if (!activeDatasetDetail) return
  const dataset = activeDatasetDetail
  const rows: string[][] = [
    ['Dataset', dataset.sourceName],
    ['Project', dataset.projectTitle || 'Unlinked'],
    ['Observations', String(dataset.rowCount)],
    ['Variables', String(dataset.columnCount)],
    ['Duplicate rows', String(dataset.duplicateRows)],
    [],
    ['Variable', 'Type', 'Valid', 'Missing', 'Mean', 'Median', 'Standard deviation', 'Variance', 'Minimum', 'Q1', 'Q2', 'Q3', 'Maximum', 'Distinct values', 'Top categories']
  ]
  dataset.columnStats.forEach((stat) => {
    rows.push([
      stat.name,
      stat.kind,
      String(stat.nonMissing),
      String(stat.missing),
      stat.kind === 'numeric' ? formatStatistic(stat.mean) : '',
      stat.kind === 'numeric' ? formatStatistic(stat.median) : '',
      stat.kind === 'numeric' ? formatStatistic(stat.standardDeviation ?? undefined) : '',
      stat.kind === 'numeric' ? formatStatistic(stat.variance ?? undefined) : '',
      stat.kind === 'numeric' ? formatStatistic(stat.min) : '',
      stat.kind === 'numeric' ? formatStatistic(stat.quartiles?.q1) : '',
      stat.kind === 'numeric' ? formatStatistic(stat.quartiles?.q2) : '',
      stat.kind === 'numeric' ? formatStatistic(stat.quartiles?.q3) : '',
      stat.kind === 'numeric' ? formatStatistic(stat.max) : '',
      stat.kind === 'categorical' ? String(stat.unique ?? 0) : '',
      stat.kind === 'categorical'
        ? (stat.frequencies ?? []).map((item) => `${item.value} (${item.count}; ${formatStatistic(item.percentage)}%)`).join(' | ')
        : ''
    ])
  })
  const filename = `${dataset.sourceName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/\.[^.]+$/, '') || 'dataset'}-analysis.csv`
  downloadFile(filename, `${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`, 'text/csv')
  showToast('Analysis results exported as CSV.')
}

function renderDatasetAnalysis(dataset: DatasetDetail): void {
  const target = $('#dataset-analysis')
  activeDatasetDetail = dataset
  const exportButton = document.querySelector<HTMLButtonElement>('#export-analysis-csv')
  if (exportButton) exportButton.disabled = false
  const missingCells = dataset.columnStats.reduce((total, stat) => total + stat.missing, 0)
  const totalCells = dataset.rowCount * dataset.columnCount
  const selectedVariable = dataset.columnStats.find((stat) => stat.kind === 'numeric') ?? dataset.columnStats[0]
  const variableRows = dataset.columnStats.map((stat) => {
    const numeric = stat.kind === 'numeric'
    const mode = stat.frequencies?.[0]
    return `<tr>
      <td>${escapeHtml(stat.name)}</td>
      <td><span class="analysis-type ${stat.kind}">${numeric ? 'Numeric' : 'Categorical'}</span></td>
      <td class="numeric-cell">${stat.nonMissing}</td><td class="numeric-cell">${stat.missing}</td>
      <td class="numeric-cell">${numeric ? formatStatistic(stat.mean) : '—'}</td>
      <td class="numeric-cell">${numeric ? formatStatistic(stat.median) : '—'}</td>
      <td class="numeric-cell">${numeric ? formatStatistic(stat.standardDeviation ?? undefined) : '—'}</td>
      <td class="numeric-cell">${numeric ? formatStatistic(stat.min) : '—'}</td>
      <td class="numeric-cell">${numeric ? formatStatistic(stat.max) : '—'}</td>
      <td>${numeric ? '—' : escapeHtml(mode?.value ?? '—')}</td>
    </tr>`
  }).join('')
  const missingRows = dataset.columnStats
    .filter((stat) => stat.missing > 0)
    .sort((first, second) => second.missing - first.missing)
    .map((stat) => `<tr><td>${escapeHtml(stat.name)}</td><td class="numeric-cell">${stat.missing}</td><td class="numeric-cell">${formatStatistic(dataset.rowCount ? stat.missing / dataset.rowCount * 100 : 0)}%</td></tr>`)
    .join('')
  const sampleTable = `
    <div class="analysis-table-wrap"><table class="analysis-table"><thead><tr>${dataset.columns.map((column) => `<th scope="col">${escapeHtml(column)}</th>`).join('')}</tr></thead>
      <tbody>${dataset.sampleRows.map((row) => `<tr>${dataset.columns.map((column) => `<td>${escapeHtml(row[column] ?? '—')}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>`
  target.innerHTML = `
    <div class="analysis-dataset-meta"><strong>${escapeHtml(dataset.sourceName)}</strong><span>${dataset.projectTitle ? `Project: ${escapeHtml(dataset.projectTitle)}` : 'Unlinked dataset'}</span><span>${dataset.questionnaireId ? 'Questionnaire responses' : `Imported ${relativeDate(dataset.createdAt)}`}</span></div>
    <div class="analysis-tabs" role="tablist" aria-label="Analysis views">
      <button class="analysis-tab" type="button" role="tab" aria-selected="true" data-analysis-tab="overview">Overview</button>
      <button class="analysis-tab" type="button" role="tab" aria-selected="false" data-analysis-tab="variables">Variables</button>
      <button class="analysis-tab" type="button" role="tab" aria-selected="false" data-analysis-tab="preview">Data preview</button>
      <button class="analysis-tab" type="button" role="tab" aria-selected="false" data-analysis-tab="quality">Data quality</button>
    </div>
    <section class="analysis-panel" role="tabpanel" data-analysis-panel="overview">
      <div class="analysis-summary-grid">
        <div class="analysis-summary-item"><span>Observations</span><strong>${dataset.rowCount.toLocaleString()}</strong></div>
        <div class="analysis-summary-item"><span>Variables</span><strong>${dataset.columnCount.toLocaleString()}</strong></div>
        <div class="analysis-summary-item"><span>Missing cells</span><strong>${missingCells.toLocaleString()} <small>${formatStatistic(totalCells ? missingCells / totalCells * 100 : 0)}%</small></strong></div>
        <div class="analysis-summary-item"><span>Duplicate rows</span><strong>${dataset.duplicateRows.toLocaleString()}</strong></div>
      </div>
      <div class="analysis-overview-grid">
        <section class="analysis-chart-section" aria-labelledby="analysis-chart-title">
          <div class="analysis-panel-heading"><div><span class="section-kicker">DISTRIBUTION</span><h2 id="analysis-chart-title">Variable distribution</h2></div><label class="analysis-variable-picker" for="analysis-variable-select">Variable<select id="analysis-variable-select">${dataset.columnStats.map((stat) => `<option value="${escapeHtml(stat.name)}" ${stat.name === selectedVariable?.name ? 'selected' : ''}>${escapeHtml(stat.name)}</option>`).join('')}</select></label></div>
          <div class="analysis-chart-wrap"><canvas id="dataset-distribution-chart" role="img" aria-label="Selected variable distribution chart"></canvas></div>
          <p class="analysis-preview-note" id="analysis-chart-caption"></p>
        </section>
        <section class="analysis-quality-section"><div class="analysis-panel-heading"><div><span class="section-kicker">QUICK CHECKS</span><h2>Data quality</h2></div><span class="analysis-quality-count">${dataset.qualityWarnings.length ? `${dataset.qualityWarnings.length} check${dataset.qualityWarnings.length === 1 ? '' : 's'}` : 'No issues'}</span></div><ul class="analysis-quality-list">${dataset.qualityWarnings.slice(0, 4).map((warning) => `<li class="${warning.startsWith('No missing') ? 'is-clean' : ''}">${escapeHtml(warning)}</li>`).join('')}</ul><button class="text-button" type="button" data-analysis-open-tab="quality">Review quality details →</button></section>
      </div>
    </section>
    <section class="analysis-panel" role="tabpanel" data-analysis-panel="variables" hidden>
      <div class="analysis-panel-heading"><div><span class="section-kicker">VARIABLES</span><h2>Descriptive statistics</h2></div><span class="analysis-preview-note">${dataset.columnStats.length} variables</span></div>
      <div class="analysis-table-wrap"><table class="analysis-table"><thead><tr><th scope="col">Variable</th><th scope="col">Type</th><th class="numeric-cell" scope="col">Valid</th><th class="numeric-cell" scope="col">Missing</th><th class="numeric-cell" scope="col">Mean</th><th class="numeric-cell" scope="col">Median</th><th class="numeric-cell" scope="col">Std. dev.</th><th class="numeric-cell" scope="col">Min</th><th class="numeric-cell" scope="col">Max</th><th scope="col">Top category</th></tr></thead><tbody>${variableRows}</tbody></table></div>
    </section>
    <section class="analysis-panel" role="tabpanel" data-analysis-panel="preview" hidden>
      <div class="analysis-panel-heading"><div><span class="section-kicker">ROWS</span><h2>Data preview</h2></div><span class="analysis-preview-note">First ${dataset.sampleRows.length} of ${dataset.rowCount.toLocaleString()} observations</span></div>
      ${sampleTable}
    </section>
    <section class="analysis-panel" role="tabpanel" data-analysis-panel="quality" hidden>
      <div class="analysis-panel-heading"><div><span class="section-kicker">VALIDATION</span><h2>Data quality report</h2></div></div>
      <ul class="analysis-quality-list analysis-quality-full">${dataset.qualityWarnings.map((warning) => `<li class="${warning.startsWith('No missing') ? 'is-clean' : ''}">${escapeHtml(warning)}</li>`).join('')}</ul>
      <div class="analysis-panel-heading analysis-missing-heading"><div><span class="section-kicker">COMPLETENESS</span><h2>Missing values by variable</h2></div></div>
      ${missingRows ? `<div class="analysis-table-wrap"><table class="analysis-table"><thead><tr><th scope="col">Variable</th><th class="numeric-cell" scope="col">Missing</th><th class="numeric-cell" scope="col">Missing %</th></tr></thead><tbody>${missingRows}</tbody></table></div>` : '<p class="analysis-preview-note">No missing values detected.</p>'}
    </section>
  `

  const select = target.querySelector<HTMLSelectElement>('#analysis-variable-select')
  const drawSelectedVariable = async (): Promise<void> => {
    const variable = dataset.columnStats.find((stat) => stat.name === select?.value) ?? selectedVariable
    const canvas = target.querySelector<HTMLCanvasElement>('#dataset-distribution-chart')
    if (!canvas || !variable) return
    const { renderDatasetChart } = await import('./pages/analysis/charts')
    renderDatasetChart(canvas, variable)
    target.querySelector<HTMLElement>('#analysis-chart-caption')!.textContent = variable.kind === 'numeric'
      ? `Histogram of ${variable.count ?? variable.nonMissing} numeric observations. Bins are calculated from the full dataset.`
      : `Most frequent categories for ${variable.unique ?? 0} distinct values.`
  }
  select?.addEventListener('change', () => { void drawSelectedVariable() })
  target.querySelectorAll<HTMLButtonElement>('[data-analysis-tab], [data-analysis-open-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      const selectedTab = button.dataset.analysisTab ?? button.dataset.analysisOpenTab
      if (!selectedTab) return
      target.querySelectorAll<HTMLButtonElement>('[data-analysis-tab]').forEach((tab) => {
        tab.setAttribute('aria-selected', String(tab.dataset.analysisTab === selectedTab))
      })
      target.querySelectorAll<HTMLElement>('[data-analysis-panel]').forEach((panel) => {
        panel.hidden = panel.dataset.analysisPanel !== selectedTab
      })
      if (selectedTab === 'overview') void drawSelectedVariable()
    })
  })
  void drawSelectedVariable()
}

async function loadDatasetDetail(datasetId: number): Promise<void> {
  const target = $('#dataset-analysis')
  activeDatasetDetail = null
  const exportButton = document.querySelector<HTMLButtonElement>('#export-analysis-csv')
  if (exportButton) exportButton.disabled = true
  target.innerHTML = '<p class="loading-placeholder">Calculating dataset summaries…</p>'
  try {
    const result = await request<{ dataset: DatasetDetail }>(`/api/datasets/${datasetId}`)
    renderDatasetAnalysis(result.dataset)
  } catch (error) {
    target.innerHTML = `<p class="error-message">${escapeHtml(error instanceof Error ? error.message : 'Could not load this dataset.')}</p>`
  }
}

async function loadDatasetsPage(selectedId?: number): Promise<void> {
  const select = $('#dataset-select') as HTMLSelectElement
  try {
    const result = await request<{ datasets: DatasetSummary[] }>('/api/datasets')
    if (!result.datasets.length) {
      select.innerHTML = '<option value="">No datasets imported</option>'
      activeDatasetDetail = null
      const exportButton = document.querySelector<HTMLButtonElement>('#export-analysis-csv')
      if (exportButton) exportButton.disabled = true
      $('#dataset-analysis').innerHTML = '<p class="empty-assistant">Import a CSV file to see row counts, missing values, numeric summaries, and category frequencies.</p>'
      return
    }
    select.innerHTML = result.datasets.map((dataset) => (
      `<option value="${dataset.id}">${escapeHtml(dataset.sourceName)} · ${dataset.rowCount} ${dataset.rowCount === 1 ? 'response' : 'responses'}${dataset.questionnaireId ? ' · Questionnaire' : ''}</option>`
    )).join('')
    const id = selectedId ?? (Number(select.value) || result.datasets[0].id)
    select.value = String(id)
    await loadDatasetDetail(id)
  } catch (error) {
    $('#dataset-analysis').innerHTML = `<p class="error-message">${escapeHtml(error instanceof Error ? error.message : 'Could not load datasets.')}</p>`
  }
}

async function navigate(section: string, datasetId?: number): Promise<void> {
  document.querySelectorAll<HTMLElement>('.page-content').forEach((page) => { page.hidden = true })
  const page = $<HTMLElement>(`#${section}-page`)
  page.hidden = false
  const item = navItems.find((navItem) => navItem.section === section)
  $('#breadcrumb-current').textContent = item?.label ?? 'Dashboard'
  document.querySelectorAll('.nav-link').forEach((link) => link.classList.toggle('active', link.getAttribute('data-section') === section))
  if (section === 'projects') projectsLoadPromise = loadProjectsPage()
  if (section === 'editor') {
    await ensureEditorPage()
    if (documentPaginationPending) scheduleDocumentPagination()
    updateDocumentPageCount()
    projectsLoadPromise = loadProjectsPage()
    void loadDocumentsPage()
  }
  if (section === 'assistant') {
    projectsLoadPromise = loadProjectsPage()
    void projectsLoadPromise.then(() => loadAssistantConversations(true))
  }
  if (section === 'analysis') {
    projectsLoadPromise = loadProjectsPage()
    void loadDatasetsPage(datasetId)
  }
  if (section === 'references') void loadReferences()
  if (section === 'questionnaire') {
    projectsLoadPromise = loadProjectsPage()
    void projectsLoadPromise.then(() => loadQuestionnaires())
  }
  if (section === 'settings') renderSettingsPage(settingsPageContext)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function ensureEditorPage(): Promise<void> {
  if (editorPageInitialized) return
  if (!editorPagePromise) {
    const page = $<HTMLElement>('#editor-page')
    page.setAttribute('aria-busy', 'true')
    editorPagePromise = import('./pages/editor').then(({ mountEditorPage }) => {
      mountEditorPage(page, icon)
      page.setAttribute('aria-busy', 'false')
      initializeEditorControls()
      initializeDocumentSaveHandler()
      editorPageInitialized = true
      restoreLocalDraft()
    }).catch((error: unknown) => {
      page.setAttribute('aria-busy', 'false')
      page.textContent = 'Could not load the document editor. Select the tab to retry.'
      editorPagePromise = undefined
      throw error
    })
  }
  await editorPagePromise
}

document.querySelectorAll<HTMLAnchorElement>('.nav-link').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault()
    navigate(link.dataset.section ?? 'dashboard')
  })
})

$('.brand').addEventListener('click', (event) => {
  event.preventDefault()
  navigate('dashboard')
})

document.querySelectorAll<HTMLButtonElement>('[data-open-section]').forEach((button) => {
  button.addEventListener('click', () => navigate(button.dataset.openSection ?? 'dashboard'))
})

document.querySelectorAll<HTMLButtonElement>('[data-unavailable]').forEach((button) => {
  button.addEventListener('click', () => showToast(`${button.dataset.unavailable} is not implemented yet.`))
})

const renderReferences = (references: ReferenceRecord[]): void => {
  const list = document.querySelector<HTMLElement>('#references-list')
  if (!list) return
  savedReferences = references
  renderDocumentReferenceSelect()
  $<HTMLButtonElement>('#export-bibliography').disabled = references.length === 0
  list.innerHTML = references.length ? references.map((item) => `
    <article class="reference-item">
      <div>
        <div class="reference-header">
          <strong>${escapeHtml(item.title)}</strong>
          <span class="reference-type">${escapeHtml(referenceTypeLabels[item.type] ?? 'Source')}</span>
        </div>
        <p>${escapeHtml(item.authors || 'Author details not provided')} · ${escapeHtml(item.year || 'Year not provided')}</p>
        <p class="reference-citation">${escapeHtml(formatReferenceCitation(item))}</p>
        ${item.abstract ? `<small>${escapeHtml(item.abstract)}</small>` : ''}
        ${item.url ? `<a class="reference-source-link" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">Open source</a>` : ''}
      </div>
      <div class="reference-actions"><button class="button button-secondary" type="button" data-copy-reference="${item.id}">Copy citation</button><button class="button button-secondary" type="button" data-edit-reference="${item.id}">Edit</button><button class="button button-secondary danger-button" type="button" data-delete-reference="${item.id}">Delete</button></div>
    </article>
  `).join('') : '<div class="empty-state compact-empty"><strong>No references saved yet</strong><p>Add verified sources from your own reading list. References are stored in your ResearchMate database.</p></div>'

  list.querySelectorAll<HTMLButtonElement>('[data-copy-reference]').forEach((button) => {
    button.addEventListener('click', () => {
      const reference = references.find((item) => item.id === Number(button.dataset.copyReference))
      if (reference) void copyReferenceCitation(reference)
    })
  })
  list.querySelectorAll<HTMLButtonElement>('[data-edit-reference]').forEach((button) => {
    button.addEventListener('click', () => {
      const reference = references.find((item) => item.id === Number(button.dataset.editReference))
      if (reference) openReferenceForm(reference)
    })
  })
  list.querySelectorAll<HTMLButtonElement>('[data-delete-reference]').forEach((button) => {
    button.addEventListener('click', () => void deleteReference(Number(button.dataset.deleteReference)))
  })
}

const renderDocumentReferenceSelect = (): void => {
  const select = document.querySelector<HTMLSelectElement>('#document-reference-select')
  const citationButton = document.querySelector<HTMLButtonElement>('#insert-document-citation')
  const bibliographyButton = document.querySelector<HTMLButtonElement>('#insert-document-bibliography')
  if (!select || !citationButton || !bibliographyButton) return
  const selected = select.value
  select.innerHTML = savedReferences.length
    ? '<option value="">Choose a saved reference</option>' + savedReferences.map((reference) =>
      `<option value="${reference.id}">${escapeHtml(reference.title)}</option>`
    ).join('')
    : '<option value="">No references saved yet</option>'
  if (savedReferences.some((reference) => String(reference.id) === selected)) {
    select.value = selected
  }
  citationButton.disabled = savedReferences.length === 0 || !select.value
  bibliographyButton.disabled = savedReferences.length === 0
}

const formatReferenceCitation = (reference: ReferenceRecord): string => {
  const authors = reference.authors.trim() || '[Author not provided]'
  const authorPunctuation = /[.!?]$/.test(authors) ? '' : '.'
  const year = reference.year.trim() || 'n.d.'
  const title = reference.title.trim().replace(/\.+$/, '')
  const sourceType = referenceTypeLabels[reference.type] ?? 'Source'
  const url = reference.url.trim()
  return `${authors}${authorPunctuation} (${year}). ${title}. [${sourceType}]${url ? ` ${url}` : ''}`
}

const formatInTextCitation = (reference: ReferenceRecord): string => {
  const author = reference.authors.trim() || reference.title.trim() || '[Author not provided]'
  const year = reference.year.trim() || 'n.d.'
  return `(${author}, ${year})`
}

const copyReferenceCitation = async (reference: ReferenceRecord): Promise<void> => {
  try {
    await navigator.clipboard.writeText(formatReferenceCitation(reference))
    showToast('Citation draft copied.')
  } catch (error) {
    showToast(
      error instanceof Error ? `Could not copy citation: ${error.message}` : 'Could not copy citation.',
      true
    )
  }
}

const exportBibliography = (): void => {
  if (!savedReferences.length) {
    showToast('Add a reference before exporting a bibliography.', true)
    return
  }
  const bibliography = [...savedReferences]
    .sort((first, second) => {
      const firstAuthor = first.authors.trim() || first.title
      const secondAuthor = second.authors.trim() || second.title
      return firstAuthor.localeCompare(secondAuthor, undefined, { sensitivity: 'base' })
        || first.title.localeCompare(second.title, undefined, { sensitivity: 'base' })
    })
    .map(formatReferenceCitation)
    .join('\r\n\r\n')
  downloadFile('researchmate-bibliography.txt', `${bibliography}\r\n`, 'text/plain')
  showToast(`Exported ${savedReferences.length} citation draft${savedReferences.length === 1 ? '' : 's'}.`)
}

const loadReferences = async (): Promise<void> => {
  const list = $('#references-list')
  list.innerHTML = '<p class="loading-placeholder">Loading your references…</p>'
  try {
    const result = await request<{ references: ReferenceRecord[] }>('/api/references')
    renderReferences(result.references)
  } catch (error) {
    list.innerHTML = `<p class="error-message">${escapeHtml(error instanceof Error ? error.message : 'Could not load references.')}</p>`
  }
}

const openReferenceForm = (reference?: ReferenceRecord): void => {
  const form = $<HTMLFormElement>('#reference-form')
  form.hidden = false
  form.reset()
  $<HTMLInputElement>('#reference-id').value = reference ? String(reference.id) : ''
  $('#reference-form-heading').textContent = reference ? 'Edit reference' : 'Add a reference'
  $('#reference-form-error').textContent = ''
  if (reference) {
    form.querySelector<HTMLInputElement>('[name="title"]')!.value = reference.title
    form.querySelector<HTMLInputElement>('[name="authors"]')!.value = reference.authors
    form.querySelector<HTMLSelectElement>('[name="type"]')!.value = reference.type
    form.querySelector<HTMLInputElement>('[name="year"]')!.value = reference.year
    form.querySelector<HTMLInputElement>('[name="url"]')!.value = reference.url
    form.querySelector<HTMLTextAreaElement>('[name="abstract"]')!.value = reference.abstract
  }
  form.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const deleteReference = async (referenceId: number): Promise<void> => {
  if (!window.confirm('Delete this reference from your research library?')) return
  try {
    await request(`/api/references/${referenceId}`, { method: 'DELETE' })
    await loadReferences()
    showToast('Reference deleted.')
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Unable to delete this reference.', true)
  }
}

const renderQuestionnaire = (): void => {
  const list = document.querySelector<HTMLElement>('#questionnaire-list')
  if (!list) return
  list.innerHTML = questionnaireItems.length ? questionnaireItems.map((item, index) => `
    <article class="question-card">
      <div class="question-topline">
        <span>Question ${index + 1}</span>
        <label class="required-toggle"><input type="checkbox" ${item.required ? 'checked' : ''} data-question-required="${index}"> Required</label>
      </div>
      <label class="question-editor-label">Prompt</label>
      <input value="${escapeHtml(item.prompt)}" data-question-prompt="${index}" maxlength="1000" />
      <div class="question-editor-row">
        <label class="question-editor-label">Type</label>
        <select data-question-type="${index}">
          <option value="text" ${item.type === 'text' ? 'selected' : ''}>Short text</option>
          <option value="multiple-choice" ${item.type === 'multiple-choice' ? 'selected' : ''}>Multiple choice</option>
          <option value="scale" ${item.type === 'scale' ? 'selected' : ''}>Likert scale</option>
        </select>
      </div>
      ${item.type === 'text' ? '' : `
        <label class="question-editor-label">${item.type === 'scale' ? 'Scale points' : 'Answer options'}</label>
        <input value="${escapeHtml(item.options.join(', '))}" data-question-options="${index}" maxlength="15000"
          placeholder="${item.type === 'scale' ? 'Strongly disagree, Disagree, Neutral, Agree, Strongly agree' : 'Option 1, Option 2'}" />
        <small class="question-options-hint">Enter at least two choices, separated by commas.</small>
      `}
      <button class="text-button question-remove" type="button" data-remove-question="${index}">Remove question</button>
    </article>
  `).join('') : '<div class="empty-state compact-empty"><strong>No questions added</strong><p>Add your first question. Items are saved to this questionnaire when you press Save.</p></div>'
  list.querySelectorAll<HTMLSelectElement>('[data-question-type]').forEach((select) => {
    select.addEventListener('change', () => {
      const index = Number(select.dataset.questionType)
      questionnaireItems = readQuestionnaireForm()
      const item = questionnaireItems[index]
      if (!item) return
      if (item.type === 'text') {
        item.options = []
      } else if (!item.options.length) {
        item.options = item.type === 'scale'
          ? ['Strongly disagree', 'Disagree', 'Neither agree nor disagree', 'Agree', 'Strongly agree']
          : ['Option 1', 'Option 2']
      }
      renderQuestionnaire()
    })
  })
  list.querySelectorAll<HTMLButtonElement>('[data-remove-question]').forEach((button) => {
    button.addEventListener('click', () => {
      questionnaireItems = readQuestionnaireForm()
      questionnaireItems.splice(Number(button.dataset.removeQuestion), 1)
      renderQuestionnaire()
    })
  })
}

const settingsPageContext: SettingsPageContext = {
  storageKey: STORAGE_KEYS.settings,
  defaults: defaultSettings,
  read: readStoredValue,
  write: writeStoredValue,
  toast: showToast
}

const readQuestionnaireForm = (): QuestionnaireItem[] => {
  return Array.from(document.querySelectorAll<HTMLElement>('.question-card')).map((card, index) => {
    const prompt = card.querySelector<HTMLInputElement>('[data-question-prompt]')?.value ?? `Question ${index + 1}`
    const rawType = card.querySelector<HTMLSelectElement>('[data-question-type]')?.value
    const type: QuestionnaireItem['type'] = rawType === 'multiple-choice' || rawType === 'scale' ? rawType : 'text'
    const options = (card.querySelector<HTMLInputElement>('[data-question-options]')?.value ?? '')
      .split(',')
      .map((option) => option.trim())
      .filter(Boolean)
    const required = card.querySelector<HTMLInputElement>('[data-question-required]')?.checked ?? false
    return { id: index + 1, prompt, type, options, required }
  })
}

const validateQuestionnaireItems = (items: QuestionnaireItem[]): string | null => {
  for (const [index, item] of items.entries()) {
    if (!item.prompt.trim()) return `Add a prompt for question ${index + 1}.`
    if (item.type !== 'text' && item.options.length < 2) {
      return `Add at least two options for question ${index + 1}.`
    }
  }
  return null
}

function handleQuestionnaireSelection(value: string): void {
  const questionnaireId = Number(value)
  if (!Number.isInteger(questionnaireId) || questionnaireId < 1) {
    selectQuestionnaire(null)
    return
  }
  const selected = questionnaires.find((item) => item.id === questionnaireId)
  if (!selected) return
  selectQuestionnaire(selected)
  void loadQuestionnaireResponses(selected.id)
}

const renderQuestionnaireSelect = (): void => {
  const select = $<HTMLSelectElement>('#questionnaire-select')
  select.innerHTML = questionnaires.length
    ? '<option value="">Select a questionnaire</option>' + questionnaires.map((questionnaire) =>
      `<option value="${questionnaire.id}">${escapeHtml(questionnaire.title)}${questionnaire.projectTitle ? ` · ${escapeHtml(questionnaire.projectTitle)}` : ''}</option>`
    ).join('')
    : '<option value="">No saved questionnaires</option>'
  if (activeQuestionnaireId !== null && questionnaires.some((item) => item.id === activeQuestionnaireId)) {
    select.value = String(activeQuestionnaireId)
  } else {
    select.value = ''
  }
  $('#delete-questionnaire').toggleAttribute('disabled', activeQuestionnaireId === null)
}

const renderQuestionnaireResponses = (): void => {
  const panel = $('#questionnaire-response-panel')
  const preview = $('#questionnaire-preview')
  panel.hidden = activeQuestionnaireId === null
  if (panel.hidden) {
    preview.hidden = true
    preview.innerHTML = ''
    $('#questionnaire-responses-list').innerHTML = ''
    questionnaireResponses = []
    return
  }

  const count = questionnaireResponses.length
  $('#questionnaire-response-count').textContent = `${count} response${count === 1 ? '' : 's'}`
  $<HTMLButtonElement>('#export-questionnaire-responses').disabled = count === 0
  $<HTMLButtonElement>('#analyze-questionnaire-responses').disabled = count === 0
  $('#questionnaire-responses-list').innerHTML = count ? questionnaireResponses.map((response) => `
    <article class="questionnaire-response-item">
      <div class="questionnaire-response-heading">
        <strong>Response ${response.id}</strong>
        <time datetime="${escapeHtml(response.submittedAt)}">${escapeHtml(new Date(response.submittedAt).toLocaleString())}</time>
      </div>
      <dl>
        ${response.answers.map((answer) => `
          <div><dt>${escapeHtml(answer.prompt)}</dt><dd>${escapeHtml(answer.answer || 'No answer')}</dd></div>
        `).join('')}
      </dl>
    </article>
  `).join('') : '<div class="empty-state compact-empty"><strong>No responses yet</strong><p>Preview the saved questionnaire to test it and record a response on this device.</p></div>'
}

const loadQuestionnaireResponses = async (questionnaireId: number): Promise<void> => {
  $('#questionnaire-response-status').textContent = 'Loading saved responses…'
  try {
    const result = await request<{ responses: QuestionnaireResponse[] }>(
      `/api/questionnaires/${questionnaireId}/responses`
    )
    if (activeQuestionnaireId !== questionnaireId) return
    questionnaireResponses = result.responses
    renderQuestionnaireResponses()
    $('#questionnaire-response-status').textContent = ''
  } catch (error) {
    $('#questionnaire-response-status').textContent = error instanceof Error
      ? error.message
      : 'Could not load questionnaire responses.'
    renderQuestionnaireResponses()
  }
}

const previewQuestionnaire = (): void => {
  const questionnaire = questionnaires.find((item) => item.id === activeQuestionnaireId)
  if (!questionnaire) {
    $('#questionnaire-response-status').textContent = 'Save the questionnaire before previewing it.'
    return
  }
  if (!questionnaire.items.length) {
    $('#questionnaire-response-status').textContent = 'Add and save at least one question before previewing.'
    return
  }
  const preview = $('#questionnaire-preview')
  preview.innerHTML = `
    <form id="questionnaire-response-form" class="questionnaire-response-form">
      <div class="questionnaire-preview-heading">
        <span class="section-kicker">SAVED QUESTIONNAIRE</span>
        <h3>${escapeHtml(questionnaire.title)}</h3>
        <p>Your response will be stored with this saved version of the questionnaire.</p>
      </div>
      ${questionnaire.items.map((item) => `
        <fieldset class="response-question">
          <legend>${escapeHtml(item.prompt)}${item.required ? ' <span class="response-required">Required</span>' : ''}</legend>
          ${item.type === 'text'
            ? `<textarea name="answer-${item.id}" rows="3" maxlength="5000" ${item.required ? 'required' : ''}></textarea>`
            : item.options.map((option, index) => `
                <label class="response-option">
                  <input type="radio" name="answer-${item.id}" value="${escapeHtml(option)}"
                    ${item.required && index === 0 ? 'required' : ''}>
                  <span>${escapeHtml(option)}</span>
                </label>
              `).join('')}
        </fieldset>
      `).join('')}
      <div class="form-actions">
        <button class="button button-secondary" id="cancel-questionnaire-preview" type="button">Close preview</button>
        <button class="button button-primary" type="submit">Submit response</button>
      </div>
    </form>
  `
  preview.hidden = false
  preview.scrollIntoView({ behavior: 'smooth', block: 'start' })
  preview.querySelector<HTMLButtonElement>('#cancel-questionnaire-preview')?.addEventListener('click', () => {
    preview.hidden = true
  })
}

const submitQuestionnaireResponse = async (form: HTMLFormElement): Promise<void> => {
  if (activeQuestionnaireId === null) return
  const formData = new FormData(form)
  const questionnaire = questionnaires.find((item) => item.id === activeQuestionnaireId)
  if (!questionnaire) return
  const answers = Object.fromEntries(questionnaire.items.map((item) => [
    String(item.id),
    String(formData.get(`answer-${item.id}`) ?? '')
  ]))
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')
  if (submit) submit.disabled = true
  $('#questionnaire-response-status').textContent = 'Saving response…'
  try {
    const questionnaireId = activeQuestionnaireId
    await request<{ response: QuestionnaireResponse; responseCount: number }>(
      `/api/questionnaires/${questionnaireId}/responses`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers })
      }
    )
    form.reset()
    await loadQuestionnaireResponses(questionnaireId)
    $('#questionnaire-response-status').textContent = 'Response saved to this ResearchMate database.'
    showToast('Questionnaire response saved.')
  } catch (error) {
    $('#questionnaire-response-status').textContent = error instanceof Error
      ? error.message
      : 'Unable to save this response.'
  } finally {
    if (submit) submit.disabled = false
  }
}

const csvCell = (value: string): string => {
  const safeValue = /^[\t\r\n ]*[=+\-@]/.test(value) ? `'${value}` : value
  return `"${safeValue.replace(/"/g, '""')}"`
}

const exportQuestionnaireResponses = (): void => {
  if (!questionnaireResponses.length) {
    $('#questionnaire-response-status').textContent = 'There are no responses to export yet.'
    return
  }
  const columns = new Map<string, string>()
  questionnaireResponses.forEach((response) => {
    response.answers.forEach((answer) => columns.set(`${answer.questionId}:${answer.prompt}`, answer.prompt))
  })
  const headers = [...columns.keys()]
  const csv = [
    ['Submitted at', ...headers.map((key) => columns.get(key) ?? '')].map(csvCell).join(','),
    ...questionnaireResponses.map((response) => {
      const answers = new Map(response.answers.map((answer) => [
        `${answer.questionId}:${answer.prompt}`,
        answer.answer
      ]))
      return [
        response.submittedAt,
        ...headers.map((key) => answers.get(key) ?? '')
      ].map(csvCell).join(',')
    })
  ].join('\r\n')
  const questionnaire = questionnaires.find((item) => item.id === activeQuestionnaireId)
  const filename = `${(questionnaire?.title ?? 'questionnaire').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').slice(0, 100) || 'questionnaire'}-responses.csv`
  downloadFile(filename, csv, 'text/csv')
  $('#questionnaire-response-status').textContent = `Exported ${questionnaireResponses.length} response${questionnaireResponses.length === 1 ? '' : 's'} as CSV.`
  showToast('Responses exported as CSV.')
}

const analyzeQuestionnaireResponses = async (): Promise<void> => {
  if (activeQuestionnaireId === null) return
  const questionnaireId = activeQuestionnaireId
  const button = $<HTMLButtonElement>('#analyze-questionnaire-responses')
  button.disabled = true
  $('#questionnaire-response-status').textContent = 'Preparing a dataset from saved responses…'
  try {
    const result = await request<{ dataset: DatasetDetail }>(
      `/api/questionnaires/${questionnaireId}/dataset`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      }
    )
    showToast(`Analyzing ${result.dataset.rowCount} saved responses.`)
    navigate('analysis', result.dataset.id)
  } catch (error) {
    $('#questionnaire-response-status').textContent = error instanceof Error
      ? error.message
      : 'Unable to prepare this questionnaire for analysis.'
  } finally {
    button.disabled = questionnaireResponses.length === 0
  }
}

const selectQuestionnaire = (questionnaire: Questionnaire | null): void => {
  activeQuestionnaireId = questionnaire?.id ?? null
  questionnaireResponses = []
  $('#questionnaire-response-status').textContent = ''
  questionnaireItems = questionnaire ? questionnaire.items.map((item) => ({ ...item, options: [...item.options] })) : []
  $<HTMLInputElement>('#questionnaire-title').value = questionnaire?.title ?? ''
  $<HTMLSelectElement>('#questionnaire-project').value = questionnaire?.projectId ? String(questionnaire.projectId) : ''
  $('#questionnaire-status').textContent = questionnaire
    ? `Last saved ${relativeDate(questionnaire.updatedAt)}.`
    : 'New questionnaire · not saved yet.'
  renderQuestionnaireSelect()
  renderQuestionnaire()
  renderQuestionnaireResponses()
}

const loadQuestionnaires = async (selectId?: number): Promise<void> => {
  $('#questionnaire-status').textContent = 'Loading saved questionnaires…'
  try {
    const result = await request<{ questionnaires: Questionnaire[] }>('/api/questionnaires')
    questionnaires = result.questionnaires
    const targetId = selectId ?? activeQuestionnaireId
    const selected = targetId === null ? null : questionnaires.find((item) => item.id === targetId) ?? null
    renderQuestionnaireSelect()
    if (selected) {
      selectQuestionnaire(selected)
      await loadQuestionnaireResponses(selected.id)
    } else if (targetId === null) {
      selectQuestionnaire(null)
      $('#questionnaire-status').textContent = questionnaires.length
        ? 'Choose a saved questionnaire or start a new one.'
        : 'No saved questionnaires yet. Start a new one when you are ready.'
    } else {
      selectQuestionnaire(null)
      $('#questionnaire-status').textContent = 'The selected questionnaire is no longer available.'
    }
  } catch (error) {
    $('#questionnaire-status').textContent = error instanceof Error ? error.message : 'Could not load questionnaires.'
    renderQuestionnaire()
  }
}

const startQuestionnaire = (): void => {
  selectQuestionnaire(null)
  $<HTMLInputElement>('#questionnaire-title').focus()
}

const addQuestion = (): void => {
  questionnaireItems = readQuestionnaireForm()
  questionnaireItems.push({
    id: questionnaireItems.length ? Math.max(...questionnaireItems.map((item) => item.id)) + 1 : 1,
    prompt: 'New question prompt',
    type: 'text',
    options: [],
    required: false
  })
  renderQuestionnaire()
}

const generateQuestionnaire = async (): Promise<void> => {
  const topic = $<HTMLTextAreaElement>('#questionnaire-ai-topic').value.trim()
  if (!topic) {
    $('#questionnaire-ai-status').textContent = 'Describe your topic or research objective first.'
    return
  }
  const button = $<HTMLButtonElement>('#generate-questionnaire')
  const originalLabel = button.innerHTML
  button.disabled = true
  button.textContent = 'Generating draft…'
  $('#questionnaire-ai-status').textContent = 'Asking Gemini to prepare an editable draft…'
  try {
    const projectValue = $<HTMLSelectElement>('#questionnaire-project').value
    const result = await request<{ draft: { title: string; projectId: number | null; items: QuestionnaireItem[] } }>(
      '/api/questionnaires/generate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          projectId: projectValue ? Number(projectValue) : null,
          questionCount: Number($<HTMLSelectElement>('#questionnaire-ai-count').value),
          questionStyle: $<HTMLSelectElement>('#questionnaire-ai-style').value
        })
      }
    )
    questionnaireItems = result.draft.items
    $<HTMLInputElement>('#questionnaire-title').value = result.draft.title
    renderQuestionnaire()
    $('#questionnaire-ai-status').textContent = 'Draft generated. Review and edit the questions, then save when ready.'
  } catch (error) {
    $('#questionnaire-ai-status').textContent = error instanceof Error
      ? error.message
      : 'Unable to generate a questionnaire draft.'
  } finally {
    button.disabled = false
    button.innerHTML = originalLabel
  }
}

const saveQuestionnaire = async (): Promise<void> => {
  const title = $<HTMLInputElement>('#questionnaire-title').value.trim()
  if (!title) {
    $('#questionnaire-status').textContent = 'Enter a title before saving.'
    return
  }
  questionnaireItems = readQuestionnaireForm()
  const validationError = validateQuestionnaireItems(questionnaireItems)
  if (validationError) {
    $('#questionnaire-status').textContent = validationError
    return
  }
  const projectValue = $<HTMLSelectElement>('#questionnaire-project').value
  const payload = {
    title,
    projectId: projectValue ? Number(projectValue) : null,
    items: questionnaireItems
  }
  const button = $<HTMLButtonElement>('#save-questionnaire')
  button.disabled = true
  $('#questionnaire-status').textContent = 'Saving questionnaire…'
  try {
    const result = await request<{ questionnaire: Questionnaire }>(
      activeQuestionnaireId === null ? '/api/questionnaires' : `/api/questionnaires/${activeQuestionnaireId}`,
      {
        method: activeQuestionnaireId === null ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    )
    await loadQuestionnaires(result.questionnaire.id)
    $('#questionnaire-status').textContent = 'Questionnaire saved to your ResearchMate database.'
    showToast('Questionnaire saved.')
  } catch (error) {
    $('#questionnaire-status').textContent = error instanceof Error ? error.message : 'Unable to save questionnaire.'
  } finally {
    button.disabled = false
  }
}

const deleteQuestionnaire = async (): Promise<void> => {
  if (activeQuestionnaireId === null) return
  if (!window.confirm('Delete this questionnaire, its questions, and all saved responses?')) return
  try {
    await request(`/api/questionnaires/${activeQuestionnaireId}`, { method: 'DELETE' })
    questionnaires = questionnaires.filter((item) => item.id !== activeQuestionnaireId)
    selectQuestionnaire(null)
    renderQuestionnaireSelect()
    $('#questionnaire-status').textContent = questionnaires.length
      ? 'Questionnaire deleted. Choose another saved questionnaire or start a new one.'
      : 'Questionnaire deleted. Start a new questionnaire when you are ready.'
    showToast('Questionnaire deleted.')
  } catch (error) {
    $('#questionnaire-status').textContent = error instanceof Error ? error.message : 'Unable to delete questionnaire.'
  }
}

const exportQuestionnaire = (): void => {
  const title = $<HTMLInputElement>('#questionnaire-title').value.trim()
  if (!title) {
    $('#questionnaire-status').textContent = 'Add a questionnaire title before exporting.'
    return
  }
  const questionnaire = {
    title,
    projectId: $<HTMLSelectElement>('#questionnaire-project').value || null,
    questions: readQuestionnaireForm()
  }
  const validationError = validateQuestionnaireItems(questionnaire.questions)
  if (validationError) {
    $('#questionnaire-status').textContent = validationError
    return
  }
  if (!questionnaire.questions.length) {
    $('#questionnaire-status').textContent = 'Add at least one question before exporting.'
    return
  }
  const filename = `${title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').slice(0, 100) || 'questionnaire'}.json`
  downloadFile(filename, JSON.stringify(questionnaire, null, 2), 'application/json')
  $('#questionnaire-status').textContent = 'Questionnaire exported as JSON.'
  showToast('Questionnaire exported.')
}

function downloadFile(filename: string, content: string, contentType: string): void {
  const blob = new Blob([content], { type: `${contentType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.position = 'fixed'
  link.style.left = '-10000px'
  document.body.append(link)
  link.click()
  window.setTimeout(() => {
    link.remove()
    URL.revokeObjectURL(url)
  }, 1000)
}

const richTextPrefix = 'researchmate-rich-text-v1\n'
const documentPageSizes = {
  a4: { label: 'A4', width: 794, height: 1123 },
  letter: { label: 'Letter', width: 816, height: 1056 },
  legal: { label: 'Legal', width: 816, height: 1344 },
  a3: { label: 'A3', width: 1123, height: 1587 },
  a5: { label: 'A5', width: 559, height: 794 }
} as const
const allowedDocumentTags = new Set([
  'A', 'B', 'BLOCKQUOTE', 'BR', 'CODE', 'DIV', 'EM', 'H1', 'H2', 'H3', 'H4',
  'HR', 'I', 'LI', 'OL', 'P', 'PRE', 'S', 'SPAN', 'STRIKE', 'STRONG', 'SUB',
  'SUP', 'U', 'UL'
])
const dangerousDocumentTags = new Set(['IFRAME', 'OBJECT', 'SCRIPT', 'STYLE', 'SVG', 'TEMPLATE'])

let savedDocumentRange: Range | null = null

function sanitizeDocumentHtml(value: string): string {
  const parsed = new DOMParser().parseFromString(value, 'text/html')
  const sanitizeChildren = (parent: ParentNode): void => {
    Array.from(parent.childNodes).forEach((node) => {
      if (!(node instanceof Element)) return
      if (!allowedDocumentTags.has(node.tagName)) {
        if (dangerousDocumentTags.has(node.tagName)) {
          node.remove()
          return
        }
        sanitizeChildren(node)
        node.replaceWith(...Array.from(node.childNodes))
        return
      }

      const element = node as HTMLElement
      const style = element.style
      const color = style.color
      const backgroundColor = style.backgroundColor
      const fontSize = style.fontSize
      const fontFamily = style.fontFamily.replace(/["']/g, '').trim()
      const textAlign = style.textAlign
      const href = node.tagName === 'A' ? node.getAttribute('href') : null
      Array.from(node.attributes).forEach((attribute) => node.removeAttribute(attribute.name))
      if (color && CSS.supports('color', color)) element.style.color = color
      if (backgroundColor && CSS.supports('color', backgroundColor)) element.style.backgroundColor = backgroundColor
      if (/^(8|9|[1-6]\d|7[0-2])px$/.test(fontSize)) element.style.fontSize = fontSize
      if (/^(Aptos|Arial|Calibri|Georgia|Times New Roman|Verdana)$/i.test(fontFamily)) element.style.fontFamily = fontFamily
      if (['left', 'center', 'right', 'justify'].includes(textAlign)) element.style.textAlign = textAlign
      if (node.tagName === 'A') {
        if (href) {
          try {
            const link = new URL(href, window.location.origin)
            if (['http:', 'https:', 'mailto:'].includes(link.protocol)) element.setAttribute('href', href)
          } catch {
            // Invalid links are omitted from saved document content.
          }
        }
      }
      sanitizeChildren(node)
    })
  }
  sanitizeChildren(parsed.body)
  return parsed.body.innerHTML
}

function documentPlainText(): string {
  return ($<HTMLElement>('#document-editable').innerText || $<HTMLElement>('#document-editable').textContent || '')
    .replace(/\u200b/g, '')
}

function serializedDocumentContent(): string {
  const content = Array.from(document.querySelectorAll<HTMLElement>('.document-page-content'))
    .map((page) => page.innerHTML)
    .join('')
  return `${richTextPrefix}${sanitizeDocumentHtml(content)}`
}

function createDocumentPage(): HTMLElement {
  const page = document.createElement('div')
  page.className = 'document-page'
  const content = document.createElement('div')
  content.className = 'document-page-content'
  content.dataset.placeholder = 'Start writing your document…'
  page.append(content)
  return page
}

function documentPageContents(): HTMLElement[] {
  return Array.from($<HTMLElement>('#document-editable').querySelectorAll<HTMLElement>('.document-page-content'))
}

function normalizeDocumentPageContent(content: HTMLElement): void {
  Array.from(content.childNodes).forEach((node) => {
    if (node.nodeType !== Node.TEXT_NODE || !node.textContent) return
    const lines = node.textContent.split('\n')
    if (lines.length === 1) {
      const paragraph = document.createElement('div')
      paragraph.append(node)
      node.replaceWith(paragraph)
      return
    }

    const selection = window.getSelection()
    const anchorOffset = selection?.anchorNode === node ? selection.anchorOffset : null
    const focusOffset = selection?.focusNode === node ? selection.focusOffset : null
    const textNode = node as Text
    const marker = document.createComment('')
    node.replaceWith(marker)
    textNode.textContent = lines[0]
    const fragment = document.createDocumentFragment()
    const lineNodes: Text[] = [textNode]
    lines.forEach((line, index) => {
      if (index === 0) return
      const paragraph = document.createElement('div')
      const text = document.createTextNode(line)
      lineNodes.push(text)
      if (line) paragraph.append(text)
      else {
        paragraph.append(text, document.createElement('br'))
      }
      fragment.append(paragraph)
    })
    const firstParagraph = document.createElement('div')
    firstParagraph.append(textNode)
    if (!lines[0]) firstParagraph.append(document.createElement('br'))
    fragment.insertBefore(firstParagraph, fragment.firstChild)
    marker.replaceWith(fragment)

    const restoreOffset = (offset: number | null): { node: Text; offset: number } | null => {
      if (offset === null) return null
      let remaining = offset
      for (let index = 0; index < lineNodes.length; index += 1) {
        const lineNode = lineNodes[index]
        if (remaining <= lineNode.length || index === lineNodes.length - 1) {
          return { node: lineNode, offset: Math.min(remaining, lineNode.length) }
        }
        remaining -= lineNode.length + 1
      }
      return null
    }
    const anchor = restoreOffset(anchorOffset)
    const focus = restoreOffset(focusOffset)
    if (anchor && focus && selection) {
      selection.setBaseAndExtent(anchor.node, anchor.offset, focus.node, focus.offset)
    }
  })
}

function findPageOverflowSplit(block: HTMLElement, pageContent: HTMLElement): DocumentFragment | null {
  const pageBottom = pageContent.getBoundingClientRect().bottom
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
  let lastVisibleNode: Text | null = null
  let lastVisibleOffset = 0
  let splitNode: Text | null = null
  let splitOffset = 0
  let current = walker.nextNode()

  while (current) {
    const textNode = current as Text
    const textLength = textNode.length
    let low = 0
    let high = textLength - 1
    let visibleEnd = -1
    while (low <= high) {
      const middle = Math.floor((low + high) / 2)
      const range = document.createRange()
      range.setStart(textNode, middle)
      range.setEnd(textNode, middle + 1)
      if (range.getBoundingClientRect().bottom <= pageBottom + 1) {
        visibleEnd = middle
        low = middle + 1
      } else {
        high = middle - 1
      }
    }

    if (visibleEnd >= 0) {
      lastVisibleNode = textNode
      lastVisibleOffset = visibleEnd + 1
    }
    if (visibleEnd < textLength - 1) {
      if (lastVisibleNode) {
        splitNode = lastVisibleNode
        splitOffset = lastVisibleOffset
        const visibleText = splitNode.textContent ?? ''
        const whitespace = visibleText.lastIndexOf(' ', Math.max(0, splitOffset - 1))
        if (whitespace > 0) splitOffset = whitespace + 1
      }
      break
    }
    current = walker.nextNode()
  }

  if (!splitNode || splitOffset <= 0) return null
  const split = document.createRange()
  split.setStart(splitNode, splitOffset)
  split.setEndAfter(block)
  const preview = split.cloneContents()
  if (!preview.textContent?.trim()) return null
  const remainder = split.extractContents()
  const continuation = block.cloneNode(false) as HTMLElement
  continuation.append(remainder)
  const fragment = document.createDocumentFragment()
  fragment.append(continuation)
  return fragment
}

async function paginateDocument(version: number): Promise<void> {
  const editor = $<HTMLElement>('#document-editable')
  if (!editor.getClientRects().length) {
    documentPaginationPending = true
    return
  }
  if (version !== documentPaginationVersion) return

  let operationsSinceYield = 0
  const shouldStopAfterYield = async (): Promise<boolean> => {
    operationsSinceYield += 1
    if (version !== documentPaginationVersion) return true
    if (operationsSinceYield < 4) return false
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
    operationsSinceYield = 0
    return version !== documentPaginationVersion
  }

  let pages = Array.from(editor.querySelectorAll<HTMLElement>('.document-page'))
  if (!pages.length) {
    const page = createDocumentPage()
    editor.append(page)
    pages = [page]
  }
  for (const page of pages) {
    normalizeDocumentPageContent(page.querySelector<HTMLElement>('.document-page-content')!)
    if (await shouldStopAfterYield()) return
  }

  let pageIndex = 0
  while (pageIndex < pages.length) {
    const page = pages[pageIndex]
    const content = page.querySelector<HTMLElement>('.document-page-content')!
    let nextContent = pages[pageIndex + 1]?.querySelector<HTMLElement>('.document-page-content')

    while (content.scrollHeight > content.clientHeight + 1) {
      if (!nextContent) {
        const nextPage = createDocumentPage()
        editor.append(nextPage)
        pages.push(nextPage)
        nextContent = nextPage.querySelector<HTMLElement>('.document-page-content')!
      }

      const blocks = Array.from(content.children)
      if (blocks.length > 1) {
        nextContent.prepend(blocks[blocks.length - 1])
        if (await shouldStopAfterYield()) return
        continue
      }
      if (blocks.length === 1) {
        const continuation = findPageOverflowSplit(blocks[0] as HTMLElement, content)
        if (continuation) {
          nextContent.prepend(continuation)
          if (await shouldStopAfterYield()) return
          continue
        }
      }
      break
    }

    if (nextContent) {
      while (nextContent.firstChild) {
        const candidate = nextContent.firstChild
        content.append(candidate)
        if (content.scrollHeight > content.clientHeight + 1) {
          nextContent.prepend(candidate)
          break
        }
        if (await shouldStopAfterYield()) return
      }
    }

    pageIndex += 1
    if (await shouldStopAfterYield()) return
  }

  while (pages.length > 1) {
    const lastPage = pages[pages.length - 1]
    const lastContent = lastPage.querySelector<HTMLElement>('.document-page-content')!
    if (lastContent.childNodes.length) break
    lastPage.remove()
    pages.pop()
  }
  documentPaginationPending = false
  updateDocumentPageCount()
}

function scheduleDocumentPagination(): void {
  documentPaginationPending = true
  const version = ++documentPaginationVersion
  if (documentPaginationFrame !== undefined) window.clearTimeout(documentPaginationFrame)
  documentPaginationFrame = window.setTimeout(() => {
    documentPaginationFrame = undefined
    void paginateDocument(version).catch((error: unknown) => {
      console.error(error)
    })
  }, 0)
}

function applyDocumentPageSetup(): void {
  const paper = $<HTMLElement>('#document-paper')
  const pageSize = $<HTMLSelectElement>('#document-page-size').value as keyof typeof documentPageSizes
  const orientation = $<HTMLSelectElement>('#document-orientation').value
  const dimensions = documentPageSizes[pageSize] ?? documentPageSizes.a4
  const width = orientation === 'landscape' ? dimensions.height : dimensions.width
  const height = orientation === 'landscape' ? dimensions.width : dimensions.height
  paper.dataset.pageSize = pageSize
  paper.dataset.orientation = orientation
  paper.dataset.margins = $<HTMLSelectElement>('#document-margins').value
  paper.style.setProperty('--page-width', `${width}px`)
  paper.style.setProperty('--page-height', `${height}px`)
  const margin = paper.dataset.margins === 'narrow' ? 0.5 : 1
  $<HTMLElement>('#document-editable').style.setProperty('--page-margin', `${margin}in`)
  scheduleDocumentPagination()
  updateDocumentPageCount()
}

function updateDocumentPageCount(): void {
  const paper = $<HTMLElement>('#document-paper')
  const editor = $<HTMLElement>('#document-editable')
  const pageSize = documentPageSizes[paper.dataset.pageSize as keyof typeof documentPageSizes] ?? documentPageSizes.a4
  const landscape = paper.dataset.orientation === 'landscape'
  const pages = Array.from(editor.querySelectorAll<HTMLElement>('.document-page'))
  const pageCount = Math.max(1, pages.length)
  const selection = window.getSelection()
  const currentPage = selection?.anchorNode
    ? (selection.anchorNode instanceof Element ? selection.anchorNode : selection.anchorNode.parentElement)?.closest('.document-page')
    : null
  const pageNumber = currentPage ? Math.max(1, pages.indexOf(currentPage as HTMLElement) + 1) : 1
  const orientation = landscape ? ' landscape' : ''
  $('#document-page-indicator').textContent = `${pageSize.label}${orientation} · Page ${pageNumber} of ${pageCount}`
}

function countWords(text: string): number {
  let words = 0
  let inWord = false
  for (const character of text) {
    if (/\s/.test(character)) {
      inWord = false
    } else if (!inWord) {
      words += 1
      inWord = true
    }
  }
  return words
}

function updateDocumentEditorMetrics(): void {
  const text = documentPlainText()
  const words = countWords(text)
  const characters = text.length
  $('#document-word-count').textContent = `${words} ${words === 1 ? 'word' : 'words'}`
  $('#document-review-count').textContent = `${words} ${words === 1 ? 'word' : 'words'} · ${characters} ${characters === 1 ? 'character' : 'characters'}`
}

function syncDocumentEditor(): void {
  scheduleDocumentPagination()
  window.clearTimeout(documentMetricsTimer)
  documentMetricsTimer = window.setTimeout(updateDocumentEditorMetrics, 150)
}

function setDocumentEditorContent(content: string): void {
  const editor = $<HTMLElement>('#document-editable')
  editor.innerHTML = ''
  const page = createDocumentPage()
  const pageContent = page.querySelector<HTMLElement>('.document-page-content')!
  if (content.startsWith(richTextPrefix)) {
    pageContent.innerHTML = sanitizeDocumentHtml(content.slice(richTextPrefix.length))
  } else {
    const paragraph = document.createElement('div')
    if (content) paragraph.textContent = content.replace(/\r\n?/g, '\n')
    else paragraph.append(document.createElement('br'))
    pageContent.append(paragraph)
  }
  editor.append(page)
  syncDocumentEditor()
}

function documentSelectionRange(): Range | null {
  const editor = $<HTMLElement>('#document-editable')
  const selection = window.getSelection()
  if (selection?.rangeCount && editor.contains(selection.anchorNode)) return selection.getRangeAt(0).cloneRange()
  if (savedDocumentRange && editor.contains(savedDocumentRange.startContainer)) return savedDocumentRange.cloneRange()
  return null
}

function restoreDocumentSelection(): Range | null {
  const range = documentSelectionRange()
  if (range) {
    const anchor = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement
    anchor?.closest<HTMLElement>('.document-page-content')?.focus()
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    savedDocumentRange = range.cloneRange()
  } else {
    documentPageContents()[0]?.focus()
  }
  return range
}

function applyInlineDocumentStyle(property: 'color' | 'backgroundColor' | 'fontFamily' | 'fontSize', value: string): void {
  const editor = $<HTMLElement>('#document-editable')
  const range = restoreDocumentSelection()
  if (!range) return
  const span = document.createElement('span')
  span.style[property] = value
  if (range.collapsed) {
    const marker = document.createTextNode('\u200b')
    span.append(marker)
    range.insertNode(span)
    const caret = document.createRange()
    caret.setStart(marker, 1)
    caret.collapse(true)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(caret)
  } else {
    span.append(range.extractContents())
    range.insertNode(span)
    const selected = document.createRange()
    selected.selectNodeContents(span)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(selected)
  }
  savedDocumentRange = documentSelectionRange()
  editor.dispatchEvent(new Event('input', { bubbles: true }))
}

function insertAtDocumentCursor(text: string, inline = false): void {
  const editor = $<HTMLElement>('#document-editable')
  const range = restoreDocumentSelection() ?? document.createRange()
  if (!range.startContainer || !editor.contains(range.startContainer)) {
    range.selectNodeContents(editor)
    range.collapse(false)
  }
  let insertion = text
  if (inline) {
    const before = range.startContainer.textContent?.slice(0, range.startOffset).slice(-1) ?? ''
    const after = range.endContainer.textContent?.slice(range.endOffset, range.endOffset + 1) ?? ''
    if (before && !/\s/.test(before)) insertion = ` ${insertion}`
    if (after && !/\s/.test(after)) insertion = `${insertion} `
  }
  range.deleteContents()
  const node = document.createTextNode(insertion)
  range.insertNode(node)
  range.setStartAfter(node)
  range.collapse(true)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
  savedDocumentRange = range.cloneRange()
  editor.focus()
  editor.dispatchEvent(new Event('input', { bubbles: true }))
}

function writingTextFragment(text: string): DocumentFragment {
  const fragment = document.createDocumentFragment()
  const appendText = (value: string): void => {
    const span = document.createElement('span')
    span.textContent = value
    fragment.append(span)
  }

  text.replace(/\r\n?/g, '\n').split('\n').forEach((line, lineIndex) => {
    if (lineIndex > 0) fragment.append(document.createElement('br'))
    let remaining = line
    while (remaining.length > 700) {
      const lastSpace = remaining.lastIndexOf(' ', 700)
      const boundary = lastSpace > 350 ? lastSpace + 1 : 700
      appendText(remaining.slice(0, boundary))
      remaining = remaining.slice(boundary)
    }
    if (remaining) appendText(remaining)
  })

  if (!fragment.lastChild) fragment.append(document.createTextNode(''))
  return fragment
}

function insertWritingTextAtRange(range: Range, text: string): void {
  range.deleteContents()
  const fragment = writingTextFragment(text)
  const lastNode = fragment.lastChild!
  range.insertNode(fragment)
  range.setStartAfter(lastNode)
  range.collapse(true)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
  savedDocumentRange = range.cloneRange()
  documentEditable.focus()
  documentEditable.dispatchEvent(new Event('input', { bubbles: true }))
  scheduleDocumentPagination()
}

function insertDocumentCitation(): void {
  const referenceId = Number($<HTMLSelectElement>('#document-reference-select').value)
  const reference = savedReferences.find((item) => item.id === referenceId)
  if (!reference) {
    showToast('Choose a saved reference first.', true)
    return
  }
  insertAtDocumentCursor(formatInTextCitation(reference), true)
  showToast('Citation inserted into your draft.')
}

function insertDocumentBibliography(): void {
  if (!savedReferences.length) {
    showToast('Save a reference before inserting a bibliography.', true)
    return
  }
  const references = [...savedReferences].sort((first, second) => {
    const firstAuthor = first.authors.trim() || first.title
    const secondAuthor = second.authors.trim() || second.title
    return firstAuthor.localeCompare(secondAuthor, undefined, { sensitivity: 'base' })
      || first.title.localeCompare(second.title, undefined, { sensitivity: 'base' })
  })
  const content = `\n\nReferences\n\n${references.map(formatReferenceCitation).join('\n\n')}`
  insertAtDocumentCursor(content)
  showToast(`Inserted ${references.length} reference${references.length === 1 ? '' : 's'} into your draft.`)
}

function fillDocumentEditor(savedDocument: ResearchDocument): void {
  $<HTMLInputElement>('#document-id').value = String(savedDocument.id)
  $<HTMLInputElement>('#document-title').value = savedDocument.title
  $<HTMLSelectElement>('#document-project').value = savedDocument.projectId ? String(savedDocument.projectId) : ''
  setDocumentEditorContent(savedDocument.content)
  $('#document-save-status').textContent = `Editing saved document · ${relativeDate(savedDocument.updatedAt)}`
  $('#document-title').focus()
}

function saveLocalDraft(): void {
  const settings = readStoredValue<AppSettings>(STORAGE_KEYS.settings, defaultSettings)
  if (!settings.autoSave) return
  const title = $<HTMLInputElement>('#document-title').value
  const content = serializedDocumentContent()
  const projectId = $<HTMLSelectElement>('#document-project').value
  if (!title.trim() && !content.trim()) return
  const documentId = $<HTMLInputElement>('#document-id').value
  const draft: LocalDraft = { title, content, projectId, documentId, savedAt: new Date().toISOString() }
  writeStoredValue(STORAGE_KEYS.localDraft, draft)
  $('#document-save-status').textContent = 'Draft recovery copy saved on this device.'
}

function restoreLocalDraft(): void {
  const settings = readStoredValue<AppSettings>(STORAGE_KEYS.settings, defaultSettings)
  if (!settings.autoSave) return
  const draft = pendingLocalDraft ?? readStoredValue<LocalDraft | null>(STORAGE_KEYS.localDraft, null)
  if (!draft) return
  if (!editorPageInitialized) {
    pendingLocalDraft = draft
    return
  }
  pendingLocalDraft = null
  $<HTMLInputElement>('#document-title').value = draft.title
  setDocumentEditorContent(draft.content)
  $<HTMLSelectElement>('#document-project').value = draft.projectId
  $<HTMLInputElement>('#document-id').value = draft.documentId
  $('#document-save-status').textContent = `Recovered local draft from ${relativeDate(draft.savedAt)}. Save document to store it in your database.`
}

function clearLocalDraft(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEYS.localDraft)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown local storage error.'
    $('#document-save-status').textContent = `Document saved, but the local recovery copy could not be cleared: ${message}`
  }
}

function startNewDocument(): void {
  $<HTMLFormElement>('#document-form').reset()
  $<HTMLInputElement>('#document-id').value = ''
  savedDocumentRange = null
  setDocumentEditorContent('')
  applyDocumentPageSetup()
  $('#document-save-status').textContent = 'New draft'
}

function documentExportName(title: string, extension: string): string {
  const safeTitle = title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').slice(0, 100) || 'research-draft'
  return `${safeTitle}.${extension}`
}

function documentExportHtml(title: string, content: string, wordDocument = false): string {
  const paper = $<HTMLElement>('#document-paper')
  const pageSize = documentPageSizes[paper.dataset.pageSize as keyof typeof documentPageSizes] ?? documentPageSizes.a4
  const orientation = paper.dataset.orientation === 'landscape' ? 'landscape' : 'portrait'
  const margins = paper.dataset.margins === 'narrow' ? '0.5in' : '1in'
  const wordNamespaces = wordDocument
    ? ' xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"'
    : ''
  return `<!doctype html>
<html${wordNamespaces} lang="en">
<head>
  <meta charset="utf-8">
  <meta name="ProgId" content="Word.Document">
  <meta name="Generator" content="ResearchMate">
  <meta name="Originator" content="ResearchMate">
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: ${pageSize.label} ${orientation}; margin: ${margins}; }
    body { color: #202630; font-family: Aptos, Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.55; }
    h1, h2, h3 { line-height: 1.2; page-break-after: avoid; }
    blockquote { margin-left: 1em; padding-left: 1em; border-left: 3px solid #b6c8d9; color: #586575; }
    img { max-width: 100%; }
  </style>
</head>
<body>
  <main>${content || '<p></p>'}</main>
</body>
</html>`
}

function openDocumentPrintView(title: string, content: string): void {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    showToast('Allow pop-ups to open the print dialog and save a PDF.', true)
    return
  }
  printWindow.document.open()
  printWindow.document.write(documentExportHtml(title, content))
  printWindow.document.close()
  printWindow.document.title = title
  window.setTimeout(() => {
    if (printWindow.closed) return
    printWindow.focus()
    printWindow.print()
  }, 300)
}

function exportDocument(): void {
  const title = $<HTMLInputElement>('#document-title').value.trim()
  if (!title) {
    showToast('Add a document title before exporting.', true)
    return
  }
  const format = $<HTMLSelectElement>('#document-export-format').value
  const content = serializedDocumentContent().slice(richTextPrefix.length)
  if (format === 'pdf') {
    openDocumentPrintView(title, content)
    return
  }
  if (format === 'doc' || format === 'html') {
    const wordDocument = format === 'doc'
    const html = documentExportHtml(title, content, wordDocument)
    downloadFile(
      documentExportName(title, wordDocument ? 'doc' : 'html'),
      html,
      wordDocument ? 'application/msword' : 'text/html'
    )
    showToast(wordDocument ? 'Word-compatible document exported.' : 'Web page exported.')
    return
  }
  downloadFile(documentExportName(title, 'txt'), documentPlainText(), 'text/plain')
  showToast('Plain text document exported.')
}

const renderAssistantMessages = (): void => {
  const output = $('#assistant-output')
  output.innerHTML = assistantMessages.length
    ? assistantMessages.map((message) => `
      <article class="assistant-message assistant-message-${message.role}">
        <strong>${message.role === 'user' ? 'You' : 'ResearchMate AI'}</strong>
        <p>${escapeHtml(message.content)}</p>
      </article>
    `).join('')
    : '<p class="empty-assistant">This conversation is ready. Ask a question to begin.</p>'
  output.scrollTop = output.scrollHeight
}

const renderAssistantConversationSelect = (): void => {
  const select = $<HTMLSelectElement>('#assistant-conversations')
  select.innerHTML = '<option value="">New conversation</option>' + assistantConversations.map((conversation) =>
    `<option value="${conversation.id}">${escapeHtml(conversation.title)}${conversation.projectTitle ? ` · ${escapeHtml(conversation.projectTitle)}` : ''}</option>`
  ).join('')
  select.value = activeAssistantConversationId === null ? '' : String(activeAssistantConversationId)
}

const openAssistantConversation = async (conversationId: number): Promise<void> => {
  const output = $('#assistant-output')
  output.innerHTML = '<p class="loading-placeholder">Loading saved conversation…</p>'
  try {
    const result = await request<{ conversation: AssistantConversation; messages: AssistantMessage[] }>(
      `/api/assistant/conversations/${conversationId}`
    )
    activeAssistantConversationId = result.conversation.id
    assistantMessages = result.messages
    const projectSelect = $<HTMLSelectElement>('#assistant-project')
    projectSelect.value = result.conversation.projectId ? String(result.conversation.projectId) : ''
    projectSelect.disabled = true
    renderAssistantConversationSelect()
    renderAssistantMessages()
  } catch (error) {
    output.innerHTML = `<p class="error-message">${escapeHtml(error instanceof Error ? error.message : 'Could not load this conversation.')}</p>`
  }
}

const loadAssistantConversations = async (openLatest = false): Promise<void> => {
  const select = $<HTMLSelectElement>('#assistant-conversations')
  select.disabled = true
  try {
    const result = await request<{ conversations: AssistantConversation[] }>('/api/assistant/conversations')
    assistantConversations = result.conversations
    const currentExists = assistantConversations.some((conversation) => conversation.id === activeAssistantConversationId)
    if (!currentExists) activeAssistantConversationId = null
    renderAssistantConversationSelect()
    if (activeAssistantConversationId !== null) {
      await openAssistantConversation(activeAssistantConversationId)
    } else if (openLatest && assistantConversations.length) {
      await openAssistantConversation(assistantConversations[0].id)
    } else {
      assistantMessages = []
      $<HTMLSelectElement>('#assistant-project').disabled = false
      renderAssistantMessages()
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load saved conversations.'
    $('#assistant-output').innerHTML = `
      <p class="error-message">${escapeHtml(message)}</p>
      <button class="button button-secondary" id="assistant-retry-load" type="button">Retry loading</button>
    `
    $('#assistant-retry-load').addEventListener('click', () => void loadAssistantConversations())
  } finally {
    select.disabled = false
  }
}

const createAssistantConversation = async (): Promise<number> => {
  const projectValue = $<HTMLSelectElement>('#assistant-project').value
  const result = await request<{ conversation: AssistantConversation; messages: AssistantMessage[] }>(
    '/api/assistant/conversations',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: projectValue ? Number(projectValue) : null })
    }
  )
  activeAssistantConversationId = result.conversation.id
  assistantMessages = []
  $<HTMLSelectElement>('#assistant-project').disabled = true
  await loadAssistantConversations()
  return result.conversation.id
}

const generateAssistantAdvice = async (): Promise<void> => {
  const prompt = $<HTMLTextAreaElement>('#assistant-prompt').value.trim()
  const output = $('#assistant-output')
  if (!prompt) {
    output.innerHTML = '<p class="empty-assistant">Add a research question or message before sending.</p>'
    return
  }

  const button = $<HTMLButtonElement>('#assistant-submit')
  const newButton = $<HTMLButtonElement>('#assistant-new-conversation')
  button.disabled = true
  newButton.disabled = true
  output.innerHTML = '<p class="loading-placeholder">ResearchMate AI is considering your question and saved context…</p>'
  try {
    const conversationId = activeAssistantConversationId ?? await createAssistantConversation()
    const result = await request<{ conversation: AssistantConversation; messages: AssistantMessage[] }>(
      `/api/assistant/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: prompt })
      }
    )
    activeAssistantConversationId = result.conversation.id
    assistantMessages = result.messages
    $<HTMLTextAreaElement>('#assistant-prompt').value = ''
    await loadAssistantConversations()
    renderAssistantMessages()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to get an AI response.'
    output.innerHTML = `
      <p class="error-message">${escapeHtml(message)}</p>
      <button class="button button-secondary" id="assistant-retry" type="button">Retry request</button>
    `
    $('#assistant-retry').addEventListener('click', () => void generateAssistantAdvice())
  } finally {
    button.disabled = false
    newButton.disabled = false
  }
}

bindDashboardPage({
  newProject: openProjectDialog,
  openEditor: () => { void navigate('editor') },
  openAssistant: () => { void navigate('assistant') }
})
bindProjectsPage(openProjectDialog)
bindAssistantPage({
  submit: () => { void generateAssistantAdvice() },
  clear: () => { $<HTMLTextAreaElement>('#assistant-prompt').value = '' },
  newConversation: () => {
    activeAssistantConversationId = null
    assistantMessages = []
    $<HTMLSelectElement>('#assistant-conversations').value = ''
    $<HTMLSelectElement>('#assistant-project').disabled = false
    renderAssistantMessages()
  },
  selectConversation: (value) => {
    const conversationId = Number(value)
    if (Number.isInteger(conversationId) && conversationId > 0) {
      void openAssistantConversation(conversationId)
      return
    }
    activeAssistantConversationId = null
    assistantMessages = []
    $<HTMLSelectElement>('#assistant-project').disabled = false
    renderAssistantMessages()
  }
})
bindReferencesPage({
  add: () => openReferenceForm(),
  export: exportBibliography,
  cancel: () => {
    const form = $<HTMLFormElement>('#reference-form')
    form.reset()
    form.hidden = true
  },
  submit: (event) => { void saveReferenceForm(event) }
})
bindQuestionnairePage({
  start: startQuestionnaire,
  select: handleQuestionnaireSelection,
  addQuestion,
  generate: () => { void generateQuestionnaire() },
  save: () => { void saveQuestionnaire() },
  delete: () => { void deleteQuestionnaire() },
  export: exportQuestionnaire,
  preview: previewQuestionnaire,
  exportResponses: exportQuestionnaireResponses,
  analyzeResponses: () => { void analyzeQuestionnaireResponses() },
  submitResponse: (form) => { void submitQuestionnaireResponse(form) }
})
bindSettingsPage(settingsPageContext)
bindAnalysisPage({
  request,
  readCsvFile,
  toast: showToast,
  refreshProjectSelect,
  loadDatasetsPage
}, (value) => {
    const datasetId = Number(value)
    if (Number.isInteger(datasetId) && datasetId > 0) void loadDatasetDetail(datasetId)
})
  document.querySelector<HTMLButtonElement>('#export-analysis-csv')?.addEventListener('click', exportAnalysisCsv)

function initializeEditorControls(): void {
let writingAssistantCursor: Comment | null = null
let writingAssistantSelection: Range | null = null
bindEditorPage(startNewDocument, {
  request,
  captureCursor: () => {
    writingAssistantCursor?.remove()
    writingAssistantCursor = null
    let range = documentSelectionRange()
    if (!range) {
      const lastPageContent = documentPageContents().at(-1)
      if (lastPageContent) {
        range = document.createRange()
        range.selectNodeContents(lastPageContent)
        range.collapse(false)
      }
    }
    writingAssistantSelection = range && !range.collapsed ? range.cloneRange() : null
    if (!range) return ''
    const selectedText = writingAssistantSelection?.toString().trim() ?? ''
    const insertionRange = range.cloneRange()
    if (!insertionRange.collapsed) insertionRange.collapse(false)
    if (writingAssistantSelection) {
      savedDocumentRange = insertionRange.cloneRange()
    } else {
      writingAssistantCursor = document.createComment('writing-assistant-cursor')
      insertionRange.insertNode(writingAssistantCursor)
      const bookmarkRange = document.createRange()
      bookmarkRange.setStartBefore(writingAssistantCursor)
      bookmarkRange.collapse(true)
      savedDocumentRange = bookmarkRange
    }
    return selectedText
  },
  getDocumentText: documentPlainText,
  insertText: (text, replaceSelection) => {
    let range = replaceSelection && writingAssistantSelection
      ? writingAssistantSelection.cloneRange()
      : documentSelectionRange()
    if (writingAssistantCursor?.parentNode && documentEditable.contains(writingAssistantCursor)) {
      range = document.createRange()
      range.setStartBefore(writingAssistantCursor)
      range.setEndAfter(writingAssistantCursor)
    } else if (!replaceSelection && range && !range.collapsed) {
      range.collapse(false)
    }
    if (!range) {
      range = document.createRange()
      range.selectNodeContents(documentEditable)
      range.collapse(false)
    }
    const targetPage = (range.startContainer instanceof Element
      ? range.startContainer
      : range.startContainer.parentElement)?.closest<HTMLElement>('.document-page')
    insertWritingTextAtRange(range, text)
    writingAssistantCursor = null
    writingAssistantSelection = null
    targetPage?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    showToast('Suggestion inserted at the cursor.')
  },
  createSummaryDocument: async (text) => {
    window.clearTimeout(localDraftTimer)
    localDraftTimer = undefined
    const sourceTitle = $<HTMLInputElement>('#document-title').value.trim() || 'Untitled document'
    const projectValue = $<HTMLSelectElement>('#document-project').value
    const summaryHtml = `<div>${escapeHtml(text).replace(/\r?\n/g, '<br>')}</div>`
    const result = await request<{ document: ResearchDocument }>('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `Summary of ${sourceTitle}`.slice(0, 200),
        content: `${richTextPrefix}${summaryHtml}`,
        projectId: projectValue ? Number(projectValue) : null
      })
    })
    await Promise.all([loadDocumentsPage(), loadDashboard()])
    fillDocumentEditor(result.document)
    $('#document-save-status').textContent = 'Summary saved as a new document.'
    showToast('Summary saved as a new document.')
  },
  releaseCursor: () => {
    if (writingAssistantCursor?.parentNode && documentEditable.contains(writingAssistantCursor)) {
      const range = document.createRange()
      range.setStartBefore(writingAssistantCursor)
      range.collapse(true)
      writingAssistantCursor.remove()
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      savedDocumentRange = range.cloneRange()
      documentEditable.focus()
    }
    writingAssistantCursor = null
    writingAssistantSelection = null
  }
})
const documentExportDialog = $<HTMLDialogElement>('#document-export-dialog')
$('#export-document').addEventListener('click', () => {
  const title = $<HTMLInputElement>('#document-title').value.trim()
  if (!title) {
    showToast('Add a document title before exporting.', true)
    return
  }
  $('#document-export-name').textContent = title
  documentExportDialog.showModal()
})
$<HTMLSelectElement>('#document-export-format').addEventListener('change', (event) => {
  const help: Record<string, string> = {
    doc: 'Opens in Microsoft Word and other word processors.',
    pdf: 'Opens the print dialog, where you can choose Save as PDF.',
    html: 'Exports a formatted web page you can open in a browser.',
    txt: 'Exports the document text without formatting.'
  }
  const format = (event.currentTarget as HTMLSelectElement).value
  const description = help[format]
  if (description) $('#document-export-help').textContent = description
})
$('#confirm-document-export').addEventListener('click', () => {
  exportDocument()
  documentExportDialog.close()
})
$<HTMLSelectElement>('#document-reference-select').addEventListener('change', renderDocumentReferenceSelect)
$('#insert-document-citation').addEventListener('click', insertDocumentCitation)
$('#insert-document-bibliography').addEventListener('click', insertDocumentBibliography)
documentEditable = $<HTMLElement>('#document-editable')
documentEditable.addEventListener('input', syncDocumentEditor)
documentEditable.addEventListener('paste', (event) => {
  event.preventDefault()
  const clipboard = event.clipboardData
  const html = clipboard?.getData('text/html')
  const text = clipboard?.getData('text/plain') ?? ''
  if (html) {
    const safeHtml = sanitizeDocumentHtml(html)
    if (safeHtml) document.execCommand('insertHTML', false, safeHtml)
    else insertAtDocumentCursor(text)
  } else {
    insertAtDocumentCursor(text)
  }
  syncDocumentEditor()
})
documentEditable.addEventListener('drop', (event) => {
  event.preventDefault()
  const html = event.dataTransfer?.getData('text/html')
  const text = event.dataTransfer?.getData('text/plain') ?? ''
  if (html) {
    const safeHtml = sanitizeDocumentHtml(html)
    if (safeHtml) document.execCommand('insertHTML', false, safeHtml)
    else insertAtDocumentCursor(text)
  } else {
    insertAtDocumentCursor(text)
  }
  syncDocumentEditor()
})
document.addEventListener('selectionchange', () => {
  const selection = window.getSelection()
  if (selection?.rangeCount && documentEditable.contains(selection.anchorNode)) {
    savedDocumentRange = selection.getRangeAt(0).cloneRange()
  }
})
document.querySelectorAll<HTMLButtonElement>('[data-editor-command]').forEach((button) => {
  button.addEventListener('mousedown', (event) => event.preventDefault())
  button.addEventListener('click', () => {
    restoreDocumentSelection()
    document.execCommand(button.dataset.editorCommand ?? '', false)
    savedDocumentRange = documentSelectionRange()
    syncDocumentEditor()
  })
})
document.querySelectorAll<HTMLButtonElement>('[data-ribbon-tab]').forEach((tab) => {
  tab.addEventListener('click', () => {
    const selected = tab.dataset.ribbonTab
    document.querySelectorAll<HTMLButtonElement>('[data-ribbon-tab]').forEach((item) => {
      const active = item === tab
      item.classList.toggle('active', active)
      item.setAttribute('aria-selected', String(active))
    })
    document.querySelectorAll<HTMLElement>('[data-ribbon-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.ribbonPanel !== selected
    })
  })
})
$<HTMLSelectElement>('#document-font').addEventListener('change', (event) => {
  applyInlineDocumentStyle('fontFamily', (event.currentTarget as HTMLSelectElement).value)
})
$<HTMLSelectElement>('#document-font-size').addEventListener('change', (event) => {
  applyInlineDocumentStyle('fontSize', `${(event.currentTarget as HTMLSelectElement).value}px`)
})
$<HTMLInputElement>('#document-text-color').addEventListener('input', (event) => {
  const input = event.currentTarget as HTMLInputElement
  input.closest<HTMLElement>('.word-color-tool')?.style.setProperty('--color-indicator', input.value)
  applyInlineDocumentStyle('color', input.value)
})
$<HTMLInputElement>('#document-highlight-color').addEventListener('input', (event) => {
  const input = event.currentTarget as HTMLInputElement
  input.closest<HTMLElement>('.word-color-tool')?.style.setProperty('--color-indicator', input.value)
  applyInlineDocumentStyle('backgroundColor', input.value)
})
$<HTMLSelectElement>('#document-style').addEventListener('change', (event) => {
  restoreDocumentSelection()
  document.execCommand('formatBlock', false, (event.currentTarget as HTMLSelectElement).value)
  syncDocumentEditor()
})
$('#clear-document-formatting').addEventListener('mousedown', (event) => event.preventDefault())
$('#clear-document-formatting').addEventListener('click', () => {
  restoreDocumentSelection()
  document.execCommand('removeFormat', false)
  document.execCommand('formatBlock', false, 'p')
  syncDocumentEditor()
})
$('#insert-document-link').addEventListener('mousedown', (event) => event.preventDefault())
$('#insert-document-link').addEventListener('click', () => {
  const rawUrl = $<HTMLInputElement>('#document-link-url').value.trim()
  if (!rawUrl) {
    showToast('Enter a link address first.', true)
    return
  }
  let link: URL
  try {
    link = new URL(rawUrl)
  } catch {
    showToast('Enter a valid link address.', true)
    return
  }
  if (!['http:', 'https:', 'mailto:'].includes(link.protocol)) {
    showToast('Links must use HTTP, HTTPS, or email.', true)
    return
  }
  const range = restoreDocumentSelection() ?? document.createRange()
  if (range.collapsed) {
    const anchor = document.createElement('a')
    anchor.href = link.href
    anchor.textContent = rawUrl
    range.insertNode(anchor)
    range.setStartAfter(anchor)
    range.collapse(true)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  } else {
    document.execCommand('createLink', false, link.href)
  }
  $<HTMLInputElement>('#document-link-url').value = ''
  syncDocumentEditor()
})
$('#insert-document-rule').addEventListener('mousedown', (event) => event.preventDefault())
$('#insert-document-rule').addEventListener('click', () => {
  restoreDocumentSelection()
  document.execCommand('insertHorizontalRule', false)
  syncDocumentEditor()
})
$<HTMLSelectElement>('#document-page-size').addEventListener('change', applyDocumentPageSetup)
$<HTMLSelectElement>('#document-orientation').addEventListener('change', applyDocumentPageSetup)
$<HTMLSelectElement>('#document-margins').addEventListener('change', () => {
  applyDocumentPageSetup()
})
applyDocumentPageSetup()
$<HTMLInputElement>('#document-spellcheck').addEventListener('change', (event) => {
  documentEditable.spellcheck = (event.currentTarget as HTMLInputElement).checked
})
$<HTMLInputElement>('#document-zoom').addEventListener('input', (event) => {
  const zoom = Number((event.currentTarget as HTMLInputElement).value)
  $('#document-zoom-value').textContent = `${zoom}%`
  documentEditable.style.fontSize = `${11 * zoom / 100}pt`
})
$('#document-focus-mode').addEventListener('click', (event) => {
  const button = event.currentTarget as HTMLButtonElement
  const active = button.getAttribute('aria-pressed') !== 'true'
  button.setAttribute('aria-pressed', String(active))
  button.classList.toggle('active', active)
  $('.word-workspace').classList.toggle('focus-mode', active)
})
const localDraftFields = ['#document-title', '#document-editable']
localDraftFields.forEach((selector) => {
  document.querySelector<HTMLElement>(selector)?.addEventListener('input', () => {
    window.clearTimeout(localDraftTimer)
    localDraftTimer = window.setTimeout(saveLocalDraft, 500)
  })
})
$('#document-project').addEventListener('change', () => {
  window.clearTimeout(localDraftTimer)
  localDraftTimer = window.setTimeout(saveLocalDraft, 500)
})
}

$('#close-project-dialog').addEventListener('click', () => $<HTMLDialogElement>('#project-dialog').close())
$('#cancel-project').addEventListener('click', () => $<HTMLDialogElement>('#project-dialog').close())
$<HTMLDialogElement>('#project-dialog').addEventListener('click', (event) => {
  if (event.target === $<HTMLDialogElement>('#project-dialog')) $<HTMLDialogElement>('#project-dialog').close()
})

async function saveReferenceForm(event: SubmitEvent): Promise<void> {
  event.preventDefault()
  const form = event.currentTarget as HTMLFormElement
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!
  const fields = new FormData(form)
  const referenceId = String(fields.get('id') ?? '')
  const payload = {
    title: String(fields.get('title') ?? ''),
    authors: String(fields.get('authors') ?? ''),
    type: String(fields.get('type') ?? 'article'),
    year: String(fields.get('year') ?? ''),
    url: String(fields.get('url') ?? ''),
    abstract: String(fields.get('abstract') ?? '')
  }
  submit.disabled = true
  $('#reference-form-error').textContent = ''
  try {
    await request(referenceId ? `/api/references/${Number(referenceId)}` : '/api/references', {
      method: referenceId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    form.reset()
    form.hidden = true
    await loadReferences()
    showToast(referenceId ? 'Reference updated.' : 'Reference saved.')
  } catch (error) {
    $('#reference-form-error').textContent = error instanceof Error ? error.message : 'Unable to save this reference.'
  } finally {
    submit.disabled = false
  }
}

$('#project-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  const form = event.currentTarget as HTMLFormElement
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!
  const fields = new FormData(form)
  const payload = {
    title: String(fields.get('title') ?? ''),
    researchArea: String(fields.get('researchArea') ?? ''),
    description: String(fields.get('description') ?? ''),
    dueDate: String(fields.get('dueDate') ?? ''),
    status: 'active'
  }
  submit.disabled = true
  $('#project-form-error').textContent = ''
  try {
    await request('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    form.reset()
    $<HTMLDialogElement>('#project-dialog').close()
    showToast('Research project created.')
    await loadDashboard()
    if (!$('#projects-page').hidden) await loadProjectsPage()
    refreshProjectSelect()
  } catch (error) {
    $('#project-form-error').textContent = error instanceof Error ? error.message : 'Unable to create project.'
  } finally {
    submit.disabled = false
  }
})

function initializeDocumentSaveHandler(): void {
$('#document-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  const form = event.currentTarget as HTMLFormElement
  syncDocumentEditor()
  $<HTMLTextAreaElement>('#document-content').value = serializedDocumentContent()
  const submit = $<HTMLButtonElement>('#save-document-button')
  const fields = new FormData(form)
  const projectValue = String(fields.get('projectId') ?? '')
  const content = String(fields.get('content') ?? '')
  if (content.length > 900_000) {
    $('#document-save-status').textContent = 'This document is too long to save. Reduce the content to under 900,000 characters.'
    return
  }
  const payload = {
    title: String(fields.get('title') ?? ''),
    content,
    projectId: projectValue ? Number(projectValue) : null
  }
  const documentId = $<HTMLInputElement>('#document-id').value
  submit.disabled = true
  $('#document-save-status').textContent = 'Saving…'
  try {
    const result = await request<{ document: ResearchDocument }>(documentId ? `/api/documents/${Number(documentId)}` : '/api/documents', {
      method: documentId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const projectSelection = $<HTMLSelectElement>('#document-project').value
    $<HTMLInputElement>('#document-id').value = String(result.document.id)
    $<HTMLSelectElement>('#document-project').value = projectSelection
    $('#document-save-status').textContent = 'Saved to your research workspace.'
    clearLocalDraft()
    showToast(documentId ? 'Document updated.' : 'Document saved.')
    await loadDocumentsPage()
    await loadDashboard()
  } catch (error) {
    $('#document-save-status').textContent = error instanceof Error ? error.message : 'Unable to save document.'
  } finally {
    submit.disabled = false
  }
})
}

$('#today-date').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
void loadReferences()
renderSettingsPage(settingsPageContext)
refreshProjectSelect()
void loadDashboard()
void loadProjectsPage().then(restoreLocalDraft)
