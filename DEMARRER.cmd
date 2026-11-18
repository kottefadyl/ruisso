@echo off
cd /d "%~dp0"
title GestRuisseau
echo GestRuisseau - Demarrage de l'application
echo Verifiez que MySQL est actif dans WampServer.
echo.
call npm start
echo.
pause
