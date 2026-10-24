[CmdletBinding()]
param([switch]$OhnePreisabruf)
$ErrorActionPreference='Stop'
# Manueller Aufruf: Preise abrufen, prüfen, versionieren und Pages aktualisieren.
# Keine Zugangsdaten im Skript; die Wochenplanung erfolgt separat in Codex.
function Invoke-Checked {
  param([string]$Command,[string[]]$Arguments)
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Command ist mit Code $LASTEXITCODE fehlgeschlagen." }
}
Push-Location -LiteralPath $PSScriptRoot
try {
  foreach ($command in @('git','node','gh')) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) { throw "$command fehlt. Bitte Git, Node.js 22+ und GitHub CLI installieren." }
  }
  $nodeMajor=(& node -p 'process.versions.node.split(".")[0]')
  if ([int]$nodeMajor -lt 22) { throw 'Node.js 22 oder neuer ist erforderlich.' }
  $repoRoot=(& git rev-parse --show-toplevel)
  if ($LASTEXITCODE -ne 0 -or [IO.Path]::GetFullPath($repoRoot) -ne [IO.Path]::GetFullPath($PSScriptRoot)) { throw 'Das Skript muss im ursprünglichen Dashboard-Repository liegen.' }
  $branch=(& git branch --show-current)
  if ($branch -ne 'main') { throw 'Zum Veröffentlichen bitte den Branch main verwenden.' }
  $remote=(& git remote get-url origin)
  if ($remote -ne 'https://github.com/Tschenso/meerzeit-2027.git') { throw 'Unerwartetes GitHub-Ziel. Es wurde nichts geändert.' }
  $dirty=@(& git status --porcelain)
  if ($LASTEXITCODE -ne 0 -or $dirty.Count -gt 0) { throw 'Es gibt ungesicherte Änderungen. Bitte zuerst prüfen und committen; das Skript übernimmt keine fremden Änderungen.' }
  Invoke-Checked 'gh' @('auth','status','--active')
  Invoke-Checked 'git' @('-c','credential.helper=','-c','credential.helper=!gh auth git-credential','fetch','origin','main')
  & git merge-base --is-ancestor origin/main HEAD
  if ($LASTEXITCODE -ne 0) { throw 'GitHub enthält einen neueren oder abweichenden Stand. Bitte zuerst ohne Überschreiben abgleichen.' }
  if (-not $OhnePreisabruf) {
    Write-Host 'Preise werden aus den öffentlichen Quellen abgerufen. Das kann mehrere Minuten dauern.'
    Invoke-Checked 'node' @('scripts/preise-aktualisieren.cjs')
  }
  Invoke-Checked 'node' @('pruefen.cjs')
  Invoke-Checked 'node' @('scripts/preise-pruefen.cjs')
  Invoke-Checked 'git' @('add','--','data.js','mein-schiff.js')
  & git diff --cached --quiet
  $difference=$LASTEXITCODE
  if ($difference -eq 1) { Invoke-Checked 'git' @('commit','-m','Update cruise prices and price history') }
  elseif ($difference -ne 0) { throw 'Git-Änderungen konnten nicht geprüft werden.' }
  Invoke-Checked 'git' @('-c','credential.helper=','-c','credential.helper=!gh auth git-credential','push','origin','main')
  Write-Host 'Upload abgeschlossen. GitHub Pages veröffentlicht nach erfolgreicher Prüfung:'
  Write-Host 'https://tschenso.github.io/meerzeit-2027/'
  Write-Host 'Status: https://github.com/Tschenso/meerzeit-2027/actions/workflows/pages.yml'
} finally { Pop-Location }
