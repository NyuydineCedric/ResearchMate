$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$python = Join-Path $root '.venv\Scripts\python.exe'
$backendScript = Join-Path $root 'backend\server.py'
$frontendDir = Join-Path $root 'frontend'

if (-not (Test-Path $python)) {
    throw "Python virtual environment not found: $python"
}

& $python -c "import google.genai, dotenv" 2>$null
if ($LASTEXITCODE -ne 0) {
    throw "Backend dependencies are missing. Run '.venv\Scripts\python.exe -m pip install -r requirements.txt' first."
}

if (-not (Test-Path (Join-Path $frontendDir 'node_modules\vite'))) {
    throw "Frontend dependencies are missing. Run 'npm install' in the frontend folder first."
}

$backend = Start-Process -FilePath $python -ArgumentList @("`"$backendScript`"") -WorkingDirectory $root -PassThru -NoNewWindow
try {
    $ready = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        if ($backend.HasExited) {
            throw "Backend exited during startup with code $($backend.ExitCode)."
        }
        try {
            $null = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/health' -TimeoutSec 1
            $ready = $true
            break
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }

    if (-not $ready) {
        throw 'Backend did not become ready at http://127.0.0.1:8000.'
    }

    Write-Host 'ResearchMate AI backend is ready at http://127.0.0.1:8000'
    Write-Host 'Starting ResearchMate AI at http://localhost:5173'
    Write-Host 'Press Ctrl+C to stop the frontend and backend.'
    Push-Location $frontendDir
    try {
        npm run dev
    } finally {
        Pop-Location
    }
} finally {
    if (-not $backend.HasExited) {
        Stop-Process -Id $backend.Id
        Wait-Process -Id $backend.Id -Timeout 5 -ErrorAction SilentlyContinue
    }
}
