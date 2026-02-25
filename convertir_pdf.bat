@echo off
echo =====================================================
echo  AutoContract - Convertidor de PDF a Plantilla
echo =====================================================
echo.

if "%~1"=="" (
  echo Arrastre su archivo PDF encima de este .bat
  echo O ejecútelo así:
  echo.
  echo   convertir_pdf.bat contrato_vivienda.pdf
  echo   convertir_pdf.bat contrato_local.pdf comercial
  echo.
  set /p PDF_PATH="Ingrese la ruta del PDF: "
  set TIPO=auto
) else (
  set PDF_PATH=%~1
  set TIPO=%~2
  if "%TIPO%"=="" set TIPO=auto
)

echo.
echo Procesando: %PDF_PATH%
echo Tipo: %TIPO%
echo.

backend\venv\Scripts\python convertir_pdf.py "%PDF_PATH%" --tipo %TIPO%

echo.
pause
