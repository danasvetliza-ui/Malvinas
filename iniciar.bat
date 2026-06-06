@echo off
title Malvinas Collage - Homenaje 2 de Abril
color 0B

echo ====================================================
echo             MALVINAS COLLAGE EDITOR                 
echo               Homenaje 2 de Abril                   
echo ====================================================
echo.
echo [1/3] Iniciando el servidor Node.js en segundo plano...
start "Servidor - Malvinas Collage" cmd /k "node server.js"

echo.
echo [2/3] Esperando que el servidor inicialice...
timeout /t 2 /nobreak >nul

echo.
echo [3/3] Abriendo el Editor y el Visualizador en tu navegador...
start http://localhost:3000
start http://localhost:3000/display

echo.
echo ====================================================
echo  El editor se ha iniciado correctamente.
echo  - Editor: http://localhost:3000
echo  - Visualizador: http://localhost:3000/display
echo.
echo  * Para cerrar el servidor, cierra la ventana negra
echo    que dice "Servidor - Malvinas Collage".
echo ====================================================
echo.
pause
