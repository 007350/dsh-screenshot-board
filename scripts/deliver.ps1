param([string]$Target = 'D:\dsh-screenshot-board')
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$sourceRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path.TrimEnd('\')
$targetRoot = (Resolve-Path -LiteralPath $Target).Path.TrimEnd('\')
if ($sourceRoot -ne 'D:\plugin\dsh-screenshot-board' -or $targetRoot -ne 'D:\dsh-screenshot-board') {
  throw '交付只允许从已验证工作副本同步到用户指定原项目。'
}
$baseline = Get-Content -LiteralPath (Join-Path $sourceRoot 'delivery-baseline.json') -Raw | ConvertFrom-Json -AsHashtable
$projectDirs = @('src','scripts','tests','docs','locale','lib')
$rootFiles = @('package.json','cordis.patch.yml','icon.svg','LICENSE','README.md','IMPLEMENTATION_PLAN.md','.gitignore')
$sourceFiles = @()
foreach ($projectDir in $projectDirs) { $sourceFiles += Get-ChildItem -LiteralPath (Join-Path $sourceRoot $projectDir) -Recurse -File }
foreach ($rootFile in $rootFiles) { $sourceFiles += Get-Item -LiteralPath (Join-Path $sourceRoot $rootFile) }
$writes = @()
foreach ($sourceFile in $sourceFiles) {
  $relative = $sourceFile.FullName.Substring($sourceRoot.Length + 1)
  $destination = Join-Path $targetRoot $relative
  $sourceHash = (Get-FileHash -LiteralPath $sourceFile.FullName -Algorithm SHA256).Hash
  if (Test-Path -LiteralPath $destination) {
    if (-not $baseline.ContainsKey($relative)) { throw "原项目新增同名文件，需先核对：$relative" }
    $currentHash = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash
    if ($currentHash -ne $baseline[$relative]) { throw "原文件在接手后已变化，停止覆盖：$relative" }
    if ($currentHash -eq $sourceHash) { continue }
  }
  $writes += [pscustomobject]@{ source=$sourceFile.FullName; relative=$relative; destination=$destination; sha256=$sourceHash }
}
$evidenceRoot = Join-Path $targetRoot 'artifacts\next-stage-20261103'
if (Test-Path -LiteralPath $evidenceRoot) { throw '本轮交付证据目录已存在，停止以避免覆盖。' }
$deliverables = Get-ChildItem -LiteralPath (Join-Path $sourceRoot 'dist') -File
foreach ($deliverable in $deliverables) {
  if (Test-Path -LiteralPath (Join-Path $targetRoot ('dist\' + $deliverable.Name))) { throw "同名交付产物已存在：$($deliverable.Name)" }
}
# All paths are fixed and validated above. Copy only; no deletion, moving,
# project data import, DSH invocation or profile changes are performed.
$backupRoot = Join-Path $sourceRoot 'artifacts\original-source-before-0.2.0'
foreach ($write in $writes) {
  if (Test-Path -LiteralPath $write.destination) {
    $backupPath = Join-Path $backupRoot $write.relative
    New-Item -ItemType Directory -Path (Split-Path -Parent $backupPath) -Force | Out-Null
    Copy-Item -LiteralPath $write.destination -Destination $backupPath
  }
  New-Item -ItemType Directory -Path (Split-Path -Parent $write.destination) -Force | Out-Null
  Copy-Item -LiteralPath $write.source -Destination $write.destination
  if ((Get-FileHash -LiteralPath $write.destination -Algorithm SHA256).Hash -ne $write.sha256) { throw "同步字节校验失败：$($write.relative)" }
}
New-Item -ItemType Directory -Path $evidenceRoot -Force | Out-Null
foreach ($artifact in (Get-ChildItem -LiteralPath (Join-Path $sourceRoot 'artifacts') -File)) { Copy-Item -LiteralPath $artifact.FullName -Destination $evidenceRoot }
foreach ($evidenceDir in @('real-agent-handoff','real-agent-validation')) { Copy-Item -LiteralPath (Join-Path $sourceRoot ('artifacts\' + $evidenceDir)) -Destination $evidenceRoot -Recurse }
New-Item -ItemType Directory -Path (Join-Path $targetRoot 'dist') -Force | Out-Null
foreach ($deliverable in $deliverables) {
  $destination = Join-Path $targetRoot ('dist\' + $deliverable.Name)
  Copy-Item -LiteralPath $deliverable.FullName -Destination $destination
  if ((Get-FileHash -LiteralPath $destination).Hash -ne (Get-FileHash -LiteralPath $deliverable.FullName).Hash) { throw '交付产物字节校验失败' }
}
$report = [ordered]@{ source=$sourceRoot; target=$targetRoot; sourceFilesVerified=$sourceFiles.Count; changedFiles=@($writes.relative); evidenceDirectory=$evidenceRoot; originalSourceBackup=$backupRoot; installed=$false; deletedFiles=0 }
$report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $sourceRoot 'artifacts\delivery-sync-results.json') -Encoding utf8
Copy-Item -LiteralPath (Join-Path $sourceRoot 'artifacts\delivery-sync-results.json') -Destination $evidenceRoot
Write-Output "已校验并同步 $($writes.Count) 个源码/构建文件；原任务数据保留，未安装 DSH。"
