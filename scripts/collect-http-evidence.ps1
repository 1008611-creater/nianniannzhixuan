param(
  [string]$EntryPoint = "https://dh.cauai.fun/workspace",
  [string]$MediaPath = "",
  [string]$NetworkLabel = "local",
  [string]$OutputFile = ""
)

$ErrorActionPreference = "Stop"

function Get-RedactedUri([string]$Value) {
  $uri = [Uri]$Value
  if ($uri.Scheme -notin @("http", "https")) { throw "Only HTTP(S) URLs are supported." }
  $builder = [UriBuilder]::new($uri)
  $builder.Query = ""
  $builder.Fragment = ""
  return $builder.Uri
}

function Get-HeaderValue($Headers, [string]$Name) {
  $values = $null
  if ($Headers.TryGetValues($Name, [ref]$values)) { return ($values -join ",") }
  return $null
}

function Measure-Headers([Uri]$Uri, [bool]$UseRange) {
  $handler = [System.Net.Http.HttpClientHandler]::new()
  $handler.UseCookies = $false
  $handler.AllowAutoRedirect = $false
  $client = [System.Net.Http.HttpClient]::new($handler)
  $client.Timeout = [TimeSpan]::FromSeconds(60)
  $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Get, $Uri)
  if ($UseRange) { $request.Headers.Range = [System.Net.Http.Headers.RangeHeaderValue]::Parse("bytes=0-0") }
  $timer = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $response = $client.Send($request, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead)
    $timer.Stop()
    $contentLength = $response.Content.Headers.ContentLength
    [pscustomobject]@{
      status = [int]$response.StatusCode
      elapsedMs = [int][Math]::Round($timer.Elapsed.TotalMilliseconds)
      bytes = if ($contentLength) { [int64]$contentLength } else { 0 }
      contentType = $response.Content.Headers.ContentType.MediaType
      contentLength = $contentLength
      acceptRanges = ((Get-HeaderValue $response.Headers "accept-ranges") -match "bytes")
      cacheStatus = (Get-HeaderValue $response.Headers "cf-cache-status")
      ageSeconds = (Get-HeaderValue $response.Headers "age")
    }
    $response.Dispose()
  } finally {
    $request.Dispose()
    $client.Dispose()
    $handler.Dispose()
  }
}

$entryUri = Get-RedactedUri $EntryPoint
$entry = Measure-Headers $entryUri $false
$mediaUri = if ($MediaPath) { Get-RedactedUri $MediaPath } else { $null }
$media = if ($mediaUri) { Measure-Headers $mediaUri $false } else { $null }
$range = if ($mediaUri) { Measure-Headers $mediaUri $true } else { $null }

$authorizationCheck = if (-not $media) { "not-measured" }
elseif ($media.status -in @(401, 403)) { "unsigned-rejected" }
else { "unknown" }

$record = [ordered]@{
  capturedAt = [DateTime]::UtcNow.ToString("o")
  entrypoint = $entryUri.GetLeftPart([UriPartial]::Path)
  mediaPath = if ($mediaUri) { $mediaUri.GetLeftPart([UriPartial]::Path) } else { $null }
  networkLabel = $NetworkLabel
  edgeColo = "unknown"
  status = $entry.status
  rangeStatus = if ($range) { $range.status } else { $null }
  dnsMs = $null
  connectMs = $null
  tlsMs = $null
  ttfbMs = $entry.elapsedMs
  totalMs = $entry.elapsedMs
  bytes = $entry.bytes
  contentType = $media.contentType
  contentLength = $media.contentLength
  originalBytes = $null
  playbackBytes = $null
  originalBitrateKbps = $null
  playbackBitrateKbps = $null
  playbackVariantReadyWithinSeconds = $null
  acceptRanges = if ($media) { $media.acceptRanges } else { $null }
  cacheStatus = if ($media.cacheStatus) { $media.cacheStatus } else { "unknown" }
  ageSeconds = $media.ageSeconds
  variant = if ($media) { "unknown" } else { $null }
  authorizationCheck = $authorizationCheck
  browserEvidence = [ordered]@{
    imageNaturalWidth = $null
    videoReadyState = $null
    playbackAdvanced = $null
    seekSucceeded = $null
    downloadSucceeded = $null
  }
}

$json = $record | ConvertTo-Json -Depth 4
if ($OutputFile) {
  $target = if ([IO.Path]::IsPathRooted($OutputFile)) { $OutputFile } else { Join-Path (Get-Location) $OutputFile }
  $directory = Split-Path -Parent $target
  if ($directory) { [IO.Directory]::CreateDirectory($directory) | Out-Null }
  [IO.File]::WriteAllText($target, $json + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
}

$json
