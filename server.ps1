$OpenBrowser = $false
if ($args -contains "-OpenBrowser") {
  $OpenBrowser = $true
}

$ErrorActionPreference = "Stop"

$Port = 4173
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"), $Port)

$ContentTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".js" = "text/javascript; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".sql" = "text/plain; charset=utf-8"
  ".md" = "text/markdown; charset=utf-8"
}

function Send-Response {
  param(
    [System.Net.Sockets.NetworkStream] $Stream,
    [int] $StatusCode,
    [string] $StatusText,
    [string] $ContentType,
    [byte[]] $Body
  )

  $Header = "HTTP/1.1 $StatusCode $StatusText`r`nContent-Type: $ContentType`r`nContent-Length: $($Body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
  $HeaderBytes = [System.Text.Encoding]::ASCII.GetBytes($Header)
  $Stream.Write($HeaderBytes, 0, $HeaderBytes.Length)
  if ($Body.Length -gt 0) {
    $Stream.Write($Body, 0, $Body.Length)
  }
}

try {
  $Listener.Start()
  Write-Host "Footprint map is running: http://127.0.0.1:$Port"
  Write-Host "Keep this window open while using the site."
  if ($OpenBrowser) {
    Start-Process "http://127.0.0.1:$Port" | Out-Null
  }

  while ($true) {
    $Client = $Listener.AcceptTcpClient()
    try {
      $Stream = $Client.GetStream()
      $Reader = [System.IO.StreamReader]::new($Stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
      $RequestLine = $Reader.ReadLine()
      if ([string]::IsNullOrWhiteSpace($RequestLine)) {
        $Client.Close()
        continue
      }

      $Parts = $RequestLine.Split(" ")
      $Path = [System.Uri]::UnescapeDataString($Parts[1].Split("?")[0])
      if ($Path -eq "/" -or $Path -eq "/admin") {
        $Path = "/index.html"
      }

      $RelativePath = $Path.TrimStart("/") -replace "/", [System.IO.Path]::DirectorySeparatorChar
      $FilePath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($Root, $RelativePath))

      if (-not $FilePath.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase)) {
        $Body = [System.Text.Encoding]::UTF8.GetBytes("Forbidden")
        Send-Response $Stream 403 "Forbidden" "text/plain; charset=utf-8" $Body
      } elseif (-not (Test-Path -LiteralPath $FilePath -PathType Leaf)) {
        $Body = [System.Text.Encoding]::UTF8.GetBytes("Not found")
        Send-Response $Stream 404 "Not Found" "text/plain; charset=utf-8" $Body
      } else {
        $Extension = [System.IO.Path]::GetExtension($FilePath)
        $ContentType = if ($ContentTypes.ContainsKey($Extension)) { $ContentTypes[$Extension] } else { "application/octet-stream" }
        $Body = [System.IO.File]::ReadAllBytes($FilePath)
        Send-Response $Stream 200 "OK" $ContentType $Body
      }
    } catch {
      $Body = [System.Text.Encoding]::UTF8.GetBytes($_.Exception.Message)
      Send-Response $Stream 500 "Internal Server Error" "text/plain; charset=utf-8" $Body
    } finally {
      $Client.Close()
    }
  }
} finally {
  $Listener.Stop()
}
