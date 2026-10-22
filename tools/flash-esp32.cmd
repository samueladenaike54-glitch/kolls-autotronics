@echo off
REM ===================================================================
REM  Kolls Autotronics - flash the ESP32 gateway
REM  Writes firmware\ESP32_Battery_CAN_Gateway.ino.merged.bin (the
REM  full 4 MB factory image: bootloader + partition table + OTA data
REM  + app) at offset 0x0. One write, no offset guesswork.
REM
REM  If it fails with "Failed to connect", hold BOOT on the board,
REM  tap RESET, release BOOT - then run this again.
REM ===================================================================
setlocal enabledelayedexpansion
cd /d "%~dp0.."

REM Locate esptool: the ESP32 core keeps it in a versioned subfolder (e.g. esptool_py\5.3.1\esptool.exe).
set "ESPTOOL="
for /d %%d in ("%LOCALAPPDATA%\Arduino15\packages\esp32\tools\esptool_py\*") do if exist "%%d\esptool.exe" set "ESPTOOL=%%d\esptool.exe"
if not defined ESPTOOL if exist "%LOCALAPPDATA%\Arduino15\packages\esp32\tools\esptool_py\esptool.exe" set "ESPTOOL=%LOCALAPPDATA%\Arduino15\packages\esp32\tools\esptool_py\esptool.exe"
if defined ESPTOOL goto :have_esptool
for %%p in (esptool.exe esptool) do if not defined ESPTOOL where %%p >nul 2>&1 && set "ESPTOOL=%%p"
if not defined ESPTOOL (
  echo ERROR: esptool not found. Install the ESP32 board package in Arduino IDE.
  pause & exit /b 1
)
:have_esptool
echo Using esptool: %ESPTOOL%

set "IMG=firmware\ESP32_Battery_CAN_Gateway.ino.merged.bin"
if not exist "%IMG%" (
  echo ERROR: %IMG% not found. Build the sketch first ^(arduino-cli compile^).
  pause & exit /b 1
)

set "PORT=%~1"
if "%PORT%"=="" (
  echo.
  echo Available serial ports:
  "%ESPTOOL%" --list-ports
  echo.
  echo Reminder: "Intel(R) Active Management Technology - SOL" is NOT the ESP32.
  echo The gateway normally enumerates as COM11.
  goto :manual
)

echo.
echo Flashing %IMG% to %PORT% ...
"%ESPTOOL%" --chip esp32 --port %PORT% --baud 921600 write_flash 0x0 "%IMG%"
if errorlevel 1 (
  echo.
  echo Retrying at 115200 baud ...
  "%ESPTOOL%" --chip esp32 --port %PORT% --baud 115200 write_flash 0x0 "%IMG%"
)
if errorlevel 1 (
  echo.
  echo Flash FAILED. Hold BOOT, tap RESET, release BOOT, then retry.
  pause & exit /b 1
)
echo.
echo Done. Open the Serial Monitor at 115200 to watch the boot banner.
goto :eof

:manual
echo.
echo Re-run with:  flash-esp32.cmd COM11
endlocal
