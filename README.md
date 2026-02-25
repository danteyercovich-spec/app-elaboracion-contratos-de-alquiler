# AutoContract — Gestor Legal Conversacional 🏛️

Aplicación web que automatiza la generación de contratos de alquiler con IA, manteniendo la **integridad legal absoluta** del texto original.

## ✨ Características

- 📄 **Ingresar plantilla**: Pega el texto o sube un `.txt`
- 🔍 **Detección de variables**: La IA identifica automáticamente campos como `[NOMBRE]`, `{{dato}}`, `<CAMPO>`, `___`
- 💬 **Entrevista conversacional**: El asistente pregunta dato por dato
- ✅ **Generación segura**: Solo sustituye variables, nunca modifica cláusulas
- 📥 **Exportación DOCX**: Documento Word profesional listo para firmar

## 🚀 Instalación y ejecución

### Requisitos
- Python 3.10 o superior
- Clave de API de OpenAI

### Pasos

1. **Configure la API key:**
   ```
   copy backend\.env.example backend\.env
   ```
   Edite `backend\.env` y reemplace `sk-your-key-here` con su clave real de OpenAI.

2. **Instale dependencias:**
   ```bash
   python -m venv backend\venv
   backend\venv\Scripts\activate
   pip install -r backend\requirements.txt
   ```

3. **Inicie la aplicación:**
   ```bash
   cd backend
   python main.py
   ```
   O simplemente ejecute `start.bat` (Windows)

4. **Abra el navegador:**
   ```
   http://localhost:8000
   ```

## 📁 Estructura del proyecto

```
app-elaboracion-contratos-de-alquiler/
├── backend/
│   ├── main.py              # API FastAPI
│   ├── requirements.txt     # Dependencias Python
│   ├── .env.example         # Ejemplo de variables de entorno
│   └── .env                 # Su configuración (NO subir a git)
├── frontend/
│   ├── index.html           # Interfaz principal
│   ├── styles.css           # Estilos premium
│   └── app.js               # Lógica del cliente
├── start.bat                # Inicio rápido (Windows)
└── README.md
```

## 🔒 Garantías legales

- El texto de las cláusulas **jamás se modifica**
- Solo se realiza sustitución exacta de los placeholders detectados
- El LLM analiza pero no redacta ni parafrasea el contrato

## 📋 Formatos de variables soportados

| Formato | Ejemplo |
|---------|---------|
| Corchetes | `[NOMBRE DEL ARRENDADOR]` |
| Llaves dobles | `{{nombreArrendatario}}` |
| Ángulos | `<DIRECCIÓN>` |
| Guiones bajos | `_______________` |
| Mayúsculas aisladas | `MONTO DEL CANON` |
