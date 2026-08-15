$ErrorActionPreference = 'Stop'

if ((Test-NetConnection -ComputerName 127.0.0.1 -Port 14321 -InformationLevel Quiet)) {
  Write-Output 'Agent Vault tunnel is already listening on http://127.0.0.1:14321'
  exit 0
}

$sshArguments = @(
  '-N',
  '-o', 'ExitOnForwardFailure=yes',
  '-o', 'ServerAliveInterval=30',
  '-L', '127.0.0.1:14321:127.0.0.1:14321',
  '-L', '127.0.0.1:14322:127.0.0.1:14322',
  'haika-kidswear-1757'
)

Start-Process -FilePath 'ssh.exe' -ArgumentList $sshArguments -WindowStyle Hidden
Start-Sleep -Seconds 2

if (-not (Test-NetConnection -ComputerName 127.0.0.1 -Port 14321 -InformationLevel Quiet)) {
  throw 'Agent Vault tunnel did not start. Check the SSH alias haika-kidswear-1757.'
}

Write-Output 'Agent Vault tunnel started at http://127.0.0.1:14321'
