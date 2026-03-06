/**
 * AutoContract V2 — app.js
 * Flujo: subir .docx → extraer placeholders → formulario → generar docx
 */

const API = '';

const state = {
    placeholders: [],   // lista de strings: ['LOCADOR_NOMBRE', ...]
    lastBlob: null,     // blob del docx generado
    lastFilename: '',
};

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initSplash();
    initUpload();
    initButtons();
    initPartiesUI();
    initLogsUI();
    checkApi();
});

// ─── UI Logs & Status ────────────────────────────────────────────────────────
function uiLog(msg, label = 'INFO') {
    const container = document.getElementById('ui-logs-container');
    const body = document.getElementById('ui-logs-body');
    if (!container || !body) return;

    container.classList.remove('hidden');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    const time = new Date().toLocaleTimeString();
    entry.innerHTML = `<span class="log-time">[${time}]</span> <span class="log-label">${escHtml(label)}:</span> ${escHtml(msg)}`;
    body.appendChild(entry);
    body.scrollTop = body.scrollHeight;
    console.log(`[UI-LOG] ${label}: ${msg}`);
}

function updateStatus(text, type = 'generating') {
    const badge = document.getElementById('status-badge');
    if (!badge) return;
    badge.textContent = text;
    badge.className = `status-badge status-${type}`;
    badge.classList.remove('hidden');
    if (type !== 'generating') {
        setTimeout(() => badge.classList.add('hidden'), 5000);
    }
}

function initLogsUI() {
    const btnClose = document.getElementById('btn-close-logs');
    if (btnClose) {
        btnClose.addEventListener('click', () => {
            document.getElementById('ui-logs-container').classList.add('hidden');
        });
    }
}

// ─── Splash ───────────────────────────────────────────────────────────────────
function initSplash() {
    setTimeout(() => {
        const splash = document.getElementById('splash');
        splash.classList.add('fade-out');
        setTimeout(() => {
            splash.style.display = 'none';
            document.getElementById('app').classList.remove('hidden');
        }, 600);
    }, 1800);
}

// ─── API status ───────────────────────────────────────────────────────────────
async function checkApi() {
    const dot = document.getElementById('api-dot');
    const text = document.getElementById('api-status-text');
    try {
        // El endpoint raíz sirve el frontend (200 OK)
        const res = await fetch(`${API}/api/extract`, {
            method: 'OPTIONS',
            signal: AbortSignal.timeout(3000),
        });
        dot.classList.add('online');
        text.textContent = 'API conectada';
    } catch {
        dot.classList.add('offline');
        text.textContent = 'API desconectada';
    }
}

// ─── Upload ───────────────────────────────────────────────────────────────────
let uploadedFile = null;

function initUpload() {
    const zone = document.getElementById('upload-zone');
    const input = document.getElementById('file-input');
    const btn = document.getElementById('btn-extract');

    zone.addEventListener('click', () => input.click());

    zone.addEventListener('dragover', e => {
        e.preventDefault();
        zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        const f = e.dataTransfer.files[0];
        if (f) setFile(f);
    });

    input.addEventListener('change', () => {
        if (input.files[0]) setFile(input.files[0]);
    });
}

function setFile(file) {
    if (!file.name.endsWith('.docx')) {
        showToast('Solo se aceptan archivos .docx', 'error');
        return;
    }
    uploadedFile = file;
    const zone = document.getElementById('upload-zone');
    zone.classList.add('has-file');
    zone.querySelector('.upload-icon').textContent = '✅';
    zone.querySelector('.upload-text').innerHTML = `<strong>${escHtml(file.name)}</strong>`;
    zone.querySelector('#upload-sub').textContent = `${(file.size / 1024).toFixed(1)} KB`;
    document.getElementById('btn-extract').disabled = false;
}

// ─── Botones ──────────────────────────────────────────────────────────────────
function initButtons() {
    document.getElementById('btn-extract').addEventListener('click', handleExtract);
    document.getElementById('btn-back-1').addEventListener('click', () => goToStep(1));
    document.getElementById('btn-generate').addEventListener('click', handleGenerate);
    document.getElementById('btn-back-2').addEventListener('click', () => goToStep(2));
    document.getElementById('btn-download').addEventListener('click', handleDownload);
    document.getElementById('btn-new').addEventListener('click', handleNew);
}

// ─── Parties UI ──────────────────────────────────────────────────────────────
function initPartiesUI() {
    const toggle = document.getElementById('parties-toggle');
    const content = document.getElementById('parties-content');
    const container = document.querySelector('.parties-container');
    const toggleL2 = document.getElementById('toggle-l2');
    const sectionL2 = document.getElementById('section-l2');

    toggle.addEventListener('click', () => {
        const isOpen = !content.classList.contains('hidden');
        if (isOpen) {
            content.classList.add('hidden');
            container.classList.remove('open');
        } else {
            content.classList.remove('hidden');
            container.classList.add('open');
        }
    });

    toggleL2.addEventListener('change', () => {
        sectionL2.classList.toggle('hidden', !toggleL2.checked);
    });
}

// ─── Paso 1 → 2: Extraer placeholders ────────────────────────────────────────
async function handleExtract() {
    if (!uploadedFile) return;
    showLoading('Leyendo plantilla...');

    const form = new FormData();
    form.append('file', uploadedFile);

    try {
        const res = await fetch(`${API}/api/extract`, { method: 'POST', body: form });
        const rawText = await res.text();
        console.log(`[EXTRACT] Raw Response (${res.status}):`, rawText);

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${rawText}`);
        }

        let data;
        try {
            data = JSON.parse(rawText);
        } catch (e) {
            throw new Error(`Error de formato JSON: ${rawText}`);
        }

        state.placeholders = data.placeholders;
        console.log(`[EXTRACT] ${data.count} placeholders:`, data.placeholders);

        hideLoading();
        renderForm(data.placeholders, data.filename);
        goToStep(2);

    } catch (err) {
        hideLoading();
        showToast(`Error: ${err.message}`, 'error');
    }
}

// ─── Renderizar formulario de campos ─────────────────────────────────────────
function humanLabel(key) {
    return key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

// Campos que por defecto se marcan como opcionales
const OPTIONAL_DEFAULTS = new Set(['GARANTE_NOMBRE', 'GARANTE_DNI']);

function renderForm(placeholders, filename) {
    const list = document.getElementById('fields-list');
    const desc = document.getElementById('step2-desc');
    desc.textContent = `${placeholders.length} placeholders detectados en "${filename}"`;

    list.innerHTML = '';

    placeholders.forEach((key, i) => {
        const isOptDefault = OPTIONAL_DEFAULTS.has(key);
        const card = document.createElement('div');
        card.className = 'field-card';

        card.innerHTML = `
      <div class="field-header">
        <label class="field-label" for="field-${escHtml(key)}">
          ${escHtml(humanLabel(key))}
          <code class="field-key">{{${escHtml(key)}}}</code>
        </label>
        <label class="opt-toggle" title="Marcar como vacío/opcional">
          <input type="checkbox" class="opt-check" id="opt-${escHtml(key)}" data-key="${escHtml(key)}" ${isOptDefault ? 'checked' : ''}/>
          <span class="opt-label">Vacío</span>
        </label>
      </div>
      <input
        type="text"
        class="field-input"
        id="field-${escHtml(key)}"
        data-key="${escHtml(key)}"
        placeholder="Ingrese ${escHtml(humanLabel(key))}..."
        ${isOptDefault ? 'disabled' : ''}
        autocomplete="off"
      />
    `;

        // Toggle opcional
        const check = card.querySelector('.opt-check');
        const input = card.querySelector('.field-input');
        check.addEventListener('change', () => {
            input.disabled = check.checked;
            if (check.checked) input.value = '';
            card.classList.toggle('field-optional', check.checked);
        });
        if (isOptDefault) card.classList.add('field-optional');

        list.appendChild(card);
    });
}

// ─── Paso 2 → 3: Generar documento ───────────────────────────────────────────
async function handleGenerate() {
    // Leer valores del formulario
    const values = {};
    const optionalEmpty = [];

    state.placeholders.forEach(key => {
        const input = document.getElementById(`field-${key}`);
        const check = document.getElementById(`opt-${key}`);
        if (check && check.checked) {
            optionalEmpty.push(key);
        } else if (input) {
            values[key] = input.value.trim();
        }
    });

    // Inyectar valores derivados si no están en carga manual
    const derived = derivePartiesValues();
    for (const [key, val] of Object.entries(derived)) {
        // Solo inyectar si el placeholder existe en la plantilla E incluye un valor no vacío derivado
        // Y si el usuario NO lo completó manualmente (values[key] está vacío o no existe)
        if (state.placeholders.includes(key) && val) {
            if (!values[key] || values[key].trim() === '') {
                values[key] = val;
            }
        }
    }

    const filled = Object.values(values).filter(v => v).length;
    const total = state.placeholders.length - optionalEmpty.length;
    console.log(`[GENERATE] ${filled}/${total} campos con valor | Vaciando: ${optionalEmpty.length}`);

    uiLog('CLICK GENERAR', 'USER');
    updateStatus('Generando...', 'generating');

    try {
        const url = `${API}/api/generate`;
        uiLog(`Llamando endpoint: ${url}`);

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ values, optional_empty: optionalEmpty }),
        });

        uiLog(`Status Code: ${res.status}`);
        const contentType = res.headers.get('Content-Type');
        uiLog(`Content-Type: ${contentType}`);

        if (!res.ok) {
            const rawText = await res.text();
            uiLog(`Error Response: ${rawText}`, 'ERROR');
            updateStatus('Error al generar', 'error');
            throw new Error(`HTTP ${res.status}: ${rawText}`);
        }

        const blob = await res.blob();
        uiLog(`Blob size: ${blob.size} bytes`);

        const disposition = res.headers.get('Content-Disposition') || '';
        const match = disposition.match(/filename="?([^"]+)"?/);
        state.lastFilename = match ? match[1] : 'contrato_COMPLETADO.docx';
        state.lastBlob = blob;
        uiLog(`Archivo listo: ${state.lastFilename}`, 'SUCCESS');
        updateStatus('Documento generado', 'success');

        // Leer advertencias de placeholders no reemplazados
        const unreplaced = res.headers.get('X-Unreplaced-Placeholders');
        const warnBox = document.getElementById('unreplaced-warn');
        if (unreplaced) {
            const list = unreplaced.split(',').map(p => `<code>${escHtml(p)}</code>`).join(', ');
            warnBox.innerHTML = `⚠️ <strong>Atención:</strong> Quedaron placeholders sin reemplazar: ${list}`;
            warnBox.classList.remove('hidden');
        } else {
            warnBox.classList.add('hidden');
        }

        hideLoading();

        // Mostrar resultado
        document.getElementById('success-filename').textContent = state.lastFilename;
        document.getElementById('success-stats').textContent =
            `${filled} campo(s) completados · ${optionalEmpty.length} omitidos`;

        goToStep(3);

        if (unreplaced) {
            showToast('Documento generado con advertencias', 'info');
        } else {
            showToast('Documento generado correctamente', 'success');
        }

    } catch (err) {
        hideLoading();
        showToast(`Error: ${err.message}`, 'error');
    }
}

// ─── Descarga ─────────────────────────────────────────────────────────────────
function handleDownload() {
    uiLog('DOWNLOAD TRIGGERED', 'USER');
    if (!state.lastBlob) {
        uiLog('Error: No hay blob para descargar', 'ERROR');
        updateStatus('Error: Sin archivo', 'error');
        return;
    }

    try {
        updateStatus('Descarga iniciada', 'success');
        const url = URL.createObjectURL(state.lastBlob);

        // 1. Crear enlace y agregar al DOM
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = state.lastFilename;
        document.body.appendChild(a);
        uiLog('DOWNLOAD LINK ADDED TO DOM');

        // 2. Disparar clic
        a.click();
        uiLog('CLICK EVENT DISPATCHED');

        // 3. Limpieza diferida (1000ms para asegurar que el navegador procese)
        setTimeout(() => {
            if (a.parentNode) {
                document.body.removeChild(a);
                uiLog('DOWNLOAD LINK REMOVED FROM DOM');
            }
            URL.revokeObjectURL(url);
            uiLog('Blob URL revoked');
        }, 1500);

        // 4. Mostrar fallback por si acaso
        const fallback = document.getElementById('download-fallback');
        const fallbackBtn = document.getElementById('btn-download-fallback');
        if (fallback && fallbackBtn) {
            fallback.classList.remove('hidden');
            fallbackBtn.onclick = () => {
                uiLog('MANUAL DOWNLOAD CLICKED', 'USER');
                window.open(url, '_blank'); // Abrir en nueva pestaña como último recurso
            };
        }

        uiLog('Descarga procesada (automática)', 'SUCCESS');

    } catch (err) {
        uiLog(`Excepción en descarga: ${err.message}`, 'ERROR');
        updateStatus('Error en descarga', 'error');

        // Fallback inmediato en caso de error
        if (state.lastBlob) {
            const url = URL.createObjectURL(state.lastBlob);
            window.open(url, '_blank');
        }
    }
}

// ─── Nuevo contrato ───────────────────────────────────────────────────────────
function handleNew() {
    uploadedFile = null;
    state.placeholders = [];
    state.lastBlob = null;
    state.lastFilename = '';

    const zone = document.getElementById('upload-zone');
    zone.classList.remove('has-file');
    zone.querySelector('.upload-icon').textContent = '📄';
    zone.querySelector('.upload-text').innerHTML = 'Arrastrá un archivo <strong>.docx</strong> o hacé clic';
    zone.querySelector('#upload-sub').textContent = 'Solo archivos Word (.docx)';
    document.getElementById('file-input').value = '';
    document.getElementById('btn-extract').disabled = true;
    goToStep(1);
}

// ─── Pasos ─────────────────────────────────────────────────────────────────────
function goToStep(n) {
    [1, 2, 3].forEach(i => {
        const s = document.getElementById(`step-${i}`);
        const nv = document.getElementById(`step-nav-${i}`);
        s.classList.add('hidden');
        s.classList.remove('active');
        nv.classList.remove('active', 'done');
        if (i < n) {
            nv.classList.add('done');
            nv.querySelector('.step-num').textContent = '✔';
        } else {
            nv.querySelector('.step-num').textContent = i;
        }
    });
    document.getElementById(`step-${n}`).classList.remove('hidden');
    document.getElementById(`step-${n}`).classList.add('active');
    document.getElementById(`step-nav-${n}`).classList.add('active');
}

// ─── Loading ──────────────────────────────────────────────────────────────────
function showLoading(text = 'Procesando...') {
    document.getElementById('loading-text').textContent = text;
    document.getElementById('loading-overlay').classList.remove('hidden');
}
function hideLoading() {
    document.getElementById('loading-overlay').classList.add('hidden');
}

// ─── Toast ────────────────────────────────────────────────────────────────────
let _toastTimer = null;
function showToast(msg, type = 'info') {
    const icons = { success: '✔', error: '✖', info: 'ℹ' };
    const toast = document.getElementById('toast');
    document.getElementById('toast-icon').textContent = icons[type] || 'ℹ';
    document.getElementById('toast-msg').textContent = msg;
    toast.className = `toast toast-${type}`;
    toast.classList.remove('hidden');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => toast.classList.add('hidden'), 4500);
}

// ─── Derivación de Partes ───────────────────────────────────────────────────
function derivePartiesValues() {
    const d = {};

    // Helper para obtener valor de granular
    const g = (id) => document.getElementById(id)?.value?.trim() || '';

    // 1. LOCADOR 1
    const loc1 = {
        trat: g('g-locador-tratamiento'),
        ape: g('g-locador-apellido'),
        nom: g('g-locador-nombres'),
        dni: g('g-locador-dni'),
        cuit: g('g-locador-cuit'),
        nac: g('g-locador-nacimiento'),
        dom: g('g-locador-domicilio'),
        loc: g('g-locador-localidad'),
        prov: g('g-locador-provincia'),
        cp: g('g-locador-cp'),
        email: g('g-locador-email')
    };

    // 2. LOCATARIO 1
    const lcat1 = {
        trat: g('g-locatario1-tratamiento'),
        ape: g('g-locatario1-apellido'),
        nom: g('g-locatario1-nombres'),
        dni: g('g-locatario1-dni'),
        cuit: g('g-locatario1-cuit'),
        nac: g('g-locatario1-nacimiento'),
        domR: g('g-locatario1-domicilio-real'),
        domL: g('g-locatario1-domicilio'),
        loc: g('g-locatario1-localidad'),
        prov: g('g-locatario1-provincia'),
        cp: g('g-locatario1-cp'),
        email: g('g-locatario1-email')
    };

    // 3. LOCATARIO 2
    const hasL2 = document.getElementById('toggle-l2')?.checked;
    let lcat2 = null;
    if (hasL2) {
        lcat2 = {
            trat: g('g-locatario2-tratamiento'),
            ape: g('g-locatario2-apellido'),
            nom: g('g-locatario2-nombres'),
            dni: g('g-locatario2-dni'),
            cuit: g('g-locatario2-cuit'),
            nac: g('g-locatario2-nacimiento'),
            domR: g('g-locatario2-domicilio-real'),
            domL: g('g-locatario2-domicilio'),
            loc: g('g-locatario2-localidad'),
            prov: g('g-locatario2-provincia'),
            cp: g('g-locatario2-cp'),
            email: g('g-locatario2-email')
        };
    }

    // --- Construcción de Strings ---

    // DENOMINACIONES
    d['DENOMINACION_LOCADOR'] = 'EL LOCADOR';
    d['DENOMINACION_LOCATARIO'] = hasL2 ? 'LOS LOCATARIOS' : 'EL LOCATARIO';

    // LOCADOR_1_TEXTO_COMPARECIENTE
    if (loc1.ape || loc1.nom) {
        let txt = `${loc1.trat} ${loc1.nom} ${loc1.ape}`.trim();
        if (loc1.dni) txt += `, DNI N° ${loc1.dni}`;
        if (loc1.cuit) txt += `, CUIT/CUIL N° ${loc1.cuit}`;
        if (loc1.nac) txt += `, nacido el ${loc1.nac}`;
        if (loc1.dom) txt += `, con domicilio legal en ${loc1.dom}`;
        if (loc1.loc) txt += `, ${loc1.loc}`;
        if (loc1.prov) txt += `, ${loc1.prov}`;
        if (loc1.cp) txt += ` (CP ${loc1.cp})`;
        if (loc1.email) txt += `, email ${loc1.email}`;
        d['LOCADOR_1_TEXTO_COMPARECIENTE'] = txt;
    }

    // LOCATARIOS_TEXTO_COMPARECIENTE
    const buildLcat = (l) => {
        let txt = `${l.trat} ${l.nom} ${l.ape}`.trim();
        if (l.dni) txt += `, DNI N° ${l.dni}`;
        if (l.cuit) txt += `, CUIT/CUIL N° ${l.cuit}`;
        if (l.nac) txt += `, nacido el ${l.nac}`;
        if (l.domR) txt += `, con domicilio real en ${l.domR}`;
        if (l.domL) txt += `, con domicilio legal en ${l.domL}`;
        if (l.loc) txt += `, ${l.loc}`;
        if (l.prov) txt += `, ${l.prov}`;
        if (l.cp) txt += ` (CP ${l.cp})`;
        if (l.email) txt += `, email ${l.email}`;
        return txt;
    };

    if (lcat1.ape || lcat1.nom) {
        let txt = buildLcat(lcat1);
        if (lcat2 && (lcat2.ape || lcat2.nom)) {
            txt += ` y ${buildLcat(lcat2)}`;
        }
        d['LOCATARIOS_TEXTO_COMPARECIENTE'] = txt;
    }

    return d;
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function escHtml(str) {
    const d = document.createElement('div');
    d.textContent = String(str ?? '');
    return d.innerHTML;
}
