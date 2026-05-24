document.addEventListener('DOMContentLoaded', () => {
  if (isLoggedIn()) {
    window.location.replace('app.html');
  }
});

async function doLogin() {
  const email = (document.getElementById('l-email')?.value || '').trim();
  const senha = document.getElementById('l-pass')?.value || '';

  if (!email) { showErr('l-email', 'Informe o e-mail ou CPF'); return; }
  if (!senha)  { showErr('l-pass', 'Informe a senha'); return; }

  const btn = document.querySelector('#s-login .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Entrando…'; }

  const res = await apiFetch('/login', {
    method: 'POST',
    body: JSON.stringify({ usuario: email, senha })
  });

  if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }

  if (!res) {
    showErr('l-pass', 'E-mail ou senha incorretos');
    return;
  }

  setToken(res.token);
  setUser(res.usuario);
  window.location.replace('app.html');
}

async function doForgot() {
  const email = (document.getElementById('f-email')?.value || '').trim();
  if (!/\S+@\S+\.\S+/.test(email)) {
    showErr('f-email', 'Informe um e-mail válido');
    return;
  }

  const btn = document.querySelector('#s-forgot .btn-primary');
  if (btn) { btn.disabled = true; }

  await apiFetch('/auth/forgot', {
    method: 'POST',
    body: JSON.stringify({ email })
  });

  if (btn) { btn.disabled = false; }

  const msg = document.getElementById('sent-msg');
  if (msg) msg.textContent = `Enviamos um link para ${email}. Verifique sua caixa. O link expira em 30 minutos.`;
  goScreen('s-sent');
}
