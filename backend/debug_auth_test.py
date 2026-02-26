import os
import sys
from dotenv import load_dotenv

try:
    import anthropic
except ImportError:
    print("Error: El paquete 'anthropic' no está instalado. Ejecute 'pip install anthropic'.")
    sys.exit(1)

def run_auth_test():
    # 1. Cargar .env desde la carpeta del script (backend/)
    base_dir = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.join(base_dir, ".env")
    
    print("--- AISLADO: TEST DE AUTENTICACION ANTHROPIC ---")
    print(f"Buscando .env en: {env_path}")
    
    if not os.path.exists(env_path):
        print(f"ADVERTENCIA: No se encontró .env en {env_path}")
        # Intentar cargar desde el CWD por si acaso
        load_dotenv(override=True)
        env_path = "Entorno actual (CWD)"
    else:
        load_dotenv(env_path, override=True)

    # 2. Obtener la key con fallback
    key_name = "ANTHROPIC_API_KEY"
    api_key = os.getenv("ANTHROPIC_API_KEY")
    
    if not api_key:
        key_name = "CLAUDE_API_KEY"
        api_key = os.getenv("CLAUDE_API_KEY")

    # 3. Limpieza de blancos
    if api_key:
        api_key = api_key.strip()
    
    # 4. Logs de diagnóstico seguros
    print(f"Ruta .env usada: {env_path}")
    print(f"Variable leída: {key_name}")
    
    if not api_key:
        print("\n>>> ERROR: No se detectó ninguna API key. Verifique su archivo .env")
        return

    longitud = len(api_key)
    masked_key = f"{api_key[:6]}...{api_key[-4:]}" if longitud > 10 else "KEY DEMASIADO CORTA"
    
    print(f"Longitud: {longitud}")
    print(f"Key enmascarada: {masked_key}")
    
    # 5. Llamada mínima de prueba con diagnóstico profundo
    try:
        import httpx
        print("\nRealizando diagnóstico profundo con httpx...")
        
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        
        # Intentamos listar modelos (si el endpoint existe en esta versión de la API)
        # o simplemente una petición a messages con un modelo común
        payload = {
            "model": "claude-3-5-sonnet-20241022",
            "max_tokens": 1,
            "messages": [{"role": "user", "content": "HI"}]
        }
        
        with httpx.Client() as client:
            response = client.post(
                "https://api.anthropic.com/v1/messages",
                headers=headers,
                json=payload
            )
            
            print(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                print("¡Éxito total!")
                print(f"Respuesta: {response.json().get('content', [{}])[0].get('text', '')}")
                print("\n*********************************")
                print("* RESULTADO: >>> AUTH OK <<<    *")
                print("*********************************")
            elif response.status_code == 401:
                print("Error 401: La API key es INVÁLIDA.")
                print(f"Cuerpo: {response.text}")
                print("\n*****************************************")
                print("* RESULTADO: >>> FALLO (401) <<<        *")
                print("*****************************************")
            elif response.status_code == 404:
                print("Error 404: El modelo o el endpoint no existen.")
                print(f"Cuerpo: {response.text}")
                print("\n*****************************************")
                print("* RESULTADO: >>> ADVERTENCIA (404) <<<  *")
                print("* La key PARECE VALIDA pero el modelo   *")
                print("* no está habilitado o el ID es malo.  *")
                print("*****************************************")
            else:
                print(f"Error {response.status_code}: {response.text}")
                print("\n*****************************************")
                print(f"* RESULTADO: FALLO ({response.status_code}) *")
                print("*****************************************")

    except Exception as e:
        print(f"\n*****************************************")
        print(f"* RESULTADO: ERROR DE DIAGNOSTICO       *")
        print(f"* Detalle: {str(e)}")
        print("*****************************************")

if __name__ == "__main__":
    run_auth_test()
