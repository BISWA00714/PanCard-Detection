/* ── State ── */
let selectedFile = null;
let history = JSON.parse(localStorage.getItem('panHistory') || '[]');
let totalScans = parseInt(localStorage.getItem('totalScans') || '0');
let successScans = parseInt(localStorage.getItem('successScans') || '0');
let currentResultUrl = '';

/* ── DOM ── */
const fileInput   = document.getElementById('fileInput');
const dropZone    = document.getElementById('dropZone');
const dzInner     = document.getElementById('dzInner');
const dzTitle     = document.getElementById('dzTitle');
const dzPreview   = document.getElementById('dzPreview');
const previewThumb= document.getElementById('previewThumb');
const detectBtn   = document.getElementById('detectBtn');
const btnLabel    = document.getElementById('btnLabel');
const btnSpinner  = document.getElementById('btnSpinner');
const fileMeta    = document.getElementById('fileMeta');
const fmName      = document.getElementById('fmName');
const fmSize      = document.getElementById('fmSize');
const errorBox    = document.getElementById('errorBox');
const errorText   = document.getElementById('errorText');
const resultEmpty = document.getElementById('resultEmpty');
const resultContent= document.getElementById('resultContent');
const resultImg   = document.getElementById('resultImg');
const statusRow   = document.getElementById('statusRow');
const confPct     = document.getElementById('confPct');
const confValTxt  = document.getElementById('confValTxt');
const confFill    = document.getElementById('confFill');
const confArc     = document.getElementById('confArc');
const statsGrid   = document.getElementById('statsGrid');
const scanProgress= document.getElementById('scanProgress');
const scanFill    = document.getElementById('scanFill');
const scanLabel   = document.getElementById('scanLabel');

/* ── Init ── */
updateNavStats();
renderHistory();
initParticles();

/* ── Particles ── */
function initParticles() {
  const canvas = document.getElementById('particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const pts = Array.from({length: 60}, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: (Math.random() - 0.5) * 0.4,
    vy: (Math.random() - 0.5) * 0.4,
    r: Math.random() * 1.5 + 0.5,
    a: Math.random()
  }));
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pts.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;
      p.a += 0.005;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(108,99,255,' + (0.15 + 0.1 * Math.sin(p.a)) + ')';
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });
}

/* ── Drag & Drop ── */
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const f = e.dataTransfer.files[0];
  if (f && f.type.startsWith('image/')) applyFile(f);
});
fileInput.addEventListener('change', () => { if (fileInput.files[0]) applyFile(fileInput.files[0]); });

function applyFile(file) {
  selectedFile = file;
  dropZone.classList.add('has-file');
  dzTitle.textContent = '✓  ' + file.name;
  const reader = new FileReader();
  reader.onload = ev => {
    previewThumb.src = ev.target.result;
    dzInner.hidden = true;
    dzPreview.hidden = false;
  };
  reader.readAsDataURL(file);
  fmName.textContent = file.name;
  fmSize.textContent = formatSize(file.size);
  fileMeta.hidden = false;
  detectBtn.disabled = false;
  hideError();
  resultContent.hidden = true;
  resultEmpty.hidden = false;
}

/* ── Detection ── */
async function runDetection() {
  if (!selectedFile) return;
  setLoading(true);
  hideError();
  startScanAnim();
  try {
    const fd = new FormData();
    fd.append('file', selectedFile);
    const res = await fetch('/detect', { method: 'POST', body: fd });
    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.error || 'Server error ' + res.status); }
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    renderResults(data);
    totalScans++;
    if (data.detected) successScans++;
    localStorage.setItem('totalScans', totalScans);
    localStorage.setItem('successScans', successScans);
    addHistory(selectedFile.name, data);
    updateNavStats();
    showToast(data.detected ? '✅ PAN Card detected!' : '❌ Not a PAN Card', data.detected ? 'success' : 'error');
  } catch (err) {
    showError(err.message || 'Detection failed. Please try again.');
    showToast('⚠️ ' + (err.message || 'Detection failed'), 'error');
  } finally {
    setLoading(false);
    stopScanAnim();
  }
}

/* ── Scan Animation ── */
let scanTimer = null;
let scanPct = 0;
const scanMsgs = ['Initializing model…','Loading image…','Running inference…','Applying validation…','Generating result…'];
function startScanAnim() {
  scanProgress.hidden = false;
  scanPct = 0;
  let msgIdx = 0;
  scanFill.style.width = '0%';
  scanLabel.textContent = scanMsgs[0];
  scanTimer = setInterval(() => {
    scanPct = Math.min(scanPct + Math.random() * 8, 90);
    scanFill.style.width = scanPct + '%';
    msgIdx = Math.min(Math.floor(scanPct / 20), scanMsgs.length - 1);
    scanLabel.textContent = scanMsgs[msgIdx];
  }, 300);
}
function stopScanAnim() {
  clearInterval(scanTimer);
  scanFill.style.width = '100%';
  setTimeout(() => { scanProgress.hidden = true; scanPct = 0; }, 600);
}

/* ── Render Results ── */
function renderResults(data) {
  const pct = (data.confidence * 100).toFixed(1);
  const detected = data.detected;
  const msg = data.message || '';
  currentResultUrl = data.image_url + '?t=' + Date.now();
  resultImg.src = currentResultUrl;
  statusRow.innerHTML = detected
    ? '<div class="status-chip ok"><span class="chip-dot ok"></span> PAN Card Detected</div><div class="status-msg ok-msg">' + msg + '</div>'
    : '<div class="status-chip fail"><span class="chip-dot fail"></span> Not a PAN Card</div><div class="status-msg fail-msg">' + msg + '</div>';

  const color = detected ? 'linear-gradient(90deg,#6c63ff,#9b8eff,#00e67a)' : 'linear-gradient(90deg,#ff4f4f,#ff8080)';
  confPct.textContent = detected ? pct + '%' : '—';
  if (confValTxt) confValTxt.textContent = detected ? pct + '%' : '—';
  confFill.style.background = color;
  confFill.style.width = '0%';
  setTimeout(() => { confFill.style.width = detected ? pct + '%' : '0%'; }, 80);

  // SVG arc animation
  if (confArc) {
    const r = 32;
    const circ = 2 * Math.PI * r;
    const offset = detected ? circ - (parseFloat(pct) / 100) * circ : circ;
    confArc.style.strokeDasharray = circ;
    confArc.style.stroke = detected ? '#6c63ff' : '#ff4f4f';
    setTimeout(() => { confArc.style.strokeDashoffset = offset; }, 100);
  }

  statsGrid.innerHTML = [
    ['File Name', truncate(selectedFile.name, 16)],
    ['File Size', formatSize(selectedFile.size)],
    ['Result', detected ? 'PAN Card ✓' : 'Not PAN Card'],
    ['Confidence', detected ? pct + '%' : 'N/A'],
    ['Boxes Found', data.box_count || 0],
    ['Threshold', ((data.threshold || 0.3) * 100).toFixed(0) + '%'],
  ].map(([l,v]) => '<div class="stat-card"><div class="stat-label">'+l+'</div><div class="stat-val">'+v+'</div></div>').join('');

  resultEmpty.hidden = true;
  resultContent.hidden = false;
}

/* ── History ── */
function addHistory(filename, data) {
  history.unshift({ name: filename, detected: data.detected, conf: (data.confidence * 100).toFixed(1), time: new Date().toLocaleTimeString() });
  if (history.length > 20) history.pop();
  localStorage.setItem('panHistory', JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById('historyList');
  if (!list) return;
  if (history.length === 0) {
    list.innerHTML = '<div class="history-empty"><p>No history yet</p><small>Run your first detection</small></div>';
    return;
  }
  list.innerHTML = history.map(h => '<div class="history-item"><div class="hi-dot ' + (h.detected ? 'ok' : 'fail') + '"></div><div class="hi-info"><div class="hi-name">' + truncate(h.name, 22) + '</div><div class="hi-meta">' + h.time + ' · ' + (h.detected ? 'Detected' : 'Not Found') + '</div></div><div class="hi-conf">' + (h.detected ? h.conf + '%' : '—') + '</div></div>').join('');
}

function clearHistory() {
  history = [];
  localStorage.removeItem('panHistory');
  renderHistory();
  showToast('🗑 History cleared', 'info');
}

function toggleHistory() {
  const panel = document.getElementById('historyPanel');
  const backdrop = document.getElementById('historyBackdrop');
  panel.classList.toggle('active');
  backdrop.classList.toggle('active');
}

/* ── Zoom ── */
function openZoom(src) {
  const modal = document.getElementById('zoomModal');
  const img = document.getElementById('zoomImg');
  img.src = src;
  modal.classList.add('active');
}
function closeZoom() {
  document.getElementById('zoomModal').classList.remove('active');
}

/* ── Download ── */
function downloadResult() {
  if (!currentResultUrl) return;
  const a = document.createElement('a');
  a.href = currentResultUrl;
  a.download = 'panscan_result_' + Date.now() + '.jpg';
  a.click();
  showToast('📥 Downloading result…', 'info');
}

/* ── Toast ── */
function showToast(msg, type = 'info') {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => { t.classList.add('removing'); setTimeout(() => t.remove(), 300); }, 3000);
}

/* ── Nav Stats ── */
function updateNavStats() {
  const el = document.getElementById('navScans');
  const acc = document.getElementById('navAccuracy');
  if (el) el.textContent = totalScans;
  if (acc) acc.textContent = totalScans > 0 ? ((successScans / totalScans) * 100).toFixed(0) + '%' : '—';
}

/* ── Helpers ── */
function setLoading(on) {
  detectBtn.disabled = on;
  btnLabel.textContent = on ? 'Analyzing…' : 'Detect PAN Card';
  btnSpinner.hidden = !on;
}
function showError(msg) { errorText.textContent = msg; errorBox.hidden = false; }
function hideError() { errorBox.hidden = true; }
function formatSize(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}
function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

function resetUI() {
  selectedFile = null;
  fileInput.value = '';
  dropZone.classList.remove('has-file');
  dzInner.hidden = false;
  dzPreview.hidden = true;
  dzTitle.textContent = 'Drop your image here';
  fileMeta.hidden = true;
  detectBtn.disabled = true;
  hideError();
  resultContent.hidden = true;
  resultEmpty.hidden = false;
  currentResultUrl = '';
}

/* ── Keyboard shortcuts ── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeZoom(); if (document.getElementById('historyPanel').classList.contains('active')) toggleHistory(); }
});
