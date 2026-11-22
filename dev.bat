@echo off
rem Run Arm Studio from the working tree on Windows, the way dev.sh does on Linux.
rem
rem Builds web and server, assembles electron\build-web + electron\build-server from those outputs, then
rem launches Electron against the working tree. This is the thing to run while developing: the packaged
rem app under electron\output\ is a snapshot and does not pick up source changes.
rem
rem   dev.bat               build, then launch
rem   dev.bat --build-only  build and report what was built, without launching
setlocal

rem %~dp0 always ends in a backslash. Kept, it is a trap: inside quotes a backslash before the closing quote
rem escapes it, so "%ROOT%" becomes a path with a stray quote in it and cmd answers "The filename, directory
rem name, or volume label syntax is incorrect" from whichever command touched it first. Stripped once here,
rem every path below can be written as "%ROOT%\something" without thinking about it.
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

if not exist "%ROOT%\web\package.json" (
    echo ^>^> This is not the arm-studio working tree: %ROOT%
    exit /b 1
)

cd /d "%ROOT%"

set "BUILD_ONLY="
if /I "%~1"=="--build-only" set "BUILD_ONLY=1"
if /I "%~1"=="-b" set "BUILD_ONLY=1"

echo ^>^> Working tree: %ROOT%

rem ---- dependencies -------------------------------------------------------------------------------
for %%d in (web server electron) do (
    if not exist "%ROOT%\%%d\node_modules" (
        echo ^>^> Installing %%d dependencies
        pushd "%ROOT%\%%d"
        call npm install --no-audit --no-fund
        if errorlevel 1 goto :fail
        popd
    )
)

rem ---- engine (gitignored binary, so a clean tree has none) ------------------------------------------
if not exist "%ROOT%\electron\PlotterHelper\PlotterHelper.exe" (
    echo ^>^> Building PlotterHelper engine
    call bash "%ROOT%\scripts\build-plotter-helper.sh"
    if errorlevel 1 echo ^>^> Continuing without PlotterHelper; the built-in converter will be used.
)

rem ---- build ----------------------------------------------------------------------------------------
echo ^>^> Building web
call npm --prefix web run build
if errorlevel 1 goto :fail
if not exist "%ROOT%\web\build-web\index.html" (
    copy /y "%ROOT%\web\index.html" "%ROOT%\web\build-web\index.html" >nul
)

echo ^>^> Building server
call npm --prefix server run build
if errorlevel 1 goto :fail

rem ---- assemble the app directory Electron actually loads ------------------------------------------
echo ^>^> Assembling electron\build-web and electron\build-server
pushd "%ROOT%\electron"
call node copy_files.js windows
if errorlevel 1 (
    popd
    goto :fail
)
popd

rem ---- say what was built, so "is my new feature in here?" is answerable at a glance -----------------
rem Kept in a script rather than inline: batch mangles the punctuation in a node -e one-liner.
call node "%ROOT%\scripts\dev-build-info.mjs" "%ROOT%"
if errorlevel 1 goto :fail

if defined BUILD_ONLY (
    echo ^>^> Build only; not launching.
    exit /b 0
)

rem ---- launch ---------------------------------------------------------------------------------------
if not exist "%ROOT%\electron\node_modules\.bin\electron.cmd" (
    echo ^>^> Electron is not installed under electron\node_modules.
    echo     Run: cd /d "%ROOT%\electron" ^&^& npm install
    goto :fail
)

echo ^>^> Launching Arm Studio from the working tree
rem /D sets the working directory and "." is the app, which is exactly what `electron .` means. Passing the
rem app path as an absolute argument instead needs the right working directory anyway, and this way a stale
rem cwd cannot pick up a different package.json.
start "" /D "%ROOT%\electron" "%ROOT%\electron\node_modules\.bin\electron.cmd" .

rem A window that fails to open is worse than an error, so wait and check that it opened.
ping -n 4 127.0.0.1 >nul
tasklist /fi "imagename eq electron.exe" 2>nul | find /i "electron.exe" >nul
if errorlevel 1 (
    echo.
    echo ^>^> Electron did not start. Run it by hand to see the reason:
    echo      cd /d "%ROOT%\electron"
    echo      node_modules\.bin\electron.cmd .
    goto :fail
)

echo ^>^> Arm Studio is running.
exit /b 0

:fail
echo.
echo ^>^> Build failed; see the errors above.
exit /b 1
