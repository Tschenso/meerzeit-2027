param([ValidateRange(1,65535)][int]$Port=8787)
$ErrorActionPreference='Stop'
$projectRoot=$PSScriptRoot
$wlanAddress=Get-NetIPAddress -InterfaceAlias 'WLAN' -AddressFamily IPv4 | Where-Object {$_.AddressState -eq 'Preferred' -and $_.IPAddress -notlike '169.254.*'} | Select-Object -First 1
if(-not $wlanAddress){throw 'Keine aktive IPv4-Adresse am WLAN-Adapter gefunden.'}
$link='http://'+$wlanAddress.IPAddress+':'+$Port+'/#kalender'
$health='http://'+$wlanAddress.IPAddress+':'+$Port+'/healthz'
$existing=$null
try{$existing=Invoke-RestMethod -Uri $health -TimeoutSec 2}catch{}
if($existing.app -eq 'meerzeit-2027'){Write-Output ('Dashboard läuft bereits: '+$link);exit 0}
if(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue){throw ('Port '+$Port+' ist bereits belegt. Kein fremder Prozess wurde verändert.')}
$nodePath=(Get-Command node -ErrorAction Stop).Source
$serverPath=Join-Path $projectRoot 'server.cjs'
$arguments=@('"'+$serverPath+'"','--host',$wlanAddress.IPAddress,'--port',[string]$Port,'--prefix-length',[string]$wlanAddress.PrefixLength)
$serverProcess=Start-Process -FilePath $nodePath -ArgumentList $arguments -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
for($attempt=0;$attempt -lt 20;$attempt++){
  Start-Sleep -Milliseconds 200
  try{$status=Invoke-RestMethod -Uri $health -TimeoutSec 1;if($status.app -eq 'meerzeit-2027'){Write-Output ('Dashboard läuft: '+$link);Write-Output ('Server-PID: '+$serverProcess.Id);exit 0}}catch{}
  if($serverProcess.HasExited){throw 'Der Dashboard-Server konnte nicht gestartet werden.'}
}
throw 'Der Server antwortet noch nicht. Den WLAN-Adapter und die Portbelegung prüfen.'
