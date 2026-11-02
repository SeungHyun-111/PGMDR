$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
try {
  $payload = [Console]::In.ReadToEnd() | ConvertFrom-Json
  try {
    $outlook = [Runtime.InteropServices.Marshal]::GetActiveObject('Outlook.Application')
  } catch {
    $outlook = New-Object -ComObject Outlook.Application
  }
  $mail = $outlook.CreateItem(0)
  $mail.BodyFormat = 2
  $mail.Subject = [string]$payload.subject
  $mail.HTMLBody = [string]$payload.html
  foreach ($name in $payload.recipients) {
    $recipient = $mail.Recipients.Add([string]$name)
    $recipient.Type = 1
  }
  $resolved = $mail.Recipients.ResolveAll()
  $unresolved = @()
  if (-not $resolved) {
    foreach ($recipient in $mail.Recipients) {
      if (-not $recipient.Resolved) { $unresolved += $recipient.Name }
    }
  }
  $mail.Display($false)
  $mail.GetInspector().Activate()
  [Console]::WriteLine((@{ ok = $true; unresolved = @($unresolved) } | ConvertTo-Json -Compress))
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
}
