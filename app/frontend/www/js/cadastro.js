document.addEventListener('DOMContentLoaded', () => {
  if (isLoggedIn()) {
    window.location.replace('app.html');
  }
});

let selectedRole = 'morador';

function selectRole(r) {
  selectedRole = r;
  document.getElementById('role-morador')?.classList.toggle('selected', r === 'morador');
  document.getElementById('role-sindico')?.classList.toggle('selected', r === 'sindico');
}

function cad1Next() {
  const nome = (document.getElementById('c-nome')?.value || '').trim();
  const cpf  = document.getElementById('c-cpf')?.value || '';
  let ok = true;
  if (nome.split(' ').filter(Boolean).length < 2) { showErr('c-nome', 'Informe nome e sobrenome'); ok = false; }
  if (cpf.replace(/\D/g, '').length < 11)         { showErr('c-cpf', 'CPF deve ter 11 dígitos'); ok = false; }
  if (ok) goScreen('s-cad2');
}

function cad2Next() {
  const cond  = (document.getElementById('c-cond')?.value  || '').trim();
  const apto  = (document.getElementById('c-apto')?.value  || '').trim();
  const email = (document.getElementById('c-email')?.value || '').trim();
  let ok = true;
  if (!cond)                         { showErr('c-cond',  'Informe o condomínio'); ok = false; }
  if (!apto)                         { showErr('c-apto',  'Informe o número do apto'); ok = false; }
  if (!/\S+@\S+\.\S+/.test(email))   { showErr('c-email', 'E-mail inválido'); ok = false; }
  if (ok) goScreen('s-cad3');
}

async function cad3Final() {
  const p1 = document.getElementById('c-pass')?.value  || '';
  const p2 = document.getElementById('c-pass2')?.value || '';
  let ok = true;
  if (p1.length < 8) { showErr('c-pass',  'Mínimo 8 caracteres'); ok = false; }
  if (p1 !== p2)     { showErr('c-pass2', 'As senhas não coincidem'); ok = false; }
  if (!ok) return;

  const btn = document.querySelector('#s-cad3 .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Criando conta…'; }

  const payload = {
    nome:       document.getElementById('c-nome')?.value?.trim(),
    cpf:        document.getElementById('c-cpf')?.value,
    cond:       document.getElementById('c-cond')?.value?.trim(),
    bloco:      document.getElementById('c-bloco')?.value?.trim(),
    apto:       document.getElementById('c-apto')?.value?.trim(),
    email:      document.getElementById('c-email')?.value?.trim(),
    tel:        document.getElementById('c-tel')?.value,
    senha:      p1,
    perfil:     selectedRole,
  };

  const res = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (btn) { btn.disabled = false; btn.textContent = 'Criar minha conta ✓'; }

  if (!res) {
    alert('Erro ao criar conta. Verifique os dados e tente novamente.');
    return;
  }

  setToken(res.token);
  setUser(res.usuario);
  goScreen('s-success');
}
