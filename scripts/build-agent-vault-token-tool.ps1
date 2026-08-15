$ErrorActionPreference = 'Stop'
$project = Join-Path $PSScriptRoot 'agent-vault-token-tool\AgentVaultTokenTool.csproj'
$output = Join-Path $PSScriptRoot 'agent-vault-token-tool\publish'
& dotnet publish $project -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true -o $output
if ($LASTEXITCODE -ne 0) {
  throw "Build failed with exit code $LASTEXITCODE"
}
$tool = Join-Path $output 'AgentVaultTokenTool.exe'
$report = Join-Path $env:TEMP 'agent-vault-token-tool-self-test.txt'
Remove-Item -LiteralPath $report -ErrorAction SilentlyContinue
$process = Start-Process -FilePath $tool -ArgumentList @('--self-test', '--report', $report) -PassThru -Wait
if ($process.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $report) -or (Get-Content -Raw $report).Trim() -ne 'pass') {
  throw 'Agent Vault token tool self-test failed.'
}
Remove-Item -LiteralPath $report -Force
Start-Process -FilePath $tool
