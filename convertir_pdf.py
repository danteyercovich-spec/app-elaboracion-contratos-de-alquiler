"""
AutoContract - Convertidor de contratos a Plantilla
====================================================
Soporta: PDF, DOCX, TXT
Usa IA (Claude o OpenAI) para marcar variables con {{NOMBRE_VARIABLE}}.

Uso:
    python convertir_pdf.py "contrato vivienda.pdf" --tipo vivienda
    python convertir_pdf.py "contrato local.docx" --tipo comercial
"""

import sys
import os
import re
import argparse

# Cargar .env
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend", ".env"))
except ImportError:
    pass

AI_PROVIDER = os.getenv("AI_PROVIDER", "openai").lower().strip()

# ─── Instalar pdfplumber solo si se necesita ─────────────────────────────────
try:
    import pdfplumber
    PDF_OK = True
except ImportError:
    PDF_OK = False

# ─── Configurar cliente de IA ────────────────────────────────────────────────
if AI_PROVIDER == "claude":
    try:
        import anthropic
        ai_client = anthropic.Anthropic(api_key=os.getenv("CLAUDE_API_KEY"))
        AI_MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-5")
        print(f"[IA] Claude / {AI_MODEL}")
    except ImportError:
        print("Falta instalar anthropic: backend\\venv\\Scripts\\pip install anthropic")
        sys.exit(1)
else:
    try:
        from openai import OpenAI
        ai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        AI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")
        print(f"[IA] OpenAI / {AI_MODEL}")
    except ImportError:
        print("Falta instalar openai: backend\\venv\\Scripts\\pip install openai")
        sys.exit(1)


# ─── Extraccion de texto ─────────────────────────────────────────────────────

def extraer_texto_pdf(ruta: str) -> str:
    if not PDF_OK:
        print("Falta pdfplumber: backend\\venv\\Scripts\\pip install pdfplumber")
        sys.exit(1)
    print(f"[PDF] Leyendo: {ruta}")
    partes = []
    with pdfplumber.open(ruta) as pdf:
        total = len(pdf.pages)
        print(f"      {total} pagina(s)")
        for i, pag in enumerate(pdf.pages, 1):
            t = pag.extract_text()
            if t:
                partes.append(t)
            print(f"      Pagina {i}/{total}...", end="\r")
    print()
    texto = "\n".join(partes)
    if not texto.strip():
        print("El PDF parece ser una imagen escaneada. Necesita OCR.")
        sys.exit(1)
    print(f"[OK] {len(texto):,} caracteres extraidos")
    return texto


def extraer_texto_docx(ruta: str) -> str:
    try:
        from docx import Document as DocxDoc
    except ImportError:
        print("Falta python-docx: backend\\venv\\Scripts\\pip install python-docx")
        sys.exit(1)
    print(f"[DOCX] Leyendo: {ruta}")
    doc = DocxDoc(ruta)
    partes = [p.text for p in doc.paragraphs if p.text.strip()]
    for tabla in doc.tables:
        for fila in tabla.rows:
            for celda in fila.cells:
                if celda.text.strip():
                    partes.append(celda.text.strip())
    texto = "\n".join(partes)
    print(f"[OK] {len(texto):,} caracteres extraidos")
    return texto


def extraer_texto(ruta: str) -> str:
    ext = os.path.splitext(ruta)[1].lower()
    if ext == ".pdf":
        return extraer_texto_pdf(ruta)
    elif ext in (".docx", ".doc"):
        return extraer_texto_docx(ruta)
    elif ext == ".txt":
        with open(ruta, "r", encoding="utf-8", errors="ignore") as f:
            texto = f.read()
        print(f"[OK] {len(texto):,} caracteres leidos")
        return texto
    else:
        print(f"Formato no soportado: {ext}")
        sys.exit(1)


# ─── Llamada a IA ─────────────────────────────────────────────────────────────

def llamar_ia(system_prompt: str, user_message: str) -> str:
    if AI_PROVIDER == "claude":
        r = ai_client.messages.create(
            model=AI_MODEL,
            max_tokens=8192,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
            temperature=0.1
        )
        return r.content[0].text
    else:
        r = ai_client.chat.completions.create(
            model=AI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            temperature=0.1
        )
        return r.choices[0].message.content


# ─── Marcado de variables ─────────────────────────────────────────────────────

def marcar_variables(texto: str, tipo: str) -> str:
    contextos = {
        "vivienda":  "contrato de alquiler de vivienda residencial",
        "comercial": "contrato de alquiler de local comercial",
        "auto":      "contrato de alquiler"
    }
    ctx = contextos.get(tipo, "contrato de alquiler")

    system_prompt = f"""Eres un experto legal en contratos de alquiler de Argentina.

Recibes el texto de un {ctx} con datos REALES ya escritos.

TAREA: Reemplaza cada dato variable con {{{{NOMBRE_EN_MAYUSCULAS}}}} y devuelve el contrato COMPLETO.

REGLAS CRITICAS:
- Preserva EXACTAMENTE la redaccion, puntuacion y estructura original
- NO resumas, NO reescribas, NO modifiques clausulas
- NO agregues texto que no exista en el original
- Si un dato aparece varias veces, usa SIEMPRE el mismo marcador
- Devuelve SOLO el texto del contrato marcado, sin explicaciones

VARIABLES TIPICAS A IDENTIFICAR:
- Nombres completos          -> {{{{NOMBRE_LOCADOR}}}}, {{{{NOMBRE_LOCATARIO}}}}
- DNI / CUIT                 -> {{{{DNI_LOCADOR}}}}, {{{{DNI_LOCATARIO}}}}
- Domicilios reales          -> {{{{DOMICILIO_LOCADOR}}}}, {{{{DOMICILIO_LOCATARIO}}}}
- Direccion del inmueble     -> {{{{DIRECCION_INMUEBLE}}}}
- Ciudad / Provincia         -> {{{{CIUDAD}}}}, {{{{PROVINCIA}}}}
- Fechas (inicio/firma)      -> {{{{FECHA_INICIO}}}}, {{{{DIA_FIRMA}}}}, {{{{MES_FIRMA}}}}, {{{{ANIO_FIRMA}}}}
- Duracion / vencimiento     -> {{{{DURACION_MESES}}}}, {{{{FECHA_VENCIMIENTO}}}}
- Montos en numeros          -> {{{{MONTO_ALQUILER_NUMEROS}}}}, {{{{MONTO_DEPOSITO}}}}
- Montos en letras           -> {{{{MONTO_ALQUILER_LETRAS}}}}
- Estado civil               -> {{{{ESTADO_CIVIL_LOCADOR}}}}, {{{{ESTADO_CIVIL_LOCATARIO}}}}
- Nacionalidad               -> {{{{NACIONALIDAD_LOCATARIO}}}}
- Garante (si hay)           -> {{{{NOMBRE_GARANTE}}}}, {{{{DNI_GARANTE}}}}, {{{{DOMICILIO_GARANTE}}}}
- Local comercial (si aplica)-> {{{{RUBRO_COMERCIAL}}}}, {{{{SUPERFICIE_M2}}}}, {{{{CONDICION_AFIP}}}}"""

    print("[IA] Analizando y marcando variables...")
    print("     (puede tardar 20-40 segundos)")

    MAX = 14000
    if len(texto) <= MAX:
        return llamar_ia(system_prompt, f"Aqui esta el contrato:\n\n{texto}")
    else:
        print(f"     Contrato largo ({len(texto):,} chars), procesando en partes...")
        chunks = [texto[i:i+MAX] for i in range(0, len(texto), MAX)]
        partes = []
        for idx, chunk in enumerate(chunks, 1):
            print(f"     Parte {idx}/{len(chunks)}...")
            partes.append(llamar_ia(system_prompt, f"PARTE {idx}/{len(chunks)}:\n\n{chunk}"))
        return "\n".join(partes)


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Convierte un contrato (PDF/DOCX/TXT) a plantilla con {{variables}}"
    )
    parser.add_argument("archivo", help="Ruta al archivo del contrato")
    parser.add_argument(
        "--tipo",
        choices=["vivienda", "comercial", "auto"],
        default="auto",
        help="Tipo de contrato (default: auto)"
    )
    parser.add_argument("--salida", help="Archivo de salida (default: nombre_PLANTILLA.txt)")
    args = parser.parse_args()

    if not os.path.exists(args.archivo):
        print(f"No se encontro: {args.archivo}")
        sys.exit(1)

    print("=" * 52)
    print("  AutoContract - Convertidor de Plantillas")
    print("=" * 52)
    print()

    # 1. Extraer texto
    texto = extraer_texto(args.archivo)

    # 2. Marcar variables
    print()
    texto_marcado = marcar_variables(texto, args.tipo)

    # 3. Listar variables detectadas
    variables = sorted(set(re.findall(r'\{\{([A-Z_]+)\}\}', texto_marcado)))
    print()
    print(f"[OK] Variables marcadas: {len(variables)}")
    for v in variables:
        print(f"     - {{{{{v}}}}}")

    # 4. Guardar
    nombre_base = os.path.splitext(os.path.basename(args.archivo))[0]
    salida = args.salida or f"{nombre_base}_PLANTILLA.txt"
    with open(salida, "w", encoding="utf-8") as f:
        f.write(texto_marcado)

    print()
    print(f"[GUARDADO] {salida}")
    print()
    print("Proximos pasos:")
    print(f"  1. Revise '{salida}' y verifique los marcadores")
    print("  2. Abra http://localhost:8000")
    print("  3. Pegue el contenido en la app y complete el contrato")
    print()


if __name__ == "__main__":
    main()
