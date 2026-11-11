import './style.css'

export const settingsPage = (): string => `
<section class="page-content secondary-page" id="settings-page" hidden>
  <div class="welcome-row"><div><p class="date-line">WORKSPACE</p><h1>Settings</h1><p class="page-subtitle">Adjust research workflow preferences and local preferences.</p></div></div>
  <div class="content-card settings-card"><label class="setting-row"><span><strong>Auto-save unsaved drafts on this device</strong><small>Keep a local recovery copy while you write. Use Save document to sync it to the database.</small></span><input type="checkbox" id="setting-auto-save" checked></label><label class="setting-row"><span>Compact workspace layout</span><input type="checkbox" id="setting-compact"></label><div class="settings-actions"><button class="button button-primary" id="save-settings" type="button">Save settings</button></div></div>
</section>`
