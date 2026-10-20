@echo off
REM ===================================================================
REM  Kolls Autotronics - Saturday demo launcher
REM  1. starts a local HTTP server for the dashboard (avoids the
REM     https -> http mixed-content block on GitHub Pages)
REM  2. finds the ESP32 gateway on this network automatically
REM  3. opens the browser pointed straight at it
REM
REM  Just double-click this file. Keep the window open while demoing.
REM ===================================================================
title Kolls Autotronics - Demo Server
cd /d "%~dp0"

echo.
echo   Kolls Autotronics - Demo launcher
echo   -----------------------------------
echo   1. The ESP32 and this laptop must be on the SAME network
echo      (phone hotspot is the safest)
echo   2. If the IP on the TFT NET page is not auto-detected, open:
echo        http://127.0.0.1:8123/index.html?gateway=http://^<ESP-IP^>
echo.
echo   Starting... (keep this window open)
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   ERROR: Node.js is not installed or not on PATH.
  echo   Install it from https://nodejs.org  then run this file again.
  pause
  exit /b 1
)

node tools\serve-demo.js
echo.
echo   Server stopped.
pause
