import './style.css'

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

type AppSettings = {
  autoSave: boolean
  compactMode: boolean
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

      <section class="page-content" id="dashboard-page">
        <div class="welcome-row">
          <div>
            <p class="date-line" id="today-date"></p>
            <h1>Good to see you.</h1>
            <p class="page-subtitle">Your academic research workspace, ready when you are.</p>
          </div>
          <button class="button button-primary" id="new-project-button" type="button">${icon('plus', 18)} New research project</button>
        </div>

        <div class="summary-grid" id="summary-cards" aria-label="Research workspace summary">
          <article class="summary-card loading-card"><span class="skeleton-line"></span><span class="skeleton-number"></span></article>
          <article class="summary-card loading-card"><span class="skeleton-line"></span><span class="skeleton-number"></span></article>
          <article class="summary-card loading-card"><span class="skeleton-line"></span><span class="skeleton-number"></span></article>
        </div>

        <div class="dashboard-grid">
          <section class="content-card projects-card" id="projects">
            <div class="section-heading">
              <div><span class="section-kicker">YOUR WORK</span><h2>Active projects</h2></div>
              <button class="text-button" type="button" data-open-section="projects">All projects ${icon('arrow', 15)}</button>
            </div>
            <div id="project-list" class="project-list"><div class="loading-placeholder">Loading your research projects…</div></div>
          </section>

          <section class="content-card deadline-card">
            <div class="section-heading">
              <div><span class="section-kicker">STAY ON TRACK</span><h2>Upcoming deadlines</h2></div>
              ${icon('calendar', 18)}
            </div>
            <div id="deadline-list" class="deadline-list"><div class="loading-placeholder">Loading deadlines…</div></div>
          </section>

          <section class="content-card documents-card" id="documents">
            <div class="section-heading">
              <div><span class="section-kicker">RECENTLY UPDATED</span><h2>Recent documents</h2></div>
              <button class="text-button" type="button" data-open-section="editor">Open editor ${icon('arrow', 15)}</button>
            </div>
            <div id="document-list" class="document-list"><div class="loading-placeholder">Loading documents…</div></div>
          </section>

          <section class="content-card quick-card">
            <div class="section-heading">
              <div><span class="section-kicker">PICK UP WHERE YOU LEFT OFF</span><h2>Quick actions</h2></div>
            </div>
            <div class="quick-actions">
              <button type="button" class="quick-action" id="quick-project">
                <span class="quick-icon lavender">${icon('plus', 19)}</span>
                <span><strong>Start a project</strong><small>Set up a research topic</small></span>
                ${icon('arrow', 16)}
              </button>
              <button type="button" class="quick-action" id="quick-document">
                <span class="quick-icon mint">${icon('file', 19)}</span>
                <span><strong>Write a document</strong><small>Save a research draft</small></span>
                ${icon('arrow', 16)}
              </button>
              <button type="button" class="quick-action" id="quick-assistant">
                <span class="quick-icon peach">${icon('assistant', 19)}</span>
                <span><strong>Research planning guidance</strong><small>Use your saved project context</small></span>
                ${icon('arrow', 16)}
              </button>
            </div>
          </section>
        </div>
        <p id="status-message" class="status-message" role="status" aria-live="polite"></p>
      </section>

      <section class="page-content secondary-page" id="projects-page" hidden>
        <div class="welcome-row"><div><p class="date-line">RESEARCH WORKSPACE</p><h1>My Projects</h1><p class="page-subtitle">Organize your research questions, milestones, and timelines.</p></div><button class="button button-primary" id="projects-new-button" type="button">${icon('plus', 18)} New research project</button></div>
        <div class="content-card"><div id="all-projects-list" class="project-list"><div class="loading-placeholder">Loading your research projects…</div></div></div>
      </section>

      <section class="page-content secondary-page" id="assistant-page" hidden>
        <div class="welcome-row"><div><p class="date-line">AI RESEARCH</p><h1>AI Research Assistant</h1><p class="page-subtitle">Ask research questions and continue saved conversations grounded in your workspace.</p></div></div>
        <div class="assistant-layout">
          <div class="content-card assistant-panel">
            <div class="assistant-header"><span class="section-kicker">GEMINI-POWERED</span><h2>Research assistant</h2></div>
            <label for="assistant-conversations">Saved conversations</label>
            <div class="assistant-conversation-controls">
              <select id="assistant-conversations"><option value="">New conversation</option></select>
              <button class="button button-secondary" id="assistant-new-conversation" type="button">${icon('plus', 16)} New</button>
            </div>
            <label for="assistant-project">Use project context</label>
            <select id="assistant-project"><option value="">Workspace documents only</option></select>
            <label for="assistant-prompt">Your message</label>
            <textarea id="assistant-prompt" rows="7" maxlength="4000" placeholder="Ask about methodology, your research question, statistical concepts, or your saved project..."></textarea>
            <p class="assistant-disclosure">AI responses require a Gemini API key configured on the backend. Workspace notes and relevant dataset summaries are shared as context.</p>
            <div class="assistant-actions"><button class="button button-primary" id="assistant-submit" type="button">Send to assistant</button><button class="button button-secondary" id="assistant-clear" type="button">Clear</button></div>
          </div>
          <div class="content-card assistant-panel">
            <div class="assistant-header"><span class="section-kicker">SAVED CHAT</span><h2>Conversation</h2></div>
            <div id="assistant-output" class="assistant-output" aria-live="polite">
              <p class="empty-assistant">Start a conversation to get research guidance. Your messages are saved in this workspace.</p>
            </div>
          </div>
        </div>
      </section>

      <section class="page-content secondary-page" id="analysis-page" hidden>
        <div class="welcome-row"><div><p class="date-line">ANALYSIS</p><h1>Data Analysis</h1><p class="page-subtitle">Analyze an imported CSV or send saved questionnaire responses here for descriptive statistics.</p></div></div>
        <div class="content-card dataset-import-card">
          <div class="section-heading"><div><span class="section-kicker">YOUR DATA</span><h2>Import a dataset</h2></div></div>
          <form id="dataset-form" class="dataset-form">
            <label for="dataset-file">CSV or Excel file (.csv, .xlsx)</label>
            <input id="dataset-file" name="file" type="file" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required>
            <label for="dataset-project">Related research project <span class="optional-label">Optional</span></label>
            <select id="dataset-project" name="projectId"><option value="">No project selected</option></select>
            <div class="form-actions"><span id="dataset-upload-status" role="status" aria-live="polite"></span><button class="button button-primary" type="submit">Import and analyze</button></div>
          </form>
          <p class="dataset-help">CSV only · maximum 800 KB, 10,000 responses, and 100 columns. Data is stored in your local ResearchMate SQLite database.</p>
        </div>
        <div class="content-card dataset-results-card">
          <div class="section-heading"><div><span class="section-kicker">DESCRIPTIVE STATISTICS</span><h2>Saved datasets</h2></div></div>
          <label for="dataset-select">Select dataset</label>
          <select id="dataset-select"><option value="">No datasets imported</option></select>
          <div id="dataset-analysis" class="dataset-analysis"><p class="empty-assistant">Import a CSV file to see row counts, missing values, numeric summaries, and category frequencies.</p></div>
        </div>
      </section>

      <section class="page-content secondary-page" id="references-page" hidden>
        <div class="welcome-row"><div><p class="date-line">LITERATURE</p><h1>Literature & References</h1><p class="page-subtitle">Capture sources, organise citations, and keep your reading notes close to your work.</p></div><div class="reference-page-actions"><button class="button button-secondary" id="export-bibliography" type="button" disabled>Export bibliography</button><button class="button button-primary" id="add-reference-button" type="button">${icon('plus', 18)} Add reference</button></div></div>
        <div class="content-card">
          <form id="reference-form" class="reference-form" hidden>
            <input type="hidden" name="id" id="reference-id">
            <div class="section-heading"><div><span class="section-kicker">SOURCE DETAILS</span><h2 id="reference-form-heading">Add a reference</h2></div></div>
            <div class="reference-form-grid">
              <label>Title<input name="title" required maxlength="300"></label>
              <label>Author(s)<input name="authors" maxlength="500" placeholder="e.g. Smith, J. A.; Doe, M."></label>
              <label>Source type<select name="type"><option value="article">Journal article</option><option value="book">Book</option><option value="chapter">Book chapter</option><option value="thesis">Thesis</option><option value="website">Website</option><option value="other">Other</option></select></label>
              <label>Year<input name="year" maxlength="20" placeholder="e.g. 2024"></label>
              <label class="reference-url-field">URL<input name="url" type="url" maxlength="2000" placeholder="https://"></label>
              <label class="reference-abstract-field">Abstract or reading notes<textarea name="abstract" maxlength="5000" rows="3"></textarea></label>
            </div>
            <p id="reference-form-error" class="form-error" role="alert"></p>
            <div class="form-actions"><button class="button button-secondary" id="cancel-reference" type="button">Cancel</button><button class="button button-primary" type="submit">Save reference</button></div>
          </form>
          <p class="bibliography-disclosure">Citation drafts use only the details you enter. Verify author formatting and add missing publication information before submitting academic work.</p>
          <div id="references-list" class="reference-list"></div>
        </div>
      </section>

      <section class="page-content secondary-page" id="editor-page" hidden>
        <div class="welcome-row"><div><p class="date-line">RESEARCH WORKSPACE</p><h1>Document Editor</h1><p class="page-subtitle">Create and save research notes or academic drafts in your workspace.</p></div></div>
        <form class="content-card editor-form" id="document-form">
          <label for="document-title">Document title</label>
          <input id="document-title" name="title" maxlength="200" required placeholder="e.g. Literature review — research notes">
          <label for="document-project">Related research project <span class="optional-label">Optional</span></label>
          <select id="document-project" name="projectId"><option value="">No project selected</option></select>
          <div class="document-citation-tools">
            <label for="document-reference-select">Insert from saved references<select id="document-reference-select"><option value="">No references saved yet</option></select></label>
            <button class="button button-secondary" id="insert-document-citation" type="button" disabled>Insert citation</button>
            <button class="button button-secondary" id="insert-document-bibliography" type="button" disabled>Insert bibliography</button>
          </div>
          <p class="document-citation-note">Citation text uses the details saved in your reference library. Check the final style and publication details before submission.</p>
          <label for="document-content">Draft content</label>
          <textarea id="document-content" name="content" maxlength="900000" rows="14" placeholder="Start writing your research notes or draft…"></textarea>
          <div class="form-actions"><span id="document-save-status" role="status" aria-live="polite"></span><button class="button button-primary" type="submit">Save document</button></div>
          <input id="document-id" name="id" type="hidden">
          <div class="document-form-actions"><button class="button button-secondary" id="new-document" type="button">New document</button><button class="button button-secondary" id="export-document" type="button">Export as text</button></div>
        </form>
        <div class="content-card editor-recent"><div class="section-heading"><div><span class="section-kicker">YOUR WORK</span><h2>Saved documents</h2></div></div><div id="all-documents-list" class="document-list"></div></div>
      </section>

      <section class="page-content secondary-page" id="questionnaire-page" hidden>
        <div class="welcome-row"><div><p class="date-line">RESEARCH TOOL</p><h1>Questionnaire Builder</h1><p class="page-subtitle">Build and save a questionnaire for one of your research projects.</p></div><button class="button button-primary" id="new-questionnaire" type="button">${icon('plus', 18)} New questionnaire</button></div>
        <div class="content-card">
          <div class="questionnaire-toolbar">
            <label for="questionnaire-select">Saved questionnaires<select id="questionnaire-select"><option value="">Loading questionnaires…</option></select></label>
            <label for="questionnaire-title">Title<input id="questionnaire-title" maxlength="200" placeholder="e.g. Student study habits survey"></label>
            <label for="questionnaire-project">Research project<select id="questionnaire-project"><option value="">No project selected</option></select></label>
          </div>
          <section class="questionnaire-ai-panel" aria-labelledby="questionnaire-ai-heading">
            <div class="questionnaire-ai-heading">
              <span class="section-kicker">AI OPTION</span>
              <h2 id="questionnaire-ai-heading">Generate a questionnaire draft</h2>
              <p>Describe your research topic or objective. Review and edit every question before saving.</p>
            </div>
            <div class="questionnaire-ai-fields">
              <label for="questionnaire-ai-topic">Topic or research objective
                <textarea id="questionnaire-ai-topic" maxlength="1500" rows="3" placeholder="e.g. Explore how study habits relate to university students’ wellbeing"></textarea>
              </label>
              <label for="questionnaire-ai-count">Number of questions
                <select id="questionnaire-ai-count">${[5, 8, 10, 12, 15, 20].map((count) => `<option value="${count}" ${count === 8 ? 'selected' : ''}>${count}</option>`).join('')}</select>
              </label>
              <label for="questionnaire-ai-style">Question type
                <select id="questionnaire-ai-style">
                  <option value="mixed">A mix of question types</option>
                  <option value="text">Short-answer text</option>
                  <option value="multiple-choice">Multiple choice</option>
                  <option value="scale">Likert scale</option>
                </select>
              </label>
              <button class="button button-primary questionnaire-ai-button" id="generate-questionnaire" type="button">${icon('assistant', 17)} Generate questions with AI</button>
            </div>
            <p class="questionnaire-ai-note">The generated draft is not saved until you choose Save questionnaire.</p>
            <span id="questionnaire-ai-status" role="status" aria-live="polite"></span>
          </section>
          <div class="questionnaire-manual-heading">
            <h2>Build manually</h2>
            <p>Add and edit questions yourself below, or adjust an AI-generated draft.</p>
          </div>
          <div id="questionnaire-list" class="questionnaire-list"></div>
          <div class="questionnaire-actions"><span id="questionnaire-status" role="status" aria-live="polite"></span><button class="button button-secondary" id="add-question-button" type="button">${icon('plus', 17)} Add question</button><button class="button button-secondary" id="delete-questionnaire" type="button" disabled>Delete</button><button class="button button-secondary" id="export-questionnaire" type="button">Export JSON</button><button class="button button-primary" id="save-questionnaire" type="button">Save questionnaire</button></div>
        </div>
        <div class="content-card questionnaire-response-panel" id="questionnaire-response-panel" hidden>
          <div class="section-heading">
            <div><span class="section-kicker">COLLECT RESPONSES</span><h2>Questionnaire responses</h2></div>
            <span class="response-count" id="questionnaire-response-count">0 responses</span>
          </div>
          <p class="response-disclosure">Responses are saved in this local ResearchMate database. This does not publish a public survey link.</p>
          <div class="questionnaire-response-actions">
            <button class="button button-secondary" id="preview-questionnaire" type="button">Preview &amp; submit response</button>
            <button class="button button-secondary" id="export-questionnaire-responses" type="button" disabled>Export responses CSV</button>
            <button class="button button-primary" id="analyze-questionnaire-responses" type="button" disabled>Analyze responses</button>
          </div>
          <p id="questionnaire-response-status" class="response-status" role="status" aria-live="polite"></p>
          <div id="questionnaire-preview" class="questionnaire-preview" hidden></div>
          <div id="questionnaire-responses-list" class="questionnaire-responses-list"></div>
        </div>
      </section>

      <section class="page-content secondary-page" id="settings-page" hidden>
        <div class="welcome-row"><div><p class="date-line">WORKSPACE</p><h1>Settings</h1><p class="page-subtitle">Adjust research workflow preferences and local preferences.</p></div></div>
        <div class="content-card settings-card">
          <label class="setting-row"><span><strong>Auto-save unsaved drafts on this device</strong><small>Keep a local recovery copy while you write. Use Save document to sync it to the database.</small></span><input type="checkbox" id="setting-auto-save" checked></label>
          <label class="setting-row"><span>Compact workspace layout</span><input type="checkbox" id="setting-compact"></label>
          <div class="settings-actions"><button class="button button-primary" id="save-settings" type="button">Save settings</button></div>
        </div>
      </section>
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
        navigate('editor')
        void projectsLoadPromise.then(() => fillDocumentEditor(selected))
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

function renderDatasetAnalysis(dataset: DatasetDetail): void {
  const target = $('#dataset-analysis')
  const columns = dataset.columnStats.map((stat) => {
    const details = stat.kind === 'numeric'
      ? `<dl class="stat-grid">
          <div><dt>Count</dt><dd>${stat.count ?? stat.nonMissing}</dd></div>
          <div><dt>Mean</dt><dd>${formatStatistic(stat.mean)}</dd></div>
          <div><dt>Median</dt><dd>${formatStatistic(stat.median)}</dd></div>
          <div><dt>Std. deviation</dt><dd>${formatStatistic(stat.standardDeviation ?? undefined)}</dd></div>
          <div><dt>Variance</dt><dd>${formatStatistic(stat.variance ?? undefined)}</dd></div>
          <div><dt>Q1 / Q3</dt><dd>${formatStatistic(stat.quartiles?.q1)} / ${formatStatistic(stat.quartiles?.q3)}</dd></div>
          <div><dt>Minimum</dt><dd>${formatStatistic(stat.min)}</dd></div>
          <div><dt>Maximum</dt><dd>${formatStatistic(stat.max)}</dd></div>
        </dl>`
      : `<div class="category-summary"><span>${stat.unique ?? 0} distinct value${stat.unique === 1 ? '' : 's'}</span>
          <ul>${(stat.frequencies ?? []).map((item) => `<li><span>${escapeHtml(item.value)}</span><strong>${item.count} (${formatStatistic(item.percentage)}%)</strong></li>`).join('') || '<li>No responses recorded</li>'}</ul>
        </div>`
    return `<article class="column-stat-card">
      <div class="column-stat-heading"><strong>${escapeHtml(stat.name)}</strong><span>${stat.kind === 'numeric' ? 'Numeric' : 'Categorical'}</span></div>
      <p>${stat.nonMissing} ${stat.nonMissing === 1 ? 'response' : 'responses'} · ${stat.missing} missing</p>
      ${details}
    </article>`
  }).join('')
  target.innerHTML = `
    <div class="dataset-overview">
      <div><span>File</span><strong>${escapeHtml(dataset.sourceName)}</strong></div>
      <div><span>Responses</span><strong>${dataset.rowCount}</strong></div>
      <div><span>Variables</span><strong>${dataset.columnCount}</strong></div>
      <div><span>Duplicate rows</span><strong>${dataset.duplicateRows}</strong></div>
      <div><span>Project</span><strong>${escapeHtml(dataset.projectTitle || 'Unlinked')}</strong></div>
      ${dataset.questionnaireId ? '<div><span>Source</span><strong>Saved questionnaire responses</strong></div>' : ''}
    </div>
    <section class="dataset-quality">
      <h3>Data quality</h3>
      <ul>${dataset.qualityWarnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('')}</ul>
    </section>
    <section class="dataset-preview">
      <h3>Sample rows <span class="optional-label">First ${dataset.sampleRows.length} of ${dataset.rowCount}</span></h3>
      <div class="dataset-table-wrap"><table><thead><tr>${dataset.columns.map((column) => `<th scope="col">${escapeHtml(column)}</th>`).join('')}</tr></thead>
        <tbody>${dataset.sampleRows.map((row) => `<tr>${dataset.columns.map((column) => `<td>${escapeHtml(row[column] ?? '—')}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>
    </section>
    <div class="column-stat-grid">${columns}</div>
  `
}

async function loadDatasetDetail(datasetId: number): Promise<void> {
  const target = $('#dataset-analysis')
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

function navigate(section: string, datasetId?: number): void {
  document.querySelectorAll<HTMLElement>('.page-content').forEach((page) => { page.hidden = true })
  const page = $<HTMLElement>(`#${section}-page`)
  page.hidden = false
  const item = navItems.find((navItem) => navItem.section === section)
  $('#breadcrumb-current').textContent = item?.label ?? 'Dashboard'
  document.querySelectorAll('.nav-link').forEach((link) => link.classList.toggle('active', link.getAttribute('data-section') === section))
  if (section === 'projects') projectsLoadPromise = loadProjectsPage()
  if (section === 'editor') {
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
  if (section === 'settings') renderSettings()
  window.scrollTo({ top: 0, behavior: 'smooth' })
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

const renderSettings = (): void => {
  const settings = readStoredValue<AppSettings>(STORAGE_KEYS.settings, defaultSettings)
  const autoSave = document.querySelector<HTMLInputElement>('#setting-auto-save')
  const compact = document.querySelector<HTMLInputElement>('#setting-compact')
  if (autoSave) autoSave.checked = settings.autoSave
  if (compact) compact.checked = settings.compactMode
  document.body.classList.toggle('compact-layout', settings.compactMode)
}

const saveSettings = (): void => {
  const settings: AppSettings = {
    autoSave: document.querySelector<HTMLInputElement>('#setting-auto-save')?.checked ?? true,
    compactMode: document.querySelector<HTMLInputElement>('#setting-compact')?.checked ?? false
  }
  writeStoredValue(STORAGE_KEYS.settings, settings)
  document.body.classList.toggle('compact-layout', settings.compactMode)
  showToast('Settings saved.')
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
  link.click()
  URL.revokeObjectURL(url)
}

async function readCsvFile(file: File): Promise<string> {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer())
  } catch {
    throw new Error('CSV files must use valid UTF-8 encoding. Re-save the file as UTF-8 and retry.')
  }
}

function insertAtDocumentCursor(text: string, inline = false): void {
  const editor = $<HTMLTextAreaElement>('#document-content')
  const start = editor.selectionStart
  const end = editor.selectionEnd
  let insertion = text
  if (inline) {
    const previousCharacter = editor.value[start - 1] ?? ''
    const nextCharacter = editor.value[end] ?? ''
    if (previousCharacter && !/\s/.test(previousCharacter)) insertion = ` ${insertion}`
    if (nextCharacter && !/\s/.test(nextCharacter)) insertion = `${insertion} `
  }
  editor.setRangeText(insertion, start, end, 'end')
  editor.focus()
  editor.dispatchEvent(new Event('input', { bubbles: true }))
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
  $<HTMLTextAreaElement>('#document-content').value = savedDocument.content
  $('#document-save-status').textContent = `Editing saved document · ${relativeDate(savedDocument.updatedAt)}`
  $('#document-title').focus()
}

function saveLocalDraft(): void {
  const settings = readStoredValue<AppSettings>(STORAGE_KEYS.settings, defaultSettings)
  if (!settings.autoSave) return
  const title = $<HTMLInputElement>('#document-title').value
  const content = $<HTMLTextAreaElement>('#document-content').value
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
  const draft = readStoredValue<LocalDraft | null>(STORAGE_KEYS.localDraft, null)
  if (!draft) return
  $<HTMLInputElement>('#document-title').value = draft.title
  $<HTMLTextAreaElement>('#document-content').value = draft.content
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
  $('#document-save-status').textContent = 'New draft'
}

function exportDocument(): void {
  const title = $<HTMLInputElement>('#document-title').value.trim()
  if (!title) {
    showToast('Add a document title before exporting.', true)
    return
  }
  const content = $<HTMLTextAreaElement>('#document-content').value
  const filename = `${title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').slice(0, 100) || 'research-draft'}.txt`
  downloadFile(filename, content, 'text/plain')
  showToast('Document exported as a text file.')
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

$('#new-project-button').addEventListener('click', openProjectDialog)
$('#projects-new-button').addEventListener('click', openProjectDialog)
$('#quick-project').addEventListener('click', openProjectDialog)
$('#quick-document').addEventListener('click', () => navigate('editor'))
$('#quick-assistant').addEventListener('click', () => navigate('assistant'))
$('#assistant-submit').addEventListener('click', () => void generateAssistantAdvice())
$('#assistant-clear').addEventListener('click', () => {
  $<HTMLTextAreaElement>('#assistant-prompt').value = ''
})
$('#assistant-new-conversation').addEventListener('click', () => {
  activeAssistantConversationId = null
  assistantMessages = []
  $<HTMLSelectElement>('#assistant-conversations').value = ''
  $<HTMLSelectElement>('#assistant-project').disabled = false
  renderAssistantMessages()
})
$('#assistant-conversations').addEventListener('change', () => {
  const conversationId = Number($<HTMLSelectElement>('#assistant-conversations').value)
  if (Number.isInteger(conversationId) && conversationId > 0) {
    void openAssistantConversation(conversationId)
    return
  }
  activeAssistantConversationId = null
  assistantMessages = []
  $<HTMLSelectElement>('#assistant-project').disabled = false
  renderAssistantMessages()
})
$('#add-reference-button').addEventListener('click', () => openReferenceForm())
$('#export-bibliography').addEventListener('click', exportBibliography)
$('#cancel-reference').addEventListener('click', () => {
  const form = $<HTMLFormElement>('#reference-form')
  form.reset()
  form.hidden = true
})
$('#new-questionnaire').addEventListener('click', startQuestionnaire)
$('#questionnaire-select').addEventListener('change', () => {
  const questionnaireId = Number(($<HTMLSelectElement>('#questionnaire-select')).value)
  if (!Number.isInteger(questionnaireId) || questionnaireId < 1) {
    selectQuestionnaire(null)
    return
  }
  const selected = questionnaires.find((item) => item.id === questionnaireId)
  if (selected) {
    selectQuestionnaire(selected)
    void loadQuestionnaireResponses(selected.id)
  }
})
$('#add-question-button').addEventListener('click', addQuestion)
$('#generate-questionnaire').addEventListener('click', () => void generateQuestionnaire())
$('#save-questionnaire').addEventListener('click', () => void saveQuestionnaire())
$('#delete-questionnaire').addEventListener('click', () => void deleteQuestionnaire())
$('#export-questionnaire').addEventListener('click', exportQuestionnaire)
$('#preview-questionnaire').addEventListener('click', previewQuestionnaire)
$('#export-questionnaire-responses').addEventListener('click', exportQuestionnaireResponses)
$('#analyze-questionnaire-responses').addEventListener('click', () => void analyzeQuestionnaireResponses())
$('#questionnaire-preview').addEventListener('submit', (event) => {
  const form = event.target
  if (!(form instanceof HTMLFormElement) || form.id !== 'questionnaire-response-form') return
  event.preventDefault()
  void submitQuestionnaireResponse(form)
})
$('#save-settings').addEventListener('click', saveSettings)
$('#new-document').addEventListener('click', startNewDocument)
$('#export-document').addEventListener('click', exportDocument)
$<HTMLSelectElement>('#document-reference-select').addEventListener('change', renderDocumentReferenceSelect)
$('#insert-document-citation').addEventListener('click', insertDocumentCitation)
$('#insert-document-bibliography').addEventListener('click', insertDocumentBibliography)
let localDraftTimer: number | undefined
const localDraftFields = ['#document-title', '#document-content']
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
$('#close-project-dialog').addEventListener('click', () => $<HTMLDialogElement>('#project-dialog').close())
$('#cancel-project').addEventListener('click', () => $<HTMLDialogElement>('#project-dialog').close())
$<HTMLDialogElement>('#project-dialog').addEventListener('click', (event) => {
  if (event.target === $<HTMLDialogElement>('#project-dialog')) $<HTMLDialogElement>('#project-dialog').close()
})

$('#dataset-select').addEventListener('change', () => {
  const datasetId = Number(($<HTMLSelectElement>('#dataset-select')).value)
  if (Number.isInteger(datasetId) && datasetId > 0) void loadDatasetDetail(datasetId)
})

$('#dataset-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  const form = event.currentTarget as HTMLFormElement
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!
  const file = ($<HTMLInputElement>('#dataset-file')).files?.[0]
  const status = $('#dataset-upload-status')
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
    const projectValue = ($<HTMLSelectElement>('#dataset-project')).value
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
    const csv = extension === 'csv' ? await readCsvFile(file) : undefined
    const result = await request<{ dataset: DatasetDetail }>('/api/datasets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceName: file.name,
        ...(extension === 'csv' ? { csv } : { workbookBase64 }),
        projectId: projectValue ? Number(projectValue) : null
      })
    })
    status.textContent = `Imported ${result.dataset.rowCount} responses and ${result.dataset.columnCount} variables.`
    showToast('Dataset imported and analyzed.')
    form.reset()
    refreshProjectSelect()
    await loadDatasetsPage(result.dataset.id)
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Unable to import this CSV file.'
  } finally {
    submit.disabled = false
  }
})

$('#reference-form').addEventListener('submit', async (event) => {
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
})

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

$('#document-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  const form = event.currentTarget as HTMLFormElement
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!
  const fields = new FormData(form)
  const projectValue = String(fields.get('projectId') ?? '')
  const payload = {
    title: String(fields.get('title') ?? ''),
    content: String(fields.get('content') ?? ''),
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

$('#today-date').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
void loadReferences()
renderSettings()
refreshProjectSelect()
void loadDashboard()
void loadProjectsPage().then(restoreLocalDraft)
