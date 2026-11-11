import './style.css'

export const analysisPage = (): string => `
<section class="page-content secondary-page" id="analysis-page" hidden>
  <header class="analysis-header"><div><p class="date-line">RESEARCH DATA</p><h1>Data Analysis</h1><p class="page-subtitle">Explore distributions, variable summaries, and data quality.</p></div></header>
  <div class="analysis-toolbar">
    <label for="dataset-select">Dataset<select id="dataset-select"><option value="">No datasets imported</option></select></label>
    <div class="analysis-toolbar-actions"><button class="button button-secondary" id="export-analysis-csv" type="button" disabled>Export analysis CSV</button><button class="button button-primary" id="open-dataset-import" type="button">Import dataset</button></div>
  </div>
  <section class="analysis-import-panel" id="dataset-import-panel" hidden>
    <div class="analysis-import-heading"><div><span class="section-kicker">ADD DATA</span><h2>Import a dataset</h2></div><button class="button button-secondary" id="close-dataset-import" type="button">Close</button></div>
    <form id="dataset-form" class="dataset-form"><label for="dataset-file">CSV or Excel file (.csv, .xlsx)</label><input id="dataset-file" name="file" type="file" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required><label for="dataset-project">Related research project <span class="optional-label">Optional</span></label><select id="dataset-project" name="projectId"><option value="">No project selected</option></select><div class="form-actions"><span id="dataset-upload-status" role="status" aria-live="polite"></span><button class="button button-primary" type="submit">Import and analyze</button></div></form>
    <p class="dataset-help">CSV or XLSX · maximum 800 KB, 10,000 rows, and 100 columns. Data is stored in your local ResearchMate database.</p>
  </section>
  <div id="dataset-analysis" class="dataset-analysis" aria-live="polite"><p class="empty-assistant">Import a dataset or select one from the list to begin.</p></div>
</section>`
