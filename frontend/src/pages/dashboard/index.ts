import './style.css'

export const dashboardPage = (icon: (name: string, size?: number) => string): string => `
<section class="page-content" id="dashboard-page">
  <div class="welcome-row"><div><p class="date-line" id="today-date"></p><h1>Good to see you.</h1><p class="page-subtitle">Your academic research workspace, ready when you are.</p></div><button class="button button-primary" id="new-project-button" type="button">${icon('plus', 18)} New research project</button></div>
  <div class="summary-grid" id="summary-cards" aria-label="Research workspace summary"><article class="summary-card loading-card"><span class="skeleton-line"></span><span class="skeleton-number"></span></article><article class="summary-card loading-card"><span class="skeleton-line"></span><span class="skeleton-number"></span></article><article class="summary-card loading-card"><span class="skeleton-line"></span><span class="skeleton-number"></span></article></div>
  <div class="dashboard-grid">
    <section class="content-card projects-card" id="projects"><div class="section-heading"><div><span class="section-kicker">YOUR WORK</span><h2>Active projects</h2></div><button class="text-button" type="button" data-open-section="projects">All projects ${icon('arrow', 15)}</button></div><div id="project-list" class="project-list"><div class="loading-placeholder">Loading your research projects…</div></div></section>
    <section class="content-card deadline-card"><div class="section-heading"><div><span class="section-kicker">STAY ON TRACK</span><h2>Upcoming deadlines</h2></div>${icon('calendar', 18)}</div><div id="deadline-list" class="deadline-list"><div class="loading-placeholder">Loading deadlines…</div></div></section>
    <section class="content-card documents-card" id="documents"><div class="section-heading"><div><span class="section-kicker">RECENTLY UPDATED</span><h2>Recent documents</h2></div><button class="text-button" type="button" data-open-section="editor">Open editor ${icon('arrow', 15)}</button></div><div id="document-list" class="document-list"><div class="loading-placeholder">Loading documents…</div></div></section>
    <section class="content-card quick-card"><div class="section-heading"><div><span class="section-kicker">PICK UP WHERE YOU LEFT OFF</span><h2>Quick actions</h2></div></div><div class="quick-actions">
      <button type="button" class="quick-action" id="quick-project"><span class="quick-icon lavender">${icon('plus', 19)}</span><span><strong>Start a project</strong><small>Set up a research topic</small></span>${icon('arrow', 16)}</button>
      <button type="button" class="quick-action" id="quick-document"><span class="quick-icon mint">${icon('file', 19)}</span><span><strong>Write a document</strong><small>Save a research draft</small></span>${icon('arrow', 16)}</button>
      <button type="button" class="quick-action" id="quick-assistant"><span class="quick-icon peach">${icon('assistant', 19)}</span><span><strong>Research planning guidance</strong><small>Use your saved project context</small></span>${icon('arrow', 16)}</button>
    </div></section>
  </div><p id="status-message" class="status-message" role="status" aria-live="polite"></p>
</section>`
