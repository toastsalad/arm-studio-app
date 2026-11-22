@echo off
rem Install the working tree as a local app: build, package, copy into place, refresh the shortcuts.
rem See scripts\install-local.ps1 for what it does and which flags it takes.
rem
rem   install.bat                        build, then install
rem   install.bat -NoBuild               install what is already in electron\output
rem   install.bat -Target D:\Apps\ArmStudio
setlocal

rem %~dp0 ends in a backslash, which escapes a closing quote inside "%ROOT%"; see dev.bat.
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\install-local.ps1" %*
exit /b %errorlevel%
