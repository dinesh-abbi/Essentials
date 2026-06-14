@echo off
REM --- Windows Batch Wrapper for Catalyst Essentials PowerShell Build ---
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1"
pause
