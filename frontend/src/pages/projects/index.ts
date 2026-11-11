import './style.css'

export const projectsPage = (icon: (name: string, size?: number) => string): string => `
<section class="page-content secondary-page" id="projects-page" hidden>
  <div class="welcome-row"><div><p class="date-line">RESEARCH WORKSPACE</p><h1>My Projects</h1><p class="page-subtitle">Organize your research questions, milestones, and timelines.</p></div><button class="button button-primary" id="projects-new-button" type="button">${icon('plus', 18)} New research project</button></div>
  <div class="content-card"><div id="all-projects-list" class="project-list"><div class="loading-placeholder">Loading your research projects…</div></div></div>
</section>`
