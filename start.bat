@echo off
echo ============================================
echo  AutoContract - Gestor Legal Conversacional
echo ============================================
echo.

REM Verificar si existe .env
if not exist backend\.env (
  echo [!] No se encontro backend\.env
  echo [!] Copie backend\.env.example a backend\.env y configure su OPENAI_API_KEY
  echo.
  pause
  exit /b 1
)

REM Verificar si existe el entorno virtual
if not exist backend\venv (
  echo [*] Creando entorno virtual Python...
  python -m venv backend\venv
  echo [OK] Entorno virtual creado.
)

echo [*] Activando entorno virtual e instalando dependencias...
call backend\venv\Scripts\activate.bat
pip install -r backend\requirements.txt --quiet

echo.
echo [OK] Todo listo. Iniciando servidor...
echo [*] La aplicacion estara disponible en: http://localhost:8000
echo [*] Presione Ctrl+C para detener el servidor.
echo.

cd backend
python main.py
