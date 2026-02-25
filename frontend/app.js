/**
 * AutoContract — JavaScript Principal
 * Gestor Legal Conversacional
 */

// ─── Configuración ──────────────────────────────────────────────────────────
const API_BASE = '';

// ─── Estado Global ───────────────────────────────────────────────────────────
const state = {
  contractTemplate: '',
  variables: [],
  collectedData: {},
  chatHistory: [],
  currentStep: 1,
  isTyping: false,
  allVariablesComplete: false,
};

// Función global: habilita/deshabilita el botón Analizar según el contenido
function checkAnalyzeBtn() {
  const textarea = document.getElementById('contract-input');
  const btn = document.getElementById('btn-analyze');
  const len = textarea ? textarea.value.trim().length : 0;
  if (btn) {
    btn.disabled = len < 50;
    document.getElementById('char-count').textContent = textarea.value.length.toLocaleString();
  }
}

// ─── DOM refs & Utils ────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

/**
 * Escapa caracteres HTML de forma segura.
 * Acepta strings, números, null o undefined.
 */
function escapeHtml(text) {
  if (text === null || text === undefined) return "";
  const str = String(text);
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─── Init ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initSplash();
  initFileUpload();
  initTextarea();
  initButtons();
  initChatInput();
  checkApiStatus();
});

// ─── Splash ──────────────────────────────────────────────────────────────────
function initSplash() {
  setTimeout(() => {
    const splash = $('splash');
    const app = $('app');
    splash.classList.add('fade-out');
    setTimeout(() => {
      splash.style.display = 'none';
      app.classList.remove('hidden');
    }, 600);
  }, 2200);
}

// ─── API Status ───────────────────────────────────────────────────────────────
async function checkApiStatus() {
  const statusEl = $('api-status');
  const textEl = $('api-status-text');
  try {
    const res = await fetch(`${API_BASE}/`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      statusEl.classList.add('online');
      textEl.textContent = 'API conectada';
    } else {
      throw new Error();
    }
  } catch {
    statusEl.classList.add('offline');
    textEl.textContent = 'API desconectada';
  }
}

// ─── File Upload ─────────────────────────────────────────────────────────────
function initFileUpload() {
  const zone = $('upload-zone');
  const fileInput = $('file-input');
  const textarea = $('contract-input');

  zone.addEventListener('click', () => fileInput.click());

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) readFile(file, zone, textarea);
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) readFile(file, zone, textarea);
  });
}

function readFile(file, zone, textarea) {
  if (!file.name.endsWith('.txt') && file.type !== 'text/plain') {
    showToast('Solo se aceptan archivos .txt', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    textarea.value = text;
    updateCharCount(text.length);
    zone.classList.add('has-file');
    zone.querySelector('.upload-text').textContent = `✓ ${file.name} cargado`;
    zone.querySelector('.upload-sub').textContent = `${text.length.toLocaleString()} caracteres`;
    $('btn-analyze').disabled = text.trim().length < 50;
    showToast(`Archivo "${file.name}" cargado correctamente`, 'success');
  };
  reader.readAsText(file, 'UTF-8');
}

// ─── Textarea ─────────────────────────────────────────────────────────────────
function initTextarea() {
  const textarea = $('contract-input');
  const btn = $('btn-analyze');

  function checkContent() {
    updateCharCount(textarea.value.length);
    btn.disabled = textarea.value.trim().length < 50;
  }

  textarea.addEventListener('input', checkContent);
  textarea.addEventListener('keyup', checkContent);

  // Al pegar con Ctrl+V el texto llega después del evento paste,
  // por eso esperamos un tick antes de verificar el contenido
  textarea.addEventListener('paste', () => {
    setTimeout(checkContent, 50);
  });
}

function updateCharCount(n) {
  $('char-count').textContent = n.toLocaleString();
}

// ─── Botones principales ──────────────────────────────────────────────────────
function initButtons() {
  $('btn-analyze').addEventListener('click', handleAnalyze);
  $('btn-back-1').addEventListener('click', () => goToStep(1));
  $('btn-confirm-vars').addEventListener('click', handleConfirmVariables);
  $('btn-download-docx').addEventListener('click', handleDownloadDocx);
  $('btn-copy-text').addEventListener('click', handleCopyText);
  $('btn-new-contract').addEventListener('click', handleNewContract);
  $('btn-reset').addEventListener('click', handleReset);
}

// ─── Paso 1 → 2: Analizar contrato ───────────────────────────────────────────
async function handleAnalyze() {
  const text = $('contract-input').value.trim();
  if (!text || text.length < 50) return;

  state.contractTemplate = text;
  showLoading('Analizando el contrato con IA...');

  try {
    const res = await fetch(`${API_BASE}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contract_text: text }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Error en el análisis');
    }

    const data = await res.json();
    state.variables = data.variables;

    hideLoading();
    renderVariables(data.variables, data.analysis_notes);
    goToStep(2);

  } catch (err) {
    hideLoading();
    showToast(`Error: ${err.message}`, 'error');
  }
}

// Función para renderizar la lista de variables en el Paso 2
function renderVariables(variables, notes) {
  const list = $('variables-list');
  const notesEl = $('analysis-notes');

  if (notes) {
    notesEl.textContent = `💡 ${notes}`;
    notesEl.classList.remove('hidden');
  } else {
    notesEl.classList.add('hidden');
  }

  list.innerHTML = '';

  if (!variables || variables.length === 0) {
    list.innerHTML = `
      <div style="text-align:center;padding:2rem;color:var(--text-muted)">
        <p>⚠️ No se detectaron variables en el contrato.</p>
        <p style="font-size:0.8rem;margin-top:0.5rem">Intente marcar los campos con [CORCHETES] si la IA no los reconoce automáticamente.</p>
      </div>`;
    $('btn-confirm-vars').disabled = true;
    return;
  }

  $('btn-confirm-vars').disabled = false;

  variables.forEach((v, i) => {
    const card = document.createElement('div');
    card.className = 'variable-card';
    card.style.animationDelay = `${i * 50}ms`;

    // Contenido de la tarjeta
    card.innerHTML = `
      <div class="var-type-container">
        <span class="var-type-badge var-type-${v.type || 'texto'}">${v.type || 'texto'}</span>
      </div>
      <div class="var-info">
        <div class="var-label">${v.label || 'Campo'}</div>
        <div class="var-placeholder">${escapeHtml(v.placeholder_text || '')}</div>
        ${v.description ? `<div class="var-desc">${escapeHtml(v.description)}</div>` : ''}
      </div>
      <button class="btn-remove-var" onclick="handleRemoveVar(${i})" title="Quitar este campo (fijo)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
      </button>
    `;
    list.appendChild(card);
  });

  updateProgressStats(variables.length, 0);
}

// Función para manejar el borrado de una variable
window.handleRemoveVar = function (index) {
  state.variables.splice(index, 1);
  renderVariables(state.variables, null);
  showToast('Campo marcado como fijo (no se preguntará)', 'info');
};

// ─── Paso 2 → 3: Confirmar y comenzar entrevista ──────────────────────────────
async function handleConfirmVariables() {
  if (state.variables.length === 0) return;

  goToStep(3);
  await startInterview();
}

async function startInterview() {
  const messagesEl = $('chat-messages');
  messagesEl.innerHTML = '';
  state.chatHistory = [];
  state.collectedData = {};

  // Mensaje de bienvenida del bot
  const welcome = `¡Bienvenido! Soy su asistente legal. En los próximos minutos le haré una serie de preguntas para completar su contrato de alquiler.

He identificado **${state.variables.length} campo(s)** que necesita completar. Responda con precisión, ya que cada dato será insertado exactamente en el documento legal.

Comencemos.`;

  addBotMessage(welcome);
  state.chatHistory.push({ role: 'assistant', content: welcome });

  // Primera pregunta
  await sendToBotApi();
}

// ─── Chat ─────────────────────────────────────────────────────────────────────
function initChatInput() {
  const input = $('chat-input');
  const btnSend = $('btn-send');

  btnSend.addEventListener('click', handleUserSend);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleUserSend();
    }
  });
}

async function handleUserSend() {
  const input = $('chat-input');
  const text = input.value.trim();
  if (!text || state.isTyping) return;

  input.value = '';
  addUserMessage(text);
  state.chatHistory.push({ role: 'user', content: text });

  await sendToBotApi();
}

async function sendToBotApi() {
  setInputEnabled(false);
  showTypingIndicator();
  state.isTyping = true;

  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: state.chatHistory,
        variables: state.variables,
        collected_data: state.collectedData,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Error en el servidor');
    }

    const data = await res.json();

    removeTypingIndicator();

    addBotMessage(data.reply);
    state.chatHistory.push({ role: 'assistant', content: data.reply });
    state.collectedData = data.collected_data;

    // Actualizar progreso
    const done = Object.keys(state.collectedData).filter(k => state.collectedData[k]).length;
    updateProgressStats(state.variables.length, done);
    updateCompletedVarsSidebar();

    if (data.is_complete) {
      state.allVariablesComplete = true;
      setTimeout(() => handleGenerateContract(), 1500);
    } else {
      setInputEnabled(true);
      $('chat-input').focus();
    }

  } catch (err) {
    removeTypingIndicator();
    addBotMessage(`Lo siento, ha ocurrido un error: ${err.message}. Por favor, intente nuevamente.`);
    setInputEnabled(true);
  }

  state.isTyping = false;
}

// ─── Mensajes del chat ────────────────────────────────────────────────────────
function addBotMessage(text) {
  const container = $('chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-msg bot';
  div.innerHTML = `
    <div class="msg-avatar">⚖️</div>
    <div class="msg-bubble">${formatMessage(text)}</div>
  `;
  container.appendChild(div);
  scrollToBottom();
}

function addUserMessage(text) {
  const container = $('chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-msg user';
  div.innerHTML = `
    <div class="msg-avatar">👤</div>
    <div class="msg-bubble">${escapeHtml(text)}</div>
  `;
  container.appendChild(div);
  scrollToBottom();
}

function formatMessage(text) {
  // Convertir **bold** y saltos de línea
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}


function showTypingIndicator() {
  const container = $('chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-msg bot';
  div.id = 'typing-indicator';
  div.innerHTML = `
    <div class="msg-avatar">⚖️</div>
    <div class="msg-bubble">
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
  `;
  container.appendChild(div);
  scrollToBottom();
}

function removeTypingIndicator() {
  const el = $('typing-indicator');
  if (el) el.remove();
}

function scrollToBottom() {
  const container = $('chat-messages');
  setTimeout(() => {
    container.scrollTop = container.scrollHeight;
  }, 50);
}

function setInputEnabled(enabled) {
  $('chat-input').disabled = !enabled;
  $('btn-send').disabled = !enabled;
}

// ─── Paso 3 → 4: Generar contrato ────────────────────────────────────────────
async function handleGenerateContract() {
  showLoading('Generando el contrato final...');

  try {
    const res = await fetch(`${API_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contract_template: state.contractTemplate,
        variables: state.variables,
        collected_data: state.collectedData,
      }),
    });

    if (!res.ok) throw new Error('Error al generar el contrato');

    const data = await res.json();
    hideLoading();

    $('contract-preview').textContent = data.contract_preview;

    // Progreso 100%
    updateProgressStats(state.variables.length, state.variables.length);
    goToStep(4);
    showToast(`¡Contrato completado! ${data.variables_applied} variables aplicadas.`, 'success');

  } catch (err) {
    hideLoading();
    showToast(`Error: ${err.message}`, 'error');
  }
}

// ─── Descarga DOCX ───────────────────────────────────────────────────────────
async function handleDownloadDocx() {
  const btn = $('btn-download-docx');
  btn.disabled = true;
  btn.querySelector('.btn-export-title').textContent = 'Generando...';

  try {
    const res = await fetch(`${API_BASE}/api/export-docx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contract_template: state.contractTemplate,
        variables: state.variables,
        collected_data: state.collectedData,
      }),
    });

    if (!res.ok) throw new Error('Error al generar el DOCX');

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contrato_alquiler_${new Date().toISOString().slice(0, 10)}.docx`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('Documento DOCX descargado correctamente', 'success');

  } catch (err) {
    showToast(`Error al descargar: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.querySelector('.btn-export-title').textContent = 'Descargar .DOCX';
  }
}

// ─── Copiar texto ─────────────────────────────────────────────────────────────
async function handleCopyText() {
  const text = $('contract-preview').textContent;
  try {
    await navigator.clipboard.writeText(text);
    showToast('Texto copiado al portapapeles', 'success');
  } catch {
    showToast('No se pudo copiar el texto', 'error');
  }
}

// ─── Nuevo contrato (misma plantilla) ────────────────────────────────────────
function handleNewContract() {
  state.collectedData = {};
  state.chatHistory = [];
  state.allVariablesComplete = false;
  goToStep(2);
  renderVariables(state.variables, null);
}

// ─── Reset total ──────────────────────────────────────────────────────────────
function handleReset() {
  if (!confirm('¿Desea reiniciar y comenzar un nuevo contrato desde cero?')) return;

  state.contractTemplate = '';
  state.variables = [];
  state.collectedData = {};
  state.chatHistory = [];
  state.allVariablesComplete = false;

  $('contract-input').value = '';
  $('char-count').textContent = '0';
  $('btn-analyze').disabled = true;
  $('upload-zone').classList.remove('has-file');
  $('upload-zone').querySelector('.upload-text').innerHTML = 'Arrastre un archivo <strong>.txt</strong> aquí';
  $('upload-zone').querySelector('.upload-sub').textContent = 'o haga clic para seleccionar';
  $('file-input').value = '';

  updateProgressStats(0, 0, true);
  $('completed-vars-card').style.display = 'none';

  goToStep(1);
}

// ─── Navegación entre pasos ───────────────────────────────────────────────────
function goToStep(step) {
  // Ocultar todos los pasos
  for (let i = 1; i <= 4; i++) {
    const el = $(`step-${i}`);
    if (el) {
      el.classList.add('hidden');
      el.classList.remove('active');
    }
    const nav = $(`step-nav-${i}`);
    if (nav) {
      nav.classList.remove('active', 'done');
      if (i < step) nav.classList.add('done');
    }
  }

  // Mostrar paso actual
  const current = $(`step-${step}`);
  if (current) {
    current.classList.remove('hidden');
    current.classList.add('active');
  }

  const currentNav = $(`step-nav-${step}`);
  if (currentNav) currentNav.classList.add('active');

  state.currentStep = step;

  // Marcar como completados los anteriores
  for (let i = 1; i < step; i++) {
    const nav = $(`step-nav-${i}`);
    if (nav) {
      nav.classList.remove('active');
      nav.classList.add('done');
      const numEl = nav.querySelector('.step-num');
      if (numEl) numEl.textContent = '✓';
    }
  }
}

// ─── Progreso ─────────────────────────────────────────────────────────────────
function updateProgressStats(total, done, reset = false) {
  if (reset) {
    $('stat-total').textContent = '—';
    $('stat-done').textContent = '—';
    $('stat-pending').textContent = '—';
    $('progress-pct').textContent = '0%';
    setProgressRing(0);
    return;
  }

  const pending = total - done;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  $('stat-total').textContent = total;
  $('stat-done').textContent = done;
  $('stat-pending').textContent = pending;
  $('progress-pct').textContent = `${pct}%`;
  setProgressRing(pct);
}

function setProgressRing(pct) {
  const circle = $('progress-circle');
  const circumference = 2 * Math.PI * 40; // r=40
  const offset = circumference - (pct / 100) * circumference;
  circle.style.strokeDashoffset = offset;
  circle.style.strokeDasharray = circumference;

  // Color dinámico
  if (pct === 100) {
    circle.style.stroke = '#34d399';
  } else if (pct > 50) {
    circle.style.stroke = '#6366f1';
  } else {
    circle.style.stroke = '#8b5cf6';
  }
}

function updateCompletedVarsSidebar() {
  const card = $('completed-vars-card');
  const list = $('completed-vars-list');

  const entries = Object.entries(state.collectedData).filter(([, v]) => v);

  if (entries.length === 0) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';
  list.innerHTML = '';

  entries.forEach(([key, val], i) => {
    const varInfo = state.variables.find(v => v.key === key);
    const label = varInfo ? varInfo.label : key;

    const div = document.createElement('div');
    div.className = 'completed-var-item';
    div.style.animationDelay = `${i * 40}ms`;
    div.innerHTML = `
      <div class="completed-var-key">${label}</div>
      <div class="completed-var-val">${escapeHtml(String(val))}</div>
    `;
    list.appendChild(div);
  });
}

// ─── Loading overlay ──────────────────────────────────────────────────────────
function showLoading(text = 'Procesando...') {
  $('loading-text').textContent = text;
  $('loading-overlay').classList.remove('hidden');
}

function hideLoading() {
  $('loading-overlay').classList.add('hidden');
}

// ─── Toast ────────────────────────────────────────────────────────────────────
let toastTimer = null;

function showToast(msg, type = 'info') {
  const toast = $('toast');
  const icon = $('toast-icon');
  const msgEl = $('toast-msg');

  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  icon.textContent = icons[type] || 'ℹ';
  msgEl.textContent = msg;

  toast.className = `toast toast-${type}`;
  toast.classList.remove('hidden');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 4000);
}

// ─── Inject SVG gradient for progress ring ───────────────────────────────────
(function injectSvgDefs() {
  const svg = document.querySelector('.progress-ring');
  if (svg) {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#6366f1"/>
        <stop offset="100%" stop-color="#8b5cf6"/>
      </linearGradient>
    `;
    svg.insertBefore(defs, svg.firstChild);
  }
})();
