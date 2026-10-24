param([ValidateRange(1,65535)][int]$Port=8787)
$ErrorActionPreference='Stop'
$identity=[Security.Principal.WindowsIdentity]::GetCurrent()
$principal=[Security.Principal.WindowsPrincipal]::new($identity)
if(-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Diese einzelne Firewallfreigabe benötigt eine Windows-Administratorbestätigung.'}
$wlanAddress=Get-NetIPAddress -InterfaceAlias 'WLAN' -AddressFamily IPv4 | Where-Object {$_.AddressState -eq 'Preferred' -and $_.IPAddress -notlike '169.254.*'} | Select-Object -First 1
if(-not $wlanAddress){throw 'Keine aktive WLAN-Adresse gefunden.'}
$nodePath=(Get-Command node -ErrorAction Stop).Source
$ruleName='Meerzeit-Dashboard-WLAN-TCP-'+$Port
$existing=Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue
if($existing){throw ('Die benannte Regel existiert bereits: '+$ruleName+'. Vor einer Änderung ihren Scope prüfen.')}
New-NetFirewallRule -Name $ruleName -DisplayName ('MEERZEIT Dashboard · WLAN · TCP '+$Port) -Description 'Nur öffentlicher Kreuzfahrt-Datenbestand; nur aktueller WLAN-Adapter und lokales Subnetz.' -Direction Inbound -Action Allow -Enabled True -Protocol TCP -LocalPort $Port -LocalAddress $wlanAddress.IPAddress -RemoteAddress LocalSubnet -InterfaceAlias 'WLAN' -Program $nodePath -Profile Public,Private -EdgeTraversalPolicy Block | Out-Null
Write-Output ('Firewallfreigabe eingerichtet: '+$ruleName)
