<#
.SYNOPSIS
  Bật replica set một node "rs0" cho dịch vụ MongoDB trên Windows, để có transaction và change stream.

.DESCRIPTION
  1. Sao lưu mongod.cfg (mongod.cfg.truoc-replica-set-<thời điểm>.bak) rồi thêm khối:
        replication:
          replSetName: rs0
  2. Khởi động lại dịch vụ MongoDB và chờ nó nhận kết nối.
  3. rs.initiate() nếu replica set chưa được khởi tạo, chờ node thành PRIMARY.
  4. Thêm replicaSet=rs0 vào MONGODB_URI trong backend/.env (sao lưu .env trước).
  Chạy lại bao nhiêu lần cũng được: bước nào đã xong thì bỏ qua. Dữ liệu không bị đụng tới.

  Cần PowerShell "Run as Administrator" (để khởi động lại dịch vụ), trừ khi chạy với -ThuKhongGhi.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File backend\db\bat-replica-set.ps1 -ThuKhongGhi   # chỉ in ra sẽ làm gì
  powershell -ExecutionPolicy Bypass -File backend\db\bat-replica-set.ps1                # bật
  powershell -ExecutionPolicy Bypass -File backend\db\bat-replica-set.ps1 -HoanTac       # quay lại standalone
#>
param(
  [string]$Cfg = 'F:\MongoDB\bin\mongod.cfg',
  [string]$Service = 'MongoDB',
  [string]$TenRs = 'rs0',
  [string]$HostPort = '127.0.0.1:27017',
  [string]$EnvFile = (Join-Path $PSScriptRoot '..\.env'),
  [switch]$ThuKhongGhi,
  [switch]$HoanTac
)
$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Ghi-Tep([string]$duongDan, [string]$noiDung) {
  if ($ThuKhongGhi) { Write-Host "  (thử) sẽ ghi $duongDan"; return }
  [IO.File]::WriteAllText($duongDan, $noiDung, $utf8)
}
function Sao-Luu([string]$duongDan, [string]$hauTo) {
  $bak = "$duongDan.$hauTo-$(Get-Date -Format yyyyMMdd-HHmmss).bak"
  if ($ThuKhongGhi) { Write-Host "  (thử) sẽ sao lưu $duongDan -> $bak"; return }
  Copy-Item -LiteralPath $duongDan -Destination $bak
  Write-Host "  Đã sao lưu: $bak"
}
function Chay-Mongosh([string]$js) {
  $kq = & $script:mongosh --quiet "mongodb://$HostPort/?directConnection=true" --eval $js 2>&1
  return ($kq | Out-String).Trim()
}
function Cho([scriptblock]$dieuKien, [string]$viec, [int]$giay = 60) {
  for ($i = 0; $i -lt $giay; $i++) {
    if (& $dieuKien) { return }
    Start-Sleep -Seconds 1
  }
  throw "Hết $giay giây vẫn chưa $viec."
}

if (-not $ThuKhongGhi) {
  $laAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if (-not $laAdmin) { throw 'Cần mở PowerShell bằng "Run as Administrator" để khởi động lại dịch vụ MongoDB (hoặc thêm -ThuKhongGhi để xem trước).' }
}
if (-not (Test-Path -LiteralPath $Cfg)) { throw "Không thấy $Cfg. Truyền đúng đường dẫn bằng -Cfg." }
$script:mongosh = (Get-Command mongosh -ErrorAction SilentlyContinue).Source
if (-not $script:mongosh) { throw 'Không thấy mongosh trong PATH.' }

$cfgCu = [IO.File]::ReadAllText($Cfg)
$coRs = $cfgCu -match '(?m)^replication:[ \t]*\r?\n[ \t]+replSetName:'

# ---------- Quay lại standalone ----------
if ($HoanTac) {
  Write-Host "== Quay lại standalone =="
  if ($coRs) {
    Sao-Luu $Cfg 'truoc-hoan-tac'
    $moi = [regex]::Replace($cfgCu, '(?m)^replication:[ \t]*\r?\n[ \t]+replSetName:[^\r\n]*', '#replication:')
    Ghi-Tep $Cfg $moi
    if (-not $ThuKhongGhi) { Restart-Service -Name $Service; Write-Host "  Đã khởi động lại dịch vụ $Service." }
  } else { Write-Host "  mongod.cfg không có khối replication: bỏ qua." }
  if (Test-Path -LiteralPath $EnvFile) {
    $env0 = [IO.File]::ReadAllText($EnvFile)
    # Chỉ sửa dòng MONGODB_URI (không đụng dòng chú thích). "?replicaSet=rs0&x" -> "?x"; "...&replicaSet=rs0" / "?replicaSet=rs0" -> bỏ hẳn.
    $env1 = [regex]::Replace($env0, '(?m)^(MONGODB_URI=[^\r\n?]*)\?replicaSet=' + $TenRs + '&', '$1?')
    $env1 = [regex]::Replace($env1, '(?m)^(MONGODB_URI=[^\r\n]*?)[?&]replicaSet=' + $TenRs + '(?=\r?$)', '$1')
    if ($env1 -ne $env0) { Sao-Luu $EnvFile 'truoc-hoan-tac'; Ghi-Tep $EnvFile $env1; Write-Host "  Đã bỏ replicaSet=$TenRs khỏi .env" }
  }
  Write-Host "Xong. Dữ liệu vẫn nguyên; local.oplog.rs còn lại không ảnh hưởng gì."
  return
}

# ---------- 1. mongod.cfg ----------
Write-Host "== 1. $Cfg =="
if ($coRs) {
  Write-Host "  Đã có khối replication: giữ nguyên."
} else {
  Sao-Luu $Cfg 'truoc-replica-set'
  $khoi = "replication:`r`n  replSetName: $TenRs"
  $moi = if ($cfgCu -match '(?m)^#replication:[ \t]*(?=\r?$)') { [regex]::Replace($cfgCu, '(?m)^#replication:[ \t]*(?=\r?$)', $khoi) } else { $cfgCu.TrimEnd() + "`r`n`r`n$khoi`r`n" }
  Ghi-Tep $Cfg $moi
  if ($ThuKhongGhi) { Write-Host "  (thử) khối sẽ thêm:"; Write-Host $khoi }
}

# ---------- 2. Khởi động lại dịch vụ ----------
Write-Host "== 2. Dịch vụ $Service =="
if ($ThuKhongGhi) {
  Write-Host "  (thử) sẽ Restart-Service $Service"
} elseif (-not $coRs) {
  Restart-Service -Name $Service
  Cho { (Chay-Mongosh 'db.adminCommand({ ping: 1 }).ok') -eq '1' } 'kết nối được MongoDB'
  Write-Host "  Đã khởi động lại và kết nối được."
} else { Write-Host "  Không cần khởi động lại." }

# ---------- 3. rs.initiate ----------
Write-Host "== 3. Replica set $TenRs =="
$trangThai = Chay-Mongosh 'try { rs.status().set } catch (e) { e.codeName }'
if ($trangThai -eq $TenRs) {
  Write-Host "  Đã khởi tạo."
} elseif ($ThuKhongGhi) {
  Write-Host "  (thử) hiện tại: '$trangThai' -> sẽ chạy rs.initiate({ _id: '$TenRs', members: [{ _id: 0, host: '$HostPort' }] })"
} else {
  $kq = Chay-Mongosh "JSON.stringify(rs.initiate({ _id: '$TenRs', members: [{ _id: 0, host: '$HostPort' }] }))"
  Write-Host "  rs.initiate: $kq"
}
if (-not $ThuKhongGhi) {
  Cho { (Chay-Mongosh 'db.hello().isWritablePrimary') -eq 'true' } 'thành PRIMARY'
  Write-Host "  Node đã là PRIMARY: có transaction và change stream."
}

# ---------- 4. backend/.env ----------
Write-Host "== 4. $EnvFile =="
if (Test-Path -LiteralPath $EnvFile) {
  $env0 = [IO.File]::ReadAllText($EnvFile)
  $dong = [regex]::Match($env0, '(?m)^MONGODB_URI=([^\r\n]*)')
  if (-not $dong.Success) {
    Write-Host "  Không có dòng MONGODB_URI: ứng dụng dùng mặc định; replica set một node vẫn chạy được không cần sửa."
  } elseif ($dong.Groups[1].Value -match 'replicaSet=') {
    Write-Host "  MONGODB_URI đã có replicaSet: giữ nguyên."
  } else {
    $uri = $dong.Groups[1].Value
    $uriMoi = if ($uri.Contains('?')) { "$uri&replicaSet=$TenRs" } else { "${uri}?replicaSet=$TenRs" }
    Sao-Luu $EnvFile 'truoc-replica-set'
    Ghi-Tep $EnvFile ($env0.Substring(0, $dong.Index) + "MONGODB_URI=$uriMoi" + $env0.Substring($dong.Index + $dong.Length))
    Write-Host "  MONGODB_URI -> $uriMoi"
  }
} else { Write-Host "  Không có .env: bỏ qua." }

Write-Host ""
Write-Host "Xong. Khởi động lại backend (npm run start:dev): log phải có 'replica set ""$TenRs"": có transaction.'"
