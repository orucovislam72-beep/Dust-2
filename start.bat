@echo off
title Королевские Шахматы — Онлайн
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel%==0 (
  start "ChessServer" /min node "%~dp0server.js"
  timeout /t 1 /nobreak >nul
  start "" "http://localhost:10000"
) else (
  echo Node.js не найден. Установите Node.js 18+ с https://nodejs.org
  pause
)
exit
