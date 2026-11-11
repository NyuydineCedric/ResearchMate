export function bindProjectsPage(onNewProject: () => void): void {
  document.querySelector('#projects-new-button')?.addEventListener('click', onNewProject)
}
