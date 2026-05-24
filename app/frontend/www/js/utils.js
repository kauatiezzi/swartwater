// ── Formatadores ─────────────────────────────────────────────────────────────
function fmtL(n) {
  if (n == null || isNaN(n)) return '—';
  if (n >= 10000) return (n / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' mil L';
  return n.toLocaleString('pt-BR') + ' L';
}
function fmtLn(n) {
  if (n == null || isNaN(n)) return '—';
  if (n >= 10000) return (n / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'k';
  return n.toLocaleString('pt-BR');
}
function fmtBRL(n) {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtPct(n, showPlus = false) {
  if (n == null || isNaN(n)) return '—';
  const sign = n > 0 && showPlus ? '+' : '';
  return sign + n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
}
function fmtNum(n) {
  if (n == null || isNaN(n)) return '—';
  return Math.round(n).toLocaleString('pt-BR');
}

// ── Máscaras ─────────────────────────────────────────────────────────────────
function maskCpf(el) {
  let v = el.value.replace(/\D/g, '').slice(0, 11);
  if (v.length > 9)      v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4');
  else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{0,3})/, '$1.$2.$3');
  else if (v.length > 3) v = v.replace(/(\d{3})(\d{0,3})/, '$1.$2');
  el.value = v;
}
function maskTel(el) {
  let v = el.value.replace(/\D/g, '').slice(0, 11);
  if (v.length > 6)      v = v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
  else if (v.length > 2) v = v.replace(/(\d{2})(\d{0,5})/, '($1) $2');
  el.value = v;
}

// ── Form helpers ─────────────────────────────────────────────────────────────
function clearErr(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('err');
  const er = document.getElementById(id + '-err');
  if (er) er.classList.remove('on');
}
function showErr(id, msg) {
  const el = document.getElementById(id);
  if (el) el.classList.add('err');
  const er = document.getElementById(id + '-err');
  if (er) { if (msg) er.textContent = msg; er.classList.add('on'); }
}
function togglePass(id, btn) {
  const el = document.getElementById(id);
  if (!el) return;
  el.type = el.type === 'password' ? 'text' : 'password';
  btn.style.opacity = el.type === 'text' ? '0.4' : '1';
}
function checkStrength(v, prefix = '') {
  let s = 0;
  if (v.length >= 8)          s++;
  if (/[A-Z]/.test(v))        s++;
  if (/[0-9]/.test(v))        s++;
  if (/[^A-Za-z0-9]/.test(v)) s++;
  const colors = ['', '#EF233C', '#FFB703', '#00B4D8', '#06D6A0'];
  const labels = ['Digite uma senha', 'Muito fraca', 'Fraca', 'Boa', 'Forte'];
  for (let i = 1; i <= 4; i++) {
    const seg = document.getElementById(prefix + 'seg' + i);
    if (seg) seg.style.background = i <= s ? colors[s] : 'var(--bd)';
  }
  const lbl = document.getElementById(prefix + 'str-label');
  if (lbl) { lbl.textContent = labels[s]; lbl.style.color = colors[s] || 'var(--txt2)'; }
}

// ── Tela (screen switching) ──────────────────────────────────────────────────
function goScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
  const el = document.getElementById(id);
  if (el) el.classList.add('on');
}
