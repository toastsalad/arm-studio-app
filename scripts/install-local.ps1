# Install the working tree as a local app, replacing whatever is installed there now.
#
# Why this exists: the desktop shortcut can point at a build made months ago, and nothing on the machine says
# so. The dev tree builds into electron\output\win-unpacked and the packaged app never follows it, so the two
# drift apart silently and "the app is old" looks like a bug in the app.
#
#   powershell -File scripts\install-local.ps1                 build, then install over the current location
#   powershell -File scripts\install-local.ps1 -NoBuild        install what is already in electron\output
#   powershell -File scripts\install-local.ps1 -Target D:\Apps\ArmStudio
#
# The default target is the folder the existing shortcut points at, so the shortcut keeps working.
param(
    [string]$Target = '',
    [switch]$NoBuild
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$source = Join-Path $root 'electron\output\win-unpacked'

function Step($text) { Write-Host ">> $text" }
function Fail($text) { Write-Host ">> $text" -ForegroundColor Red; exit 1 }

if (-not $NoBuild) {
    Step 'Building web, server and the app directory'
    & cmd /c "`"$(Join-Path $root 'dev.bat')`" --build-only"
    if ($LASTEXITCODE -ne 0) { Fail 'The build failed; see above.' }

    Step 'Packaging'
    & npm --prefix (Join-Path $root 'electron') run build:win-x64
    if ($LASTEXITCODE -ne 0) { Fail 'Packaging failed; see above.' }
}

if (-not (Test-Path (Join-Path $source 'Arm Studio.exe'))) {
    Fail "Nothing to install: $(Join-Path $source 'Arm Studio.exe') is missing. Run without -NoBuild."
}

# A build that is missing the newest UI is the failure this script is about, so check for it rather than
# copying a stale directory over a stale install.
#
# The check compares the packaged bundle with the one the dev build just wrote. It used to look for a marker
# string from a particular feature ('Image shading'), which only proves one feature is present and goes stale
# silently the moment a build predates a *different* feature.
$builtBundle = Join-Path $root 'electron\build-web\bundle.js'
$packagedBundle = Join-Path $source 'resources\app\build-web\bundle.js'
if (-not (Test-Path $packagedBundle)) {
    Fail 'The packaged app has no web bundle. Run without -NoBuild.'
}
if ((Test-Path $builtBundle) -and
    ((Get-Item $builtBundle).LastWriteTime -gt (Get-Item $packagedBundle).LastWriteTime.AddSeconds(1))) {
    Fail ('electron\output is older than electron\build-web: the packaged app would show the previous UI. ' +
          'Run without -NoBuild.')
}

if (-not $Target) {
    $existing = Join-Path $env:USERPROFILE 'ArmStudio'
    $Target = if (Test-Path (Join-Path $existing 'Arm Studio.exe')) { $existing }
    else { Join-Path $env:LOCALAPPDATA 'Programs\Arm Studio' }
}

Step "Installing to $Target"

# Windows locks the files of a running app, and a half-replaced install is worse than an old one.
Get-Process 'Arm Studio', 'electron' -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 500

New-Item -ItemType Directory -Force -Path $Target | Out-Null
& robocopy $source $Target /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
# robocopy reports 0-7 for success; 8 and above are failures.
if ($LASTEXITCODE -ge 8) { Fail "Copy to $Target failed (robocopy $LASTEXITCODE)." }

# The point of this script is that the installed folder holds what was just built, so compare what landed with
# what was packaged instead of trusting that robocopy did it. A running app or a locked file leaves the old copy
# in place and robocopy still reports success.
Step 'Verifying the copy'
$mustMatch = @(
    'Arm Studio.exe',
    'resources\app\build-web\bundle.js',
    'resources\app\build-server\startLocalServer.js',
    'resources\app\PlotterHelper\PlotterHelper.exe',
    'resources\app\package.json'
)
$stale = @()
foreach ($relative in $mustMatch) {
    $from = Join-Path $source $relative
    $to = Join-Path $Target $relative
    if (-not (Test-Path $to)) { $stale += "$relative is missing from the install"; continue }
    if ((Get-FileHash $from).Hash -ne (Get-FileHash $to).Hash) { $stale += "$relative did not replace the old copy" }
}
if ($stale.Count) {
    Fail ("The install does not match the build:`n  " + ($stale -join "`n  ") + "`nClose every running copy and run again.")
}
Write-Host "   $($mustMatch.Count) files match the build"

$exe = Join-Path $Target 'Arm Studio.exe'

Step 'Updating shortcuts'
$shell = New-Object -ComObject WScript.Shell
$shortcuts = @(
    (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Arm Studio.lnk'),
    (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Arm Studio.lnk')
)

# A pinned taskbar entry is a shortcut in a fourth folder, and it is the one people click most. It is only
# touched when it already exists and already points at an Arm Studio copy: creating a pin nobody asked for
# would be worse than leaving a stale one.
$pinFolders = @(
    (Join-Path $env:APPDATA 'Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar'),
    (Join-Path $env:APPDATA 'Microsoft\Internet Explorer\Quick Launch')
)
foreach ($pinFolder in $pinFolders) {
    if (-not (Test-Path $pinFolder)) { continue }
    Get-ChildItem -Path $pinFolder -Filter *.lnk -ErrorAction SilentlyContinue | ForEach-Object {
        $existing = $shell.CreateShortcut($_.FullName)
        $old = $existing.TargetPath
        if ($old -and (Split-Path -Leaf $old) -eq 'Arm Studio.exe') { $shortcuts += $_.FullName }
        elseif ($old -and $old -match 'rotrics-studio') { $shortcuts += $_.FullName }
    }
}

foreach ($link in $shortcuts) {
    $shortcut = $shell.CreateShortcut($link)
    $shortcut.TargetPath = $exe
    $shortcut.WorkingDirectory = $Target
    $shortcut.IconLocation = "$exe,0"
    $shortcut.Description = 'Arm Studio'
    $shortcut.Save()
    Write-Host "   $link"
}

# Other copies on this machine are what makes an old build look like a current one, so name them.
$others = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\rotrics-studio-app'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Arm Studio'),
    (Join-Path $env:USERPROFILE 'ArmStudio')
) | Where-Object { (Test-Path $_) -and ($_ -ne $Target) }

foreach ($other in $others) {
    Write-Host ">> Note: another copy is installed at $other" -ForegroundColor Yellow
    Write-Host '        Launching that one shows whatever it was built with.' -ForegroundColor Yellow
}

$version = (Get-Content (Join-Path $Target 'resources\app\package.json') -Raw | ConvertFrom-Json)
Write-Host ''
Write-Host ">> Installed $($version.productName) $($version.version) to $Target"
Write-Host "   exe    $exe ($([math]::Round((Get-Item $exe).Length / 1MB)) MB, $((Get-Item $exe).LastWriteTime))"
Write-Host "   web    $((Get-Item (Join-Path $Target 'resources\app\build-web\bundle.js')).LastWriteTime)"
Write-Host "   engine $((Get-Item (Join-Path $Target 'resources\app\PlotterHelper\PlotterHelper.exe')).LastWriteTime)"

# Say the exit code out loud. Without this the script inherited robocopy's status, and robocopy returns 1 for
# 'files were copied' -- a successful install that reports 1 looks exactly like a failed one to every caller.
exit 0
