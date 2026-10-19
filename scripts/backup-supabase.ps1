param(
  [string]$OutputRoot = (Join-Path (Get-Location) 'backups\manual'),
  [switch]$KeepUnencrypted
)

$ErrorActionPreference = 'Stop'

if (-not $env:SUPABASE_DB_URL) {
  throw 'Defina a variável de ambiente SUPABASE_DB_URL com a string de conexão direta do Postgres.'
}

if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
  throw 'A Supabase CLI não foi encontrada no PATH. Instale uma versão fixa antes de executar este script.'
}

$backupId = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$backupDir = Join-Path $OutputRoot $backupId
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

try {
  & supabase db dump --db-url $env:SUPABASE_DB_URL --role-only --file (Join-Path $backupDir 'roles.sql')
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar o dump de roles.' }

  & supabase db dump --db-url $env:SUPABASE_DB_URL --file (Join-Path $backupDir 'schema.sql')
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar o dump do schema.' }

  & supabase db dump --db-url $env:SUPABASE_DB_URL --data-only --use-copy --file (Join-Path $backupDir 'data.sql')
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar o dump dos dados.' }

  $archive = Join-Path $OutputRoot ("supabase-$backupId.zip")
  Compress-Archive -Path (Join-Path $backupDir '*') -DestinationPath $archive -CompressionLevel Optimal -Force

  $hash = Get-FileHash -Algorithm SHA256 -Path $archive
  "$($hash.Hash)  $([IO.Path]::GetFileName($archive))" | Set-Content -Encoding ASCII ("$archive.sha256")

  if (-not $KeepUnencrypted) {
    Remove-Item -LiteralPath $backupDir -Recurse -Force
  }

  Write-Output "Backup criado: $archive"
  Write-Output "Checksum criado: $archive.sha256"
  if (-not $KeepUnencrypted) {
    Write-Warning 'O ZIP local não está criptografado. Proteja-o ou remova-o após enviá-lo para um armazenamento seguro.'
  }
}
catch {
  if (Test-Path -LiteralPath $backupDir) {
    Remove-Item -LiteralPath $backupDir -Recurse -Force
  }
  throw
}
