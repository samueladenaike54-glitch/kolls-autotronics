@echo off
REM ===================================================================
REM  Install the Silicon Labs CP210x driver for the ESP32 board.
REM  Self-elevates (UAC prompt) - Windows will not load a serial driver
REM  without administrator rights.
REM ===================================================================
setlocal
cd /d "%~dp0.."

set "ZIP=%USERPROFILE%\Downloads\CP210x_Universal_Windows_Driver.zip"
set "OUT=%TEMP%\cp210x-universal"

if not exist "%OUT%\silabser.inf" (
  if exist "%ZIP%" (
    echo Extracting %ZIP% ...
    powershell -NoProfile -Command "Expand-Archive -Path '%ZIP%' -DestinationPath '%OUT%' -Force"
  ) else (
    echo ERROR: %ZIP% not found.
    echo Download "CP210x Universal Windows Driver" from silabs.com and try again.
    pause & exit /b 1
  )
)

echo.
echo Requesting administrator rights for the driver install...
powershell -NoProfile -Command "Start-Process -FilePath 'pnputil.exe' -ArgumentList '/add-driver','%OUT%\silabser.inf','/install' -Verb RunAs -Wait"
echo.
echo Driver install finished. Now UNPLUG and RE-PLUG the ESP32 board.
timeout /t 6 >nul
echo.
echo Serial ports now present:
powershell -NoProfile -Command "Get-CimInstance Win32_SerialPort | Select-Object DeviceID,Name | Format-Table -AutoSize"
echo.
echo Look for "CP2102 USB to UART Bridge Controller (COMx)" - that is your board.
echo Ignore "Intel(R) Active Management Technology" - that is the motherboard.
echo.
echo Then flash with:   tools\flash-esp32.cmd COMx
pause
