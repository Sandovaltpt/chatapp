@echo off
title ChatApp - Iniciando...
color 0A
cls

echo.
echo  ============================================
echo   CHATAPP - Mensajeria en tiempo real
echo  ============================================
echo.
echo  Iniciando servidores...
echo.

:: Inicia el backend en una nueva ventana
start "ChatApp Backend" cmd /k "cd /d %~dp0server && node index.js"

:: Espera 2 segundos para que el backend arranque
timeout /t 2 /nobreak >nul

:: Inicia el frontend en una nueva ventana
start "ChatApp Frontend" cmd /k "cd /d %~dp0client && npm run dev"

:: Espera 4 segundos para que Vite arranque
timeout /t 4 /nobreak >nul

:: Abre el navegador
echo  Abriendo la aplicacion en el navegador...
start "" "http://localhost:3000"

echo.
echo  ChatApp esta corriendo en: http://localhost:3000
echo.
echo  Para detener: cierra las ventanas "ChatApp Backend" y "ChatApp Frontend"
echo.
pause
