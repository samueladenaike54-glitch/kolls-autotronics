@echo off
REM ===================================================================
REM  Flashes the TFT identification sketch (firmware\tft-identify.merged.bin).
REM  The panel then cycles through every driver/tab/inversion combination,
REM  showing a BIG number + label for 4 seconds each.
REM  Note the number where the picture is CLEAN, then reflash the gateway.
REM
REM  Usage:  identify-tft.cmd COM11
REM ===================================================================
setlocal
cd /d "%~dp0.."

set "ESPTOOL="
for /d %%d in ("%LOCALAPPDATA%\Arduino15\packages\esp32\tools\esptool_py\*") do if exist "%%d\esptool.exe" set "ESPTOOL=%%d\esptool.exe"
if not defined ESPTOOL if exist "%LOCALAPPDATA%\Arduino15\packages\esp32\tools\esptool_py\esptool.exe" set "ESPTOOL=%LOCALAPPDATA%\Arduino15\packages\esp32\tools\esptool_py\esptool.exe"
if not defined ESPTOOL for %%p in (esptool.exe esptool) do if not defined ESPTOOL where %%p >nul 2>&1 && set "ESPTOOL=%%p"
if not defined ESPTOOL (
  echo ERROR: esptool not found. Install the ESP32 board package in Arduino IDE.
  pause & exit /b 1
)

set "IMG=firmware\tft-identify.merged.bin"
if not exist "%IMG%" (
  echo ERROR: %IMG% not found.
  pause & exit /b 1
)

set "PORT=%~1"
if "%PORT%"=="" (
  echo.
  echo Available serial ports:
  "%ESPTOOL%" --list-ports
  echo.
  echo The gateway normally enumerates as COM11 - pass it explicitly if unsure.
  goto :manual
)

echo.
echo Flashing TFT identification sketch to %PORT% ...
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
echo Done. WATCH THE PANEL: 12 configs, 4 s each, big number top-left.
echo Write down the number where the picture is clean and upright.
goto :eof

:manual
echo.
echo Re-run with:  identify-tft.cmd COM11
endlocal
