@echo off
setlocal
cd /d "%~dp0"

start "Footprint Map Server" /D "%~dp0" powershell -NoExit -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" -OpenBrowser
