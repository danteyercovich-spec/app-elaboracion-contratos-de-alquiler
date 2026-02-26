"""
Script temporal: Lista modelos disponibles de Anthropic con la API key del .env
Uso: venv/Scripts/python.exe list_models.py
"""
import os
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:
    print("ERROR: 'python-dotenv' no instalado. Ejecute: pip install python-dotenv")
    sys.exit(1)

try:
    import httpx
except ImportError:
    print("ERROR: 'httpx' no instalado. Ejecute: pip install httpx")
    sys.exit(1)

# 1. Cargar backend/.env desde la carpeta del script
env_path = Path(__file__).resolve().parent / ".env"
print(f"Cargando .env desde: {env_path}")
load_dotenv(dotenv_path=env_path, override=True)

# 2. Fallback ANTHROPIC_API_KEY -> CLAUDE_API_KEY
api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
key_name = "ANTHROPIC_API_KEY"
if not api_key:
    api_key = os.getenv("CLAUDE_API_KEY", "").strip()
    key_name = "CLAUDE_API_KEY"

if not api_key:
    print("ERROR: No se encontró ninguna API key en el .env")
    sys.exit(1)

masked = f"{api_key[:6]}...{api_key[-4:]}" if len(api_key) > 10 else "KEY MUY CORTA"
print(f"Variable usada : {key_name}")
print(f"Key (parcial)  : {masked}")
print(f"Longitud       : {len(api_key)} caracteres\n")

# 3. Llamar a /v1/models
headers = {
    "x-api-key": api_key,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
}

print("Consultando https://api.anthropic.com/v1/models ...\n")
try:
    with httpx.Client(timeout=15) as client:
        response = client.get("https://api.anthropic.com/v1/models", headers=headers)
except Exception as e:
    print(f"ERROR de conexión: {e}")
    sys.exit(1)

# 4. Procesar respuesta
if response.status_code != 200:
    print(f"Error HTTP {response.status_code}: {response.text}")
    sys.exit(1)

data = response.json()
models = data.get("data", [])

if not models:
    print("No se encontraron modelos disponibles para esta key.")
    sys.exit(0)

# 5. Imprimir modelos disponibles
print("-" * 55)
print(f"  MODELOS DISPONIBLES PARA ESTA API KEY ({len(models)} encontrados)")
print("-" * 55)

# Priorizar modelos tipo "sonnet" y "haiku" para la sugerencia
sonnet_models = []
haiku_models  = []
opus_models   = []

for m in sorted(models, key=lambda x: x.get("id", ""), reverse=True):
    model_id = m.get("id", "")
    display  = m.get("display_name", model_id)
    print(f"  • {model_id:<45} ({display})")
    if "sonnet" in model_id:
        sonnet_models.append(model_id)
    elif "haiku" in model_id:
        haiku_models.append(model_id)
    elif "opus" in model_id:
        opus_models.append(model_id)

print("-" * 55 + "\n")

# Sugerencia: el sonnet más reciente, sino haiku, sino opus
suggested = (sonnet_models + haiku_models + opus_models + [models[0].get("id", "")])[0]

print(f"SUGERENCIA para CLAUDE_MODEL en su .env:")
print(f"  CLAUDE_MODEL={suggested}\n")
print(f"Para actualizarlo, edite backend/.env y cambie la línea CLAUDE_MODEL.")
