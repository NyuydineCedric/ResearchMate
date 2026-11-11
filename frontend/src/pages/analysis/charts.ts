import Chart from 'chart.js/auto'

type NumericBin = { start: number; end: number; count: number }
type Distribution = {
  name: string
  kind: 'numeric' | 'categorical'
  histogram?: NumericBin[]
  frequencies?: Array<{ value: string; count: number }>
}

let activeChart: Chart | undefined
let resizeListenerAdded = false

export function renderDatasetChart(canvas: HTMLCanvasElement, variable: Distribution): void {
  activeChart?.destroy()
  if (!resizeListenerAdded) {
    window.addEventListener('resize', () => activeChart?.resize())
    resizeListenerAdded = true
  }
  const numeric = variable.kind === 'numeric'
  const labels = numeric
    ? (variable.histogram ?? []).map((bin) => `${formatBin(bin.start)} – ${formatBin(bin.end)}`)
    : (variable.frequencies ?? []).map((item) => item.value)
  const counts = numeric
    ? (variable.histogram ?? []).map((bin) => bin.count)
    : (variable.frequencies ?? []).map((item) => item.count)

  activeChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: numeric ? 'Observations' : 'Responses',
        data: counts,
        backgroundColor: numeric ? '#59a88d' : '#dc8d68',
        borderColor: numeric ? '#37866d' : '#bd704c',
        borderWidth: 1,
        borderRadius: 3,
        maxBarThickness: 42,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: { intersect: false },
      },
      scales: {
        x: {
          title: { display: true, text: numeric ? variable.name : 'Category' },
          grid: { display: false },
          ticks: { maxRotation: 0, autoSkip: true },
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Responses' },
          ticks: { precision: 0 },
        },
      },
    },
  })
}

export function destroyDatasetChart(): void {
  activeChart?.destroy()
  activeChart = undefined
}

function formatBin(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)
}
