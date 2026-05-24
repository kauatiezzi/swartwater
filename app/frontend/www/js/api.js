const BASE_URL = '/api';

function getToken()  { return localStorage.getItem('sw_token'); }
function setToken(t) { localStorage.setItem('sw_token', t); }
function getUser()   {
  try { return JSON.parse(localStorage.getItem('sw_user') || 'null'); }
  catch { return null; }
}
function setUser(u)  { localStorage.setItem('sw_user', JSON.stringify(u)); }
function clearAuth() { localStorage.removeItem('sw_token'); localStorage.removeItem('sw_user'); }

function isLoggedIn() { return !!getToken(); }

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  try {
    const res = await fetch(BASE_URL + path, { headers, ...options });
    const data = await res.json().catch(() => ({}));

    if (res.status === 401) {
      clearAuth();
      window.location.replace('login.html');
      return null;
    }

    if (!res.ok) throw new Error(data.erro || data.mensagem || 'Erro ' + res.status);
    return data;
  } catch (e) {
    if (!e.message?.includes('replace')) console.warn('[API]', path, e.message);
    return null;
  }
}
