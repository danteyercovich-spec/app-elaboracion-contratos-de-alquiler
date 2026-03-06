@echo off
echo [AutoContract V2] Levantando servidor...
cd /d "%~dp0backend"
if not exist venv (
    echo Creando entorno virtual...
    python -m venv venv
)
call venv\Scripts\activate
pip install -q -r requirements.txt
echo Servidor en http://localhost:8002
python -m uvicorn main:app --host 0.0.0.0 --port 8002 --reload
