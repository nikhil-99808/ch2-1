const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const DEFAULT_PROCESSES = [
  { pid: 'P1', activity: 'Student Login', arrival: 0, burst: 5 },
  { pid: 'P2', activity: 'Load Question / Paper', arrival: 0, burst: 4 },
  { pid: 'P3', activity: 'Save Answers', arrival: 0, burst: 3 },
  { pid: 'P4', activity: 'Submit Examination', arrival: 0, burst: 2 },
  { pid: 'P5', activity: 'Generate Result', arrival: 0, burst: 4 },
];
const palette = ['#79b2ff', '#b09bff', '#6ed7b2', '#ffbd80', '#e28cb2', '#79d0d8', '#c2d17c'];
let processes = DEFAULT_PROCESSES.map(p => ({ ...p }));
let lastResult = null;
let toastTimer = null;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function safeText(text) {
  return escapeHtml(text).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`(.*?)`/g, '<code>$1</code>').replace(/\n/g, '<br>');
}
function notify(message, type = 'success') {
  const toast = $('#toast');
  toast.textContent = message;
  toast.className = `toast show ${type === 'error' ? 'error' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = 'toast'; }, 3400);
}
async function api(url, options = {}) {
  const response = await fetch(url, options);
  let data;
  try { data = await response.json(); } catch { data = {}; }
  if (!response.ok) throw new Error(data.detail || data.message || `Request failed (${response.status})`);
  return data;
}
function goTo(page) {
  $$('.page').forEach(node => node.classList.toggle('active', node.id === `page-${page}`));
  $$('.nav-item').forEach(node => node.classList.toggle('active', node.dataset.page === page));
  const labels = { dashboard: 'Overview', simulator: 'CPU Simulator', tutor: 'AI Tutor', knowledge: 'Knowledge Base' };
  $('#crumb-current').textContent = labels[page] || 'Overview';
  if (page === 'knowledge') loadDocuments();
  if (page === 'tutor') $('#chat-input').focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
$$('[data-page]').forEach(btn => btn.addEventListener('click', () => goTo(btn.dataset.page)));
$$('[data-goto]').forEach(btn => btn.addEventListener('click', () => goTo(btn.dataset.goto)));

function colorFor(pid) {
  let hash = 0;
  for (const ch of String(pid)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}
function renderProcesses() {
  $('#process-count').textContent = `${processes.length} process${processes.length === 1 ? '' : 'es'}`;
  $('#process-table-body').innerHTML = processes.map((p, index) => `
    <tr><td><span class="pid-cell"><i class="pid-bullet" style="background:${colorFor(p.pid)}"></i><span>${escapeHtml(p.pid)}</span><span style="color:#7587a1;font:9px Manrope">${escapeHtml(p.activity)}</span></span></td>
    <td>${p.arrival}</td><td>${p.burst}</td><td><button class="remove-process" data-remove="${index}" title="Remove ${escapeHtml(p.pid)}" aria-label="Remove ${escapeHtml(p.pid)}">×</button></td></tr>`).join('');
  $$('[data-remove]').forEach(btn => btn.addEventListener('click', () => {
    processes.splice(Number(btn.dataset.remove), 1);
    renderProcesses();
    $('#results-area').classList.add('hidden');
  }));
}
$('#process-form').addEventListener('submit', event => {
  event.preventDefault();
  const pid = $('#new-pid').value.trim();
  const activity = $('#new-activity').value.trim();
  const arrival = Number($('#new-arrival').value);
  const burst = Number($('#new-burst').value);
  if (!pid || !Number.isFinite(arrival) || arrival < 0 || !Number.isFinite(burst) || burst <= 0) return notify('Enter a process ID, a non-negative arrival, and a positive burst.', 'error');
  if (processes.some(p => p.pid === pid)) return notify('Process IDs must be unique.', 'error');
  if (processes.length >= 50) return notify('The simulator supports up to 50 processes.', 'error');
  processes.push({ pid, activity: activity || `Process ${pid}`, arrival, burst });
  $('#new-pid').value = `P${processes.length + 1}`;
  $('#new-activity').value = '';
  $('#new-burst').value = '3';
  renderProcesses();
  $('#results-area').classList.add('hidden');
});
$('#reset-sim').addEventListener('click', () => {
  processes = DEFAULT_PROCESSES.map(p => ({ ...p }));
  $('#quantum').value = '2';
  $('#new-pid').value = 'P6';
  renderProcesses();
  $('#results-area').classList.add('hidden');
  lastResult = null;
  notify('Original five-process example restored.');
});

$('#run-sim').addEventListener('click', runSimulation);
async function runSimulation() {
  const button = $('#run-sim');
  const quantum = Number($('#quantum').value);
  if (!processes.length) return notify('Add at least one process first.', 'error');
  if (!Number.isFinite(quantum) || quantum <= 0) return notify('Time quantum must be greater than zero.', 'error');
  button.disabled = true; button.innerHTML = '<span>◌</span> Running simulation…';
  try {
    const result = await api('/api/schedule/run', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ processes, quantum })
    });
    lastResult = result;
    renderResults(result);
    $('#results-area').classList.remove('hidden');
    setTimeout(() => $('#results-area').scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  } catch (error) { notify(error.message, 'error'); }
  finally { button.disabled = false; button.innerHTML = '<span>▶</span> Run Round Robin simulation'; }
}
function renderResults(result) {
  const cards = [
    ['AVG WAITING TIME', result.averages.waiting, 'ms', 'Average time spent waiting'],
    ['AVG TURNAROUND', result.averages.turnaround, 'ms', 'Arrival to completion'],
    ['AVG RESPONSE', result.averages.response, 'ms', 'Time until first CPU access'],
    ['CPU UTILIZATION', result.cpu_utilization, '%', `${result.total_busy} ms busy · ${result.makespan} ms elapsed`],
  ];
  $('#result-kpis').innerHTML = cards.map(([label, value, unit, detail]) => `<div class="result-kpi"><span>${label}</span><strong>${value}<small> ${unit}</small></strong><small>${detail}</small></div>`).join('');
  $('#gantt-chart').innerHTML = result.gantt.map((step, i) => {
    const color = step.idle ? '#53647d' : colorFor(step.pid);
    const background = step.idle ? '#263144' : `${color}36`;
    const border = step.idle ? '#687a92' : `${color}b0`;
    return `<div class="gantt-block ${step.idle ? 'idle' : ''}" style="--duration:${Number(step.duration)};background:${background};border-color:${border}" title="${escapeHtml(step.pid)} · ${step.start}–${step.end} ms"><strong>${escapeHtml(step.pid)}</strong><small>${step.start}–${step.end}</small></div>`;
  }).join('');
  const end = Number(result.makespan);
  const tickCount = 5;
  $('#gantt-scale').innerHTML = Array.from({ length: tickCount + 1 }, (_, i) => `<span>${Number((end * i / tickCount).toFixed(2))}</span>`).join('');
  $('#metrics-body').innerHTML = result.results.map(row => `<tr><td>${escapeHtml(row.pid)}</td><td>${row.arrival}</td><td>${row.burst}</td><td>${row.completion}</td><td>${row.turnaround}</td><td>${row.waiting}</td><td>${row.response}</td></tr>`).join('');
  $('#execution-log').innerHTML = result.execution_log.map(row => `<div class="log-item"><span class="log-index">${String(row.turn).padStart(2, '0')}</span><span class="log-desc"><strong>${escapeHtml(row.pid)}</strong> · ${row.status.toLowerCase()} · remaining ${row.remaining} ms</span><span class="log-time">${row.start}–${row.end}</span></div>`).join('');
}
$('#print-report').addEventListener('click', () => window.print());

async function loadDashboard() {
  try {
    const data = await api('/api/dashboard');
    $('#stat-docs').textContent = data.document_count;
    $('#stat-chunks').textContent = data.chunk_count;
    $('#stat-model').textContent = data.groq_configured ? 'Groq Ready' : 'Groq AI';
    $('#stat-model-foot').textContent = data.groq_configured ? data.model : 'Add GROQ_API_KEY in .env';
    const status = $('#api-status');
    if (data.groq_configured) {
      status.innerHTML = `<span class="status-dot"></span><span>AI connected · ${escapeHtml(data.model)}</span>`;
      $('#tutor-status-dot').classList.remove('muted'); $('#tutor-status-text').textContent = 'Ready to help';
    } else {
      status.innerHTML = '<span class="status-dot muted"></span><span>AI key not configured</span>';
      $('#tutor-status-dot').classList.add('muted'); $('#tutor-status-text').textContent = 'Add your Groq API key';
    }
    $('#upload-count').textContent = `${data.document_count} indexed`;
    $('#stat-docs').textContent = data.document_count;
    $('#stat-chunks').textContent = data.chunk_count;
    renderDocuments(data.documents);
  } catch (error) {
    $('#api-status').innerHTML = '<span class="status-dot muted"></span><span>Backend unavailable</span>';
    notify(`Cannot connect to the backend: ${error.message}`, 'error');
  }
}

function appendMessage(role, text, sources = []) {
  const container = $('#chat-messages');
  const item = document.createElement('div');
  item.className = `chat-message ${role}`;
  const name = role === 'assistant' ? 'EXAMSCHEDULER AI' : 'YOU';
  item.innerHTML = `<div class="message-avatar">${role === 'assistant' ? '✳' : 'U'}</div><div class="message-body"><div class="message-meta">${name} <span>JUST NOW</span></div><div class="message-text">${safeText(text)}</div>${sources.length ? `<div class="source-chips">${sources.map(s => `<span class="source-chip">${escapeHtml(s.filename)} · chunk ${s.chunk_index}</span>`).join('')}</div>` : ''}</div>`;
  container.appendChild(item);
  container.scrollTop = container.scrollHeight;
}
$('#chat-form').addEventListener('submit', async event => {
  event.preventDefault();
  const input = $('#chat-input');
  const question = input.value.trim();
  if (!question) return;
  appendMessage('user', question);
  input.value = '';
  const send = $('#send-chat'); send.disabled = true; send.textContent = '…';
  const loading = document.createElement('div');
  loading.className = 'chat-message assistant';
  loading.id = 'ai-loading';
  loading.innerHTML = '<div class="message-avatar">✳</div><div class="message-body"><div class="message-meta">EXAMSCHEDULER AI</div><div class="message-text">Searching your notes and generating an answer…</div></div>';
  $('#chat-messages').appendChild(loading); $('#chat-messages').scrollTop = $('#chat-messages').scrollHeight;
  try {
    const data = await api('/api/ai/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, top_k: 5 }) });
    loading.remove();
    appendMessage('assistant', data.answer, data.sources || []);
    renderLastSources(data.sources || []);
  } catch (error) {
    loading.remove(); appendMessage('assistant', `I couldn't complete that request. ${error.message}`);
    notify(error.message, 'error');
  } finally { send.disabled = false; send.textContent = '↑'; }
});
$$('[data-question]').forEach(btn => btn.addEventListener('click', () => {
  $('#chat-input').value = btn.dataset.question;
  $('#chat-form').requestSubmit();
}));
function renderLastSources(sources) {
  const box = $('#last-sources');
  if (!sources.length) { box.innerHTML = '<span class="empty-sources">No matching document chunks were found. Add more files to expand the reference context.</span>'; return; }
  box.innerHTML = sources.map(s => `<div class="last-source">${escapeHtml(s.filename)}<small>Chunk ${s.chunk_index} · relevance ${s.score}</small></div>`).join('');
}

$('#generate-quiz').addEventListener('click', async () => {
  const button = $('#generate-quiz');
  const topic = $('#quiz-topic').value.trim() || 'Round Robin CPU scheduling';
  button.disabled = true; button.textContent = 'Generating questions…';
  try {
    const data = await api('/api/ai/quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic, count: 5 }) });
    renderQuiz(data.questions || []);
    $('#quiz-results').classList.remove('hidden');
    $('#quiz-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) { notify(error.message, 'error'); }
  finally { button.disabled = false; button.innerHTML = 'Generate practice set <span>→</span>'; }
});
function renderQuiz(questions) {
  const container = $('#quiz-results');
  container.innerHTML = `<div class="section-top"><div><span class="section-index">04</span><h3>Viva practice set</h3></div><span class="muted-copy">Select an option to check your answer</span></div>` + questions.map((q, i) => `
    <article class="quiz-question" data-quiz="${i}"><h4>${i + 1}. ${escapeHtml(q.question)}</h4><div class="quiz-options">${(q.options || []).map((option, j) => `<button class="quiz-option" data-option="${j}">${String.fromCharCode(65 + j)}. ${escapeHtml(option)}</button>`).join('')}</div><p class="quiz-explanation hidden">${escapeHtml(q.explanation || '')}</p></article>`).join('');
  questions.forEach((q, i) => {
    const card = $(`[data-quiz="${i}"]`, container);
    $$('[data-option]', card).forEach(btn => btn.addEventListener('click', () => {
      const selected = q.options[Number(btn.dataset.option)];
      const correct = selected === q.answer;
      $$('[data-option]', card).forEach(option => {
        option.disabled = true;
        if (option.textContent.slice(3) === q.answer) option.classList.add('correct');
        else if (option === btn && !correct) option.classList.add('wrong');
      });
      $('.quiz-explanation', card).classList.remove('hidden');
      $('.quiz-explanation', card).textContent = `${correct ? 'Correct.' : `Not quite. Correct answer: ${q.answer}.`} ${q.explanation || ''}`;
    }));
  });
}

const fileInput = $('#file-input');
fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  $('#selected-file').textContent = file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB` : 'No file selected';
  $('#upload-btn').disabled = !file;
});
const dropZone = $('.drop-zone');
dropZone.addEventListener('dragover', event => { event.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', event => {
  event.preventDefault(); dropZone.classList.remove('dragover');
  const file = event.dataTransfer.files[0];
  if (!file) return;
  const transfer = new DataTransfer(); transfer.items.add(file); fileInput.files = transfer.files; fileInput.dispatchEvent(new Event('change'));
});
$('#upload-form').addEventListener('submit', async event => {
  event.preventDefault();
  const file = fileInput.files[0]; if (!file) return;
  const button = $('#upload-btn'); button.disabled = true; button.textContent = 'Indexing…';
  const form = new FormData(); form.append('file', file);
  try {
    const result = await api('/api/knowledge/upload', { method: 'POST', body: form });
    notify(`${result.document.filename} indexed into ${result.document.chunk_count} chunks.`);
    fileInput.value = ''; $('#selected-file').textContent = 'No file selected';
    await loadDocuments(); await loadDashboard();
  } catch (error) { notify(error.message, 'error'); }
  finally { button.disabled = !fileInput.files[0]; button.textContent = 'Upload & index'; }
});
async function loadDocuments() {
  try {
    const data = await api('/api/knowledge');
    renderDocuments(data.documents || []);
    $('#upload-count').textContent = `${data.document_count} indexed`;
  } catch (error) { notify(error.message, 'error'); }
}
function renderDocuments(documents) {
  const list = $('#documents-list');
  $('#upload-count').textContent = `${documents.length} indexed`;
  if (!documents.length) { list.innerHTML = '<div class="empty-documents">No documents yet. Upload a source file to build your RAG knowledge base.</div>'; return; }
  list.innerHTML = documents.map(doc => {
    const ext = (doc.filename.split('.').pop() || 'FILE').slice(0, 4).toUpperCase();
    const date = new Date(doc.uploaded_at).toLocaleDateString();
    return `<article class="document-card"><div class="file-icon">${escapeHtml(ext)}</div><div class="document-meta"><strong>${escapeHtml(doc.filename)}</strong><small>${doc.char_count.toLocaleString()} characters · Added ${date}</small></div><span class="doc-chunks">${doc.chunk_count} chunks</span><button class="delete-doc" data-delete-doc="${doc.id}" aria-label="Delete ${escapeHtml(doc.filename)}" title="Remove source">×</button></article>`;
  }).join('');
  $$('[data-delete-doc]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('Remove this document and its indexed chunks from the knowledge base?')) return;
    try { await api(`/api/knowledge/${btn.dataset.deleteDoc}`, { method: 'DELETE' }); notify('Document removed.'); await loadDocuments(); await loadDashboard(); }
    catch (error) { notify(error.message, 'error'); }
  }));
}

renderProcesses();
loadDashboard();
