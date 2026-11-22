@echo off
echo ======================================================
echo    Rebuilding Orion X Final Enclosure & Exporting STLs...
echo ======================================================
"C:\Users\HomePC\AppData\Local\Programs\FreeCAD 1.0\bin\freecadcmd.exe" "c:\Users\HomePC\Downloads\orion CAD\build_orion_x_final.py"
echo.
echo ======================================================
echo    Done! Master model saved to OrionX_Enclosure_Final.FCStd
echo    Fresh STLs exported to STL\ ready to 3D print!
echo ======================================================
pause
