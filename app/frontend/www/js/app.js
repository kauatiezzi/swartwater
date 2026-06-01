// ═══════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════
const STATE = {
  user: null,
  consumo: null,
  notificacoes: [],
  periodo: 'diario',
  notifFiltro: 'todos',
  sindicoAuth: false,
  g5Url: '',
  isApiLive: false,
};

// ─── Dados mock (fallback offline) ──────────────────
function _mockDashboard() {
  return { consumo_mes_atual:3847, consumo_hoje:142, media_diaria:128,
    estimativa_fatura:89.50, meta_mensal:4500, variacao_mes_anterior:-8.3,
    comparativo_condominio:-5.2, vazamento_risco:false };
}
function _mockHistorico(periodo) {
  const hoje = new Date();
  if (periodo === 'mensal') {
    const m = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return m.map(l => ({ label:l, value: Math.round(2400 + Math.random()*2800) }));
  }
  return Array.from({length:30}, (_,i) => {
    const d = new Date(hoje); d.setDate(d.getDate()-29+i);
    return { label: `${d.getDate()}/${d.getMonth()+1}`, value: Math.round(70+Math.random()*150) };
  });
}
function _mockNotificacoes() {
  const perfil = getUser()?.perfil || 'morador';
  if (perfil === 'sindico') {
    return [
      { id:1, nivel:'alerta', titulo:'Conta de morador em atraso', desc:'Existe conta pendente no seu condominio.', icone:'⚠️', lido:false, tempo:'Agora' },
      { id:2, nivel:'info', titulo:'Resumo do condominio atualizado', desc:'Consumo e contas foram sincronizados.', icone:'🏢', lido:true, tempo:'Ontem' },
    ];
  }
  if (perfil === 'operador') {
    return [
      { id:1, nivel:'critico', titulo:'Bomba submersa com pressao critica', desc:'Bomba Submersa Sedenho abaixo do minimo operacional.', icone:'🚨', lido:false, tempo:'Agora' },
      { id:2, nivel:'alerta', titulo:'Perda elevada na Vila Sedenho', desc:'Balanco hidrico indica perda acima do esperado.', icone:'⚠️', lido:false, tempo:'2h atras' },
    ];
  }
  return [
    { id:1, nivel:'info', titulo:'Conta do mes disponivel', desc:'Sua fatura ja pode ser consultada na aba Contas.', icone:'💰', lido:false, tempo:'Agora' },
    { id:2, nivel:'ok', titulo:'Consumo dentro do esperado', desc:'Seu apartamento esta dentro da faixa normal de consumo.', icone:'✅', lido:true, tempo:'Ontem' },
  ];
}
function _mockSindicoStats() {
  return { total_moradores:48, consumo_condominio:184320, alertas_ativos:7,
    vazamentos_suspeitos:2, economia_mes:8.4, fatura_estimada:4280.00 };
}

// ═══════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  if (!isLoggedIn()) { window.location.replace('login.html'); return; }

  STATE.user = getUser() || { nome: 'Usuário', apto: '—', condominio: '—', perfil: 'morador', avatar_emoji: '👤' };

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia ☀️' : hora < 18 ? 'Boa tarde 🌤️' : 'Boa noite 🌙';
  const greet = document.getElementById('ah-greeting');
  const nameEl = document.getElementById('ah-name');
  const avatarEl = document.getElementById('ah-avatar');
  if (greet) greet.textContent = saudacao;
  if (nameEl) nameEl.textContent = STATE.user.nome || 'Usuário';
  if (avatarEl) avatarEl.textContent = STATE.user.avatar_emoji || '👤';

  switchTab('dashboard');
  loadData();
});

async function loadData() {
  const [consumoData, notifData] = await Promise.all([
    apiFetch('/consumo/dashboard'),
    apiFetch('/notificacoes/'),
  ]);

  STATE.isApiLive = !!consumoData;
  STATE.consumo = consumoData || _mockDashboard();
  STATE.notificacoes = notifData || _mockNotificacoes();

  renderDashboard();
  renderNotificacoes();
  updateBadge();
  updateDesktopPanel();
}

// ═══════════════════════════════════════════════════
//  NAVEGAÇÃO POR ABAS
// ═══════════════════════════════════════════════════
function switchTab(tab) {
  ['dashboard','notificacoes','sindico','perfil'].forEach(t => {
    const pane = document.getElementById('tab-' + t);
    const nav  = document.getElementById('nav-' + t);
    if (pane) pane.style.display = 'none';
    if (nav)  nav.classList.remove('active');
  });
  const active = document.getElementById('tab-' + tab);
  const navBtn = document.getElementById('nav-' + tab);
  if (active) active.style.display = 'block';
  if (navBtn) navBtn.classList.add('active');

  if (tab === 'sindico')      renderSindico();
  if (tab === 'perfil')       renderPerfil();
  if (tab === 'notificacoes') renderNotificacoes();
}

// ═══════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════
async function renderDashboard() {
  const d = STATE.consumo || _mockDashboard();
  const chartData = await loadChartData(STATE.periodo);
  const container = document.getElementById('tab-dashboard');
  if (!container) return;

  const varNeg   = d.variacao_mes_anterior < 0;
  const varColor = varNeg ? '#06D6A0' : '#EF233C';
  const varIcon  = varNeg ? '↓' : '↑';
  const pct      = Math.round((d.consumo_mes_atual / d.meta_mensal) * 100);
  const condNeg  = d.comparativo_condominio < 0;

  container.innerHTML = `
    <div style="padding-top:6px">
      <div class="api-badge">
        <div class="api-dot ${STATE.isApiLive ? 'live' : 'mock'}"></div>
        ${STATE.isApiLive ? 'Dados em tempo real' : 'Dados de demonstração'}
      </div>

      <div class="hero-consumption animate-in">
        <div class="hc-label">Consumo este mês</div>
        <div class="hc-value">${fmtLn(d.consumo_mes_atual)}<span class="hc-unit">L</span></div>
        <div class="hc-sub" style="color:${varColor};font-weight:700;margin-top:4px;font-size:13px">
          ${varIcon} ${fmtPct(Math.abs(d.variacao_mes_anterior))} vs mês anterior
        </div>
        <div class="hc-row">
          <div class="hc-stat">
            <div class="hc-stat-label">Hoje</div>
            <div class="hc-stat-value">${fmtLn(d.consumo_hoje)}<span style="font-size:10px;opacity:.7"> L</span></div>
            <div class="hc-stat-diff">📊 Média: ${fmtLn(d.media_diaria)} L/dia</div>
          </div>
          <div class="hc-stat">
            <div class="hc-stat-label">Meta mensal</div>
            <div class="hc-stat-value" style="color:${pct>=100?'#EF233C':pct>=80?'#FFB703':'#fff'}">${pct}<span style="font-size:10px;opacity:.7">%</span></div>
            <div class="hc-stat-diff">${fmtLn(d.meta_mensal)} L limite</div>
          </div>
          <div class="hc-stat">
            <div class="hc-stat-label">vs Condomínio</div>
            <div class="hc-stat-value" style="color:${condNeg?'#90E0EF':'#FFB703'}">${condNeg?'↓':'↑'}${Math.abs(d.comparativo_condominio)}<span style="font-size:10px;opacity:.7">%</span></div>
            <div class="hc-stat-diff">${condNeg?'Abaixo':'Acima'} da média</div>
          </div>
        </div>
      </div>

      <div class="fatura-card animate-in">
        <div class="fatura-icon">💰</div>
        <div>
          <div class="fatura-label">Estimativa da fatura</div>
          <div class="fatura-value">${fmtBRL(d.estimativa_fatura)}</div>
          <div class="fatura-sub">Projeção para o fechamento do mês</div>
        </div>
      </div>

      <div class="card animate-in">
        <div class="card-title">
          Histórico de consumo
          <button class="card-title-action" onclick="reloadChart()">↻ Atualizar</button>
        </div>
        <div class="period-tabs">
          <button class="period-tab ${STATE.periodo==='diario'?'active':''}" onclick="changePeriodo('diario')">Diário</button>
          <button class="period-tab ${STATE.periodo==='mensal'?'active':''}" onclick="changePeriodo('mensal')">Mensal</button>
        </div>
        <div id="chart-container">${renderChart(chartData)}</div>
      </div>

      <div class="card animate-in">
        <div class="card-title">Meta mensal</div>
        <div class="gauge-wrap">${renderGauge(pct, d.consumo_mes_atual, d.meta_mensal)}</div>
      </div>

      <div class="card animate-in">
        <div class="card-title">💡 Dicas de economia</div>
        <div class="tip-item"><div class="tip-emoji">🚿</div><div><div class="tip-title">Reduza o tempo no banho</div><div class="tip-desc">Cada minuto a menos economiza ~9 L. Banhos de 5 min salvam 30 L por dia.</div></div></div>
        <div class="tip-item"><div class="tip-emoji">🔧</div><div><div class="tip-title">Verifique goteiras</div><div class="tip-desc">Uma torneira pingando gasta até 46 L/dia. Cheque todas as torneiras.</div></div></div>
        <div class="tip-item"><div class="tip-emoji">🌙</div><div><div class="tip-title">Consumo noturno anormal</div><div class="tip-desc">Consumo elevado entre 00h–05h pode indicar vazamento oculto.</div></div></div>
      </div>
    </div>`;
}

function renderChart(data) {
  if (!data || !data.length) return '<div style="text-align:center;color:var(--txt2);padding:20px;font-size:13px">Sem dados disponíveis</div>';
  const W=340, H=140, P={t:10,r:10,b:28,l:38};
  const gW=W-P.l-P.r, gH=H-P.t-P.b;
  const max=Math.max(...data.map(d=>d.value))*1.15;
  const step=Math.ceil(data.length/14);
  const barW=gW/data.length;
  let bars='', labels='', grid='';
  for (let i=0;i<=4;i++){
    const y=P.t+gH-(i/4)*gH, val=Math.round((i/4)*max);
    grid+=`<line x1="${P.l}" y1="${y}" x2="${W-P.r}" y2="${y}" stroke="var(--bd)" stroke-width="1" stroke-dasharray="3,3"/>`;
    grid+=`<text x="${P.l-4}" y="${y+3}" text-anchor="end" font-size="8" fill="var(--txt3)" font-family="DM Sans,sans-serif">${val>999?(val/1000).toFixed(1)+'k':val}</text>`;
  }
  data.forEach((d,i)=>{
    const x=P.l+i*barW, bH=(d.value/max)*gH, y=P.t+gH-bH;
    const fill=d.value>(max/1.15)*0.9?'#EF233C':'url(#barGrad)';
    bars+=`<rect x="${x+barW*.12}" y="${y}" width="${barW*.76}" height="${bH}" rx="3" fill="${fill}" opacity=".85"/>`;
    if(i%step===0) labels+=`<text x="${x+barW/2}" y="${H-2}" text-anchor="middle" font-size="9" fill="var(--txt2)" font-family="DM Sans,sans-serif">${d.label}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">
    <defs><linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#00B4D8"/><stop offset="100%" stop-color="#0077B6"/>
    </linearGradient></defs>
    ${grid}${bars}${labels}</svg>`;
}

function renderGauge(pct, atual, meta) {
  const c=Math.min(pct,100), r=64, cx=110, cy=90;
  const start=-210, sweep=240;
  const angle=start+(c/100)*sweep;
  const polar=(cx,cy,r,deg)=>({x:cx+r*Math.cos((deg-90)*Math.PI/180),y:cy+r*Math.sin((deg-90)*Math.PI/180)});
  const s=polar(cx,cy,r,start), eAll=polar(cx,cy,r,start+sweep), eCur=polar(cx,cy,r,angle);
  const laCur=(c/100)*sweep>180?1:0;
  const track=`M ${s.x} ${s.y} A ${r} ${r} 0 1 1 ${eAll.x} ${eAll.y}`;
  const fill=c>0?`M ${s.x} ${s.y} A ${r} ${r} 0 ${laCur} 1 ${eCur.x} ${eCur.y}`:'';
  const color=pct>=100?'#EF233C':pct>=80?'#FFB703':'#00B4D8';
  const restante=Math.max(0,meta-atual);
  return `<svg viewBox="0 0 220 130" width="220" height="130">
    <path d="${track}" fill="none" stroke="var(--bd)" stroke-width="12" stroke-linecap="round"/>
    ${fill?`<path d="${fill}" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round"/>`:''}
    <text x="${cx}" y="${cy-8}" font-family="Syne,sans-serif" font-size="28" font-weight="800" fill="${color}" text-anchor="middle">${c}%</text>
    <text x="${cx}" y="${cy+10}" font-size="11" fill="var(--txt2)" text-anchor="middle" font-family="DM Sans,sans-serif">da meta usada</text>
  </svg>
  <div style="display:flex;gap:28px;margin-top:4px">
    <div style="text-align:center">
      <div style="font-size:10px;color:var(--txt2);text-transform:uppercase;letter-spacing:.05em;font-weight:700">Consumido</div>
      <div style="font-family:var(--font);font-size:20px;font-weight:800;color:${color};letter-spacing:-0.5px;margin-top:2px">${fmtNum(atual)} <span style="font-size:12px;font-weight:500;color:var(--txt2)">L</span></div>
    </div>
    <div style="width:1px;background:var(--bd)"></div>
    <div style="text-align:center">
      <div style="font-size:10px;color:var(--txt2);text-transform:uppercase;letter-spacing:.05em;font-weight:700">Restante</div>
      <div style="font-family:var(--font);font-size:20px;font-weight:800;color:var(--ok);letter-spacing:-0.5px;margin-top:2px">${fmtNum(restante)} <span style="font-size:12px;font-weight:500;color:var(--txt2)">L</span></div>
    </div>
  </div>`;
}

async function loadChartData(periodo) {
  const data = await apiFetch('/consumo/historico?periodo=' + periodo);
  return data || _mockHistorico(periodo);
}
async function changePeriodo(p) {
  STATE.periodo = p;
  const cont = document.getElementById('chart-container');
  if (cont) cont.innerHTML = '<div class="loading-shimmer" style="height:140px;margin:8px 0"></div>';
  document.querySelectorAll('.period-tab').forEach(t => {
    t.classList.toggle('active', (p==='diario'&&t.textContent.includes('Diár'))||(p==='mensal'&&t.textContent.includes('Mens')));
  });
  const data = await loadChartData(p);
  if (cont) cont.innerHTML = renderChart(data);
}
async function reloadChart() {
  const data = await loadChartData(STATE.periodo);
  const cont = document.getElementById('chart-container');
  if (cont) cont.innerHTML = renderChart(data);
}

// ═══════════════════════════════════════════════════
//  NOTIFICAÇÕES
// ═══════════════════════════════════════════════════
function renderNotificacoes() {
  const notifs = STATE.notificacoes;
  const filtro = STATE.notifFiltro;
  const filtered = filtro==='todos' ? notifs
    : filtro==='nao-lidos' ? notifs.filter(n=>!n.lido)
    : notifs.filter(n=>n.nivel===filtro);

  const counts = { critico:0, alerta:0, info:0, ok:0 };
  notifs.forEach(n => { if (counts[n.nivel]!=null) counts[n.nivel]++; });

  const chips = [
    {key:'todos',label:'Todos'},{key:'nao-lidos',label:'Não lidos'},
    {key:'critico',label:'🚨 Críticos'},{key:'alerta',label:'⚠️ Alertas'},
    {key:'info',label:'ℹ️ Info'},{key:'ok',label:'✅ OK'},
  ];

  const items = filtered.map(n => `
    <div class="notif-item nivel-${n.nivel}" onclick="marcarLido(${n.id})">
      <div class="notif-icon-wrap ${n.nivel==='critico'?'critico':n.nivel==='alerta'?'alerta':n.nivel==='ok'?'ok':'info'}">${n.icone}</div>
      <div style="flex:1;min-width:0">
        <div class="notif-title">${n.titulo}</div>
        <div class="notif-desc">${n.desc}</div>
        <div class="notif-time">${n.tempo}</div>
      </div>
      ${!n.lido?'<div class="notif-unread"></div>':''}
    </div>`).join('') || '<div style="text-align:center;color:var(--txt2);padding:32px;font-size:13px">Nenhuma notificação aqui 🎉</div>';

  const cont = document.getElementById('tab-notificacoes');
  if (!cont) return;
  cont.innerHTML = `
    <div style="padding-top:6px">
      <div class="notif-summary">
        <div class="ns-card critico"><div class="ns-count">${counts.critico}</div><div class="ns-label">🚨 Críticos</div></div>
        <div class="ns-card alerta"><div class="ns-count">${counts.alerta}</div><div class="ns-label">⚠️ Alertas</div></div>
        <div class="ns-card info"><div class="ns-count">${counts.info}</div><div class="ns-label">ℹ️ Informativos</div></div>
        <div class="ns-card ok"><div class="ns-count">${counts.ok}</div><div class="ns-label">✅ OK</div></div>
      </div>
      <div class="notif-filter">${chips.map(c=>`<button class="notif-chip ${STATE.notifFiltro===c.key?'active':''}" onclick="filtrarNotif('${c.key}')">${c.label}</button>`).join('')}</div>
      ${items}
    </div>`;
}

function filtrarNotif(filtro) { STATE.notifFiltro = filtro; renderNotificacoes(); }

async function marcarLido(id) {
  const n = STATE.notificacoes.find(x => x.id === id);
  if (n) { n.lido = true; updateBadge(); renderNotificacoes(); }
  await apiFetch('/notificacoes/' + id + '/lido', { method: 'PATCH' });
}

function updateBadge() {
  const n = STATE.notificacoes.filter(x => !x.lido).length;
  const badge = document.getElementById('badge-notif');
  if (badge) { badge.textContent = n; badge.style.display = n ? 'flex' : 'none'; }
}

// ═══════════════════════════════════════════════════
//  SÍNDICO
// ═══════════════════════════════════════════════════
function renderSindico() {
  const cont = document.getElementById('tab-sindico');
  if (!cont) return;

  if (!STATE.sindicoAuth) {
    cont.innerHTML = `
      <div style="padding-top:16px">
        <div class="g5-badge">🏢 Acesso Restrito — Síndico/Admin</div>
        <div class="card animate-in" style="text-align:center;padding:32px 24px">
          <div style="font-size:56px;margin-bottom:8px">🔒</div>
          <div style="font-family:var(--font);font-size:20px;font-weight:800;color:var(--txt);margin-bottom:8px">Área do Síndico</div>
          <div style="font-size:13px;color:var(--txt2);line-height:1.6;margin-bottom:20px">Esta área é restrita ao síndico e administradores. Insira a senha para continuar.</div>
          <div class="field-group" style="text-align:left">
            <label class="field-label">Senha de administrador</label>
            <div class="field-wrap">
              <input class="field-input" id="sindico-pass" type="password" placeholder="••••••••" onkeydown="if(event.key==='Enter')autenticarSindico()">
              <span class="field-icon" onclick="togglePass('sindico-pass',this)">👁</span>
            </div>
          </div>
          <button class="btn-primary" onclick="autenticarSindico()">Entrar como Síndico →</button>
          <div style="font-size:11px;color:var(--txt3);margin-top:12px">Demo: qualquer senha funciona</div>
        </div>
      </div>`;
    return;
  }

  const stats = _mockSindicoStats();
  cont.innerHTML = `
    <div style="padding-top:16px">
      <div class="g5-badge">🏢 Painel do Síndico — ${STATE.user?.condominio || 'Ed. Reserva Verde'}</div>
      <div class="sindico-stats animate-in" style="margin-bottom:14px">
        <div class="sstat"><div class="sstat-label">Moradores</div><div class="sstat-value">${fmtNum(stats.total_moradores)}<span class="sstat-unit"> unid.</span></div></div>
        <div class="sstat"><div class="sstat-label">Consumo total</div><div class="sstat-value">${(stats.consumo_condominio/1000).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})}<span class="sstat-unit"> m³</span></div></div>
        <div class="sstat" style="border-left:3px solid var(--err)"><div class="sstat-label">Alertas ativos</div><div class="sstat-value" style="color:var(--err)">${fmtNum(stats.alertas_ativos)}</div></div>
        <div class="sstat" style="border-left:3px solid var(--warn)"><div class="sstat-label">Vazamentos suspeitos</div><div class="sstat-value" style="color:var(--warn)">${fmtNum(stats.vazamentos_suspeitos)}</div></div>
        <div class="sstat"><div class="sstat-label">Economia no mês</div><div class="sstat-value" style="color:var(--ok)">${fmtPct(stats.economia_mes)}</div></div>
        <div class="sstat"><div class="sstat-label">Fatura estimada</div><div class="sstat-value" style="font-size:16px">${fmtBRL(stats.fatura_estimada)}</div></div>
      </div>

      <div class="card animate-in">
        <div class="card-title">Painel Gerencial Externo<span style="font-size:10px;color:var(--txt3);font-weight:400;text-transform:none">Integração</span></div>
        <div style="font-size:12px;color:var(--txt2);margin-bottom:12px;line-height:1.5">Cole a URL do painel externo para embutir a visão gerencial:</div>
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <input type="url" id="g5-url" class="field-input" style="height:42px;font-size:13px" placeholder="https://dashboard-g5.vercel.app" value="${STATE.g5Url}">
          <button class="g5-btn-load" onclick="carregarG5()">Carregar</button>
        </div>
        <div class="g5-iframe-container" id="g5-container">
          ${STATE.g5Url
            ? `<iframe src="${STATE.g5Url}" title="Painel Gerencial Externo" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>`
            : `<div class="g5-placeholder"><div class="g5-placeholder-icon">📊</div><div class="g5-placeholder-title">Dashboard G5 não configurado</div><div class="g5-placeholder-desc">Insira a URL acima e clique em "Carregar".</div></div>`}
        </div>
      </div>

      <div style="text-align:center;margin-top:8px">
        <button class="link-btn" onclick="STATE.sindicoAuth=false;renderSindico()" style="font-size:12px;color:var(--txt3)">🔓 Sair do painel administrativo</button>
      </div>
    </div>`;
}

function autenticarSindico() {
  const pass = document.getElementById('sindico-pass')?.value;
  if (!pass) { document.getElementById('sindico-pass').style.borderColor='var(--err)'; return; }
  STATE.sindicoAuth = true;
  renderSindico();
}

function carregarG5() {
  const url = document.getElementById('g5-url')?.value?.trim();
  if (!url) return;
  STATE.g5Url = url;
  const cont = document.getElementById('g5-container');
  if (cont) cont.innerHTML = `<iframe src="${url}" title="Painel Gerencial Externo" sandbox="allow-scripts allow-same-origin allow-forms" style="width:100%;height:100%;min-height:400px;border:none;display:block"></iframe>`;
}

// ═══════════════════════════════════════════════════
//  PERFIL
// ═══════════════════════════════════════════════════
let perfilSub = 'menu';
const ALERT_PREFS = { vazamento:true, consumo_excessivo:true, meta_mensal:true, relatorio_semanal:false, dicas:true, horario_silencio:false, silencio_inicio:'22:00', silencio_fim:'07:00' };
let META_CONSUMO = 4500;

function renderPerfil() {
  switch(perfilSub) {
    case 'dados':     renderPerfilDados(); break;
    case 'alertas':   renderPerfilAlertas(); break;
    case 'meta':      renderPerfilMeta(); break;
    case 'senha':     renderPerfilSenha(); break;
    case 'historico': renderPerfilHistorico(); break;
    default:          renderPerfilMenu(); break;
  }
}
function irPerfilSub(sub) { perfilSub = sub; renderPerfil(); document.getElementById('tab-perfil')?.scrollTo(0,0); }

function renderPerfilMenu() {
  const u = STATE.user || {};
  document.getElementById('tab-perfil').innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar" onclick="irPerfilSub('dados')" style="cursor:pointer;position:relative">
        <span style="font-size:34px">${u.avatar_emoji||'👤'}</span>
        <div style="position:absolute;bottom:-2px;right:-2px;width:20px;height:20px;background:var(--w1);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;border:2px solid white">✏️</div>
      </div>
      <div class="profile-name">${u.nome||'Usuário'}</div>
      <div class="profile-info">Apto ${u.apto||'—'} · ${u.condominio||'—'}</div>
      <div style="margin-top:10px"><span style="background:rgba(255,255,255,0.2);color:#fff;font-size:11px;font-weight:700;padding:4px 14px;border-radius:20px;font-family:var(--font)">${u.perfil==='sindico'?'🏢 Síndico':'🏠 Morador'}</span></div>
    </div>
    <div class="profile-menu">
      <div class="menu-section">
        <div class="menu-section-title">Minha conta</div>
        <button class="menu-item" onclick="irPerfilSub('dados')"><div class="menu-icon">👤</div><div class="menu-text"><div class="menu-label">Dados pessoais</div><div class="menu-desc">Nome, CPF, e-mail e telefone</div></div><div class="menu-arrow">›</div></button>
        <button class="menu-item" onclick="irPerfilSub('alertas')"><div class="menu-icon">🔔</div><div class="menu-text"><div class="menu-label">Preferências de alerta</div><div class="menu-desc">${Object.values(ALERT_PREFS).filter(v=>v===true).length} alertas ativos</div></div><div class="menu-arrow">›</div></button>
        <button class="menu-item" onclick="irPerfilSub('meta')"><div class="menu-icon">🎯</div><div class="menu-text"><div class="menu-label">Meta de consumo</div><div class="menu-desc">${META_CONSUMO.toLocaleString('pt-BR')} L por mês</div></div><div class="menu-arrow">›</div></button>
      </div>
      <div class="menu-section">
        <div class="menu-section-title">Dados e relatórios</div>
        <button class="menu-item" onclick="irPerfilSub('historico')"><div class="menu-icon">📊</div><div class="menu-text"><div class="menu-label">Histórico completo</div><div class="menu-desc">Consumo dos últimos 12 meses</div></div><div class="menu-arrow">›</div></button>
        <button class="menu-item" onclick="exportarRelatorio()"><div class="menu-icon">📄</div><div class="menu-text"><div class="menu-label">Exportar relatório</div><div class="menu-desc">Gera resumo em texto para copiar</div></div><div class="menu-arrow">›</div></button>
      </div>
      <div class="menu-section">
        <div class="menu-section-title">Segurança</div>
        <button class="menu-item" onclick="irPerfilSub('senha')"><div class="menu-icon">🔒</div><div class="menu-text"><div class="menu-label">Alterar senha</div><div class="menu-desc">Mantenha sua conta segura</div></div><div class="menu-arrow">›</div></button>
        <button class="menu-item" onclick="confirmarSair()"><div class="menu-icon" style="background:#fff0f3">🚪</div><div class="menu-text"><div class="menu-label" style="color:var(--err)">Sair da conta</div><div class="menu-desc">Desconectar do SmartWater</div></div><div class="menu-arrow" style="color:var(--err)">›</div></button>
      </div>
      <div style="text-align:center;font-size:11px;color:var(--txt3);padding:8px 0 16px">SmartWater v2.0 · Monitoramento Residencial</div>
    </div>`;
}

function renderPerfilDados() {
  const u = STATE.user || {};
  document.getElementById('tab-perfil').innerHTML = `
    <div class="profile-sub-header">
      <button class="psub-back" onclick="irPerfilSub('menu')">← Voltar</button>
      <div class="psub-title">Dados pessoais</div>
    </div>
    <div class="profile-menu" style="padding-top:8px">
      <div class="field-group"><label class="field-label">Nome completo</label><div class="field-wrap"><input class="field-input" id="p-nome" type="text" value="${u.nome||''}" placeholder="Seu nome completo"><span class="field-icon">✏️</span></div><div class="field-err" id="p-nome-err">Informe nome e sobrenome</div></div>
      <div class="field-group"><label class="field-label">CPF</label><div class="field-wrap"><input class="field-input" id="p-cpf" type="text" value="${u.cpf||''}" placeholder="000.000.000-00" oninput="maskCpf(this)" maxlength="14"><span class="field-icon">🪪</span></div></div>
      <div class="field-group"><label class="field-label">E-mail</label><div class="field-wrap"><input class="field-input" id="p-email" type="email" value="${u.email||''}" placeholder="seuemail@exemplo.com"><span class="field-icon">✉</span></div><div class="field-err" id="p-email-err">E-mail inválido</div></div>
      <div class="field-group"><label class="field-label">WhatsApp</label><div class="field-wrap"><input class="field-input" id="p-tel" type="tel" value="${u.tel||''}" placeholder="(11) 99999-0000" oninput="maskTel(this)" maxlength="15"><span class="field-icon">📱</span></div></div>
      <div class="field-group"><label class="field-label">Condomínio</label><div class="field-wrap"><input class="field-input" id="p-cond" type="text" value="${u.condominio||''}" placeholder="Ed. Reserva Verde"><span class="field-icon">🏙️</span></div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="field-group"><label class="field-label">Bloco</label><input class="field-input" id="p-bloco" type="text" value="${u.bloco||''}" placeholder="A" style="padding:0 14px"></div>
        <div class="field-group"><label class="field-label">Apartamento</label><input class="field-input" id="p-apto" type="text" value="${u.apto||''}" placeholder="304" style="padding:0 14px"></div>
      </div>
      <div id="p-save-feedback" style="display:none;background:var(--okl);border:1.5px solid var(--ok);border-radius:12px;padding:10px 14px;font-size:12px;font-weight:600;color:#047a57;margin-bottom:12px;text-align:center">✅ Dados salvos com sucesso!</div>
      <button class="btn-primary" onclick="salvarDados()">Salvar alterações</button>
      <button class="btn-outline" style="margin-top:10px" onclick="irPerfilSub('menu')">Cancelar</button>
      <div style="height:24px"></div>
    </div>`;
}

async function salvarDados() {
  const nome = (document.getElementById('p-nome')?.value||'').trim();
  const email = (document.getElementById('p-email')?.value||'').trim();
  let ok=true;
  if (nome.split(' ').filter(Boolean).length<2) { showErr('p-nome','Informe nome e sobrenome'); ok=false; }
  if (email && !/\S+@\S+\.\S+/.test(email)) { showErr('p-email','E-mail inválido'); ok=false; }
  if (!ok) return;
  const payload = {
    nome, email,
    cpf: document.getElementById('p-cpf')?.value,
    tel: document.getElementById('p-tel')?.value,
    cond: document.getElementById('p-cond')?.value,
    bloco: document.getElementById('p-bloco')?.value,
    apto: document.getElementById('p-apto')?.value,
  };
  await apiFetch('/usuario/perfil', { method:'PUT', body:JSON.stringify(payload) });
  STATE.user = { ...STATE.user, ...payload, condominio: payload.cond };
  setUser(STATE.user);
  document.getElementById('ah-name').textContent = nome;
  const fb = document.getElementById('p-save-feedback');
  if (fb) { fb.style.display='block'; setTimeout(()=>{ fb.style.display='none'; }, 2500); }
}

function renderPerfilAlertas() {
  document.getElementById('tab-perfil').innerHTML = `
    <div class="profile-sub-header"><button class="psub-back" onclick="irPerfilSub('menu')">← Voltar</button><div class="psub-title">Alertas & Notificações</div></div>
    <div class="profile-menu" style="padding-top:8px">
      <div class="psub-section">Tipos de alerta</div>
      ${[
        ['vazamento','🚨','Possível vazamento','Alerta imediato ao detectar consumo noturno anormal','#fff0f3'],
        ['consumo_excessivo','📊','Consumo excessivo','Aviso quando ultrapassar 40% da média diária','#fff8e6'],
        ['meta_mensal','🎯','Meta mensal em risco','Aviso ao atingir 80% da meta mensal','var(--a3)'],
        ['relatorio_semanal','📊','Relatório semanal','Resumo toda segunda-feira pela manhã','var(--okl)'],
        ['dicas','💡','Dicas de economia','Sugestões personalizadas de redução','#f0fbf4'],
      ].map(([k,ico,lbl,desc,bg])=>`
        <div class="toggle-item">
          <div class="toggle-icon" style="background:${bg}">${ico}</div>
          <div class="toggle-text"><div class="toggle-label">${lbl}</div><div class="toggle-desc">${desc}</div></div>
          <label class="toggle-switch"><input type="checkbox" ${ALERT_PREFS[k]?'checked':''} onchange="ALERT_PREFS['${k}']=this.checked"><span class="toggle-track"></span></label>
        </div>`).join('')}
      <div class="psub-section" style="margin-top:8px">Horário de silêncio</div>
      <div class="toggle-item">
        <div class="toggle-icon">🌙</div>
        <div class="toggle-text"><div class="toggle-label">Ativar silêncio noturno</div><div class="toggle-desc">Sem notificações no período configurado</div></div>
        <label class="toggle-switch"><input type="checkbox" id="t-silencio" ${ALERT_PREFS.horario_silencio?'checked':''} onchange="ALERT_PREFS.horario_silencio=this.checked;document.getElementById('silencio-h').style.display=this.checked?'grid':'none'"><span class="toggle-track"></span></label>
      </div>
      <div id="silencio-h" style="display:${ALERT_PREFS.horario_silencio?'grid':'none'};grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
        <div class="field-group" style="margin:0"><label class="field-label">Das</label><input class="field-input" type="time" value="${ALERT_PREFS.silencio_inicio}" style="height:44px" onchange="ALERT_PREFS.silencio_inicio=this.value"></div>
        <div class="field-group" style="margin:0"><label class="field-label">Até</label><input class="field-input" type="time" value="${ALERT_PREFS.silencio_fim}" style="height:44px" onchange="ALERT_PREFS.silencio_fim=this.value"></div>
      </div>
      <div id="alerta-fb" style="display:none;background:var(--okl);border:1.5px solid var(--ok);border-radius:12px;padding:10px 14px;font-size:12px;font-weight:600;color:#047a57;margin-bottom:12px;text-align:center">✅ Preferências salvas!</div>
      <button class="btn-primary" onclick="salvarAlertas()">Salvar preferências</button>
      <div style="height:24px"></div>
    </div>`;
}

async function salvarAlertas() {
  await apiFetch('/usuario/alertas', { method:'PUT', body:JSON.stringify(ALERT_PREFS) });
  const fb = document.getElementById('alerta-fb');
  if (fb) { fb.style.display='block'; setTimeout(()=>{ fb.style.display='none'; irPerfilSub('menu'); }, 1800); }
}

function renderPerfilMeta() {
  const d = STATE.consumo || _mockDashboard();
  const pct = Math.round((d.consumo_mes_atual / META_CONSUMO) * 100);
  const restante = Math.max(0, META_CONSUMO - d.consumo_mes_atual);
  document.getElementById('tab-perfil').innerHTML = `
    <div class="profile-sub-header"><button class="psub-back" onclick="irPerfilSub('menu')">← Voltar</button><div class="psub-title">Meta de consumo</div></div>
    <div class="profile-menu" style="padding-top:8px">
      <div style="background:linear-gradient(135deg,var(--w2),var(--w4));border-radius:20px;padding:20px;margin-bottom:16px;color:#fff">
        <div style="font-size:11px;opacity:.65;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Meta atual</div>
        <div style="font-family:var(--font);font-size:34px;font-weight:800;letter-spacing:-1px;margin:4px 0">${fmtNum(META_CONSUMO)}<span style="font-size:15px;opacity:.7;font-weight:400"> L/mês</span></div>
        <div style="background:rgba(255,255,255,.15);border-radius:8px;height:8px;margin:12px 0 6px"><div style="height:100%;width:${Math.min(pct,100)}%;background:${pct>=100?'#EF233C':pct>=80?'#FFB703':'#06D6A0'};border-radius:8px"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:11px;opacity:.7"><span>${fmtPct(pct)} consumido</span><span>${fmtNum(restante)} L restantes</span></div>
      </div>
      <div class="field-group"><label class="field-label">Nova meta (litros)</label><div class="field-wrap"><input class="field-input" id="p-meta" type="number" value="${META_CONSUMO}" min="500" max="50000" step="100" style="font-size:18px;font-family:var(--font);font-weight:700"><span class="field-icon" style="font-size:14px">L</span></div><div class="field-hint">Média de um apartamento: 3.000–6.000 L/mês</div></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:20px">
        ${[3000,3500,4000,4500,5000,6000].map(v=>`<button onclick="document.getElementById('p-meta').value=${v}" style="padding:10px 6px;border-radius:12px;border:1.5px solid var(--bd);background:${META_CONSUMO===v?'var(--w1)':'var(--bg)'};color:${META_CONSUMO===v?'#fff':'var(--txt2)'};font-size:12px;font-weight:700;font-family:var(--font);cursor:pointer">${(v/1000).toFixed(1)}k L</button>`).join('')}
      </div>
      <div id="meta-fb" style="display:none;background:var(--okl);border:1.5px solid var(--ok);border-radius:12px;padding:10px 14px;font-size:12px;font-weight:600;color:#047a57;margin-bottom:12px;text-align:center">🎯 Meta atualizada!</div>
      <button class="btn-primary" onclick="salvarMeta()">Salvar meta</button>
      <button class="btn-outline" style="margin-top:10px" onclick="irPerfilSub('menu')">Cancelar</button>
      <div style="height:24px"></div>
    </div>`;
}

async function salvarMeta() {
  const val = parseInt(document.getElementById('p-meta')?.value||0);
  if (!val || val<500) { alert('Informe uma meta válida (mínimo 500 L)'); return; }
  META_CONSUMO = val;
  await apiFetch('/usuario/meta', { method:'PUT', body:JSON.stringify({meta:val}) });
  if (STATE.consumo) STATE.consumo.meta_mensal = val;
  const fb = document.getElementById('meta-fb');
  if (fb) { fb.style.display='block'; setTimeout(()=>{ fb.style.display='none'; irPerfilSub('menu'); }, 1800); }
}

function renderPerfilSenha() {
  document.getElementById('tab-perfil').innerHTML = `
    <div class="profile-sub-header"><button class="psub-back" onclick="irPerfilSub('menu')">← Voltar</button><div class="psub-title">Alterar senha</div></div>
    <div class="profile-menu" style="padding-top:8px">
      <div style="background:var(--a3);border-radius:14px;padding:14px;margin-bottom:20px;font-size:12px;color:var(--w3);line-height:1.6">🔒 Use uma senha com pelo menos 8 caracteres, incluindo letras maiúsculas, números e símbolos.</div>
      <div class="field-group"><label class="field-label">Senha atual</label><div class="field-wrap"><input class="field-input" id="p-pass-atual" type="password" placeholder="Sua senha atual"><span class="field-icon" onclick="togglePass('p-pass-atual',this)">👁</span></div><div class="field-err" id="p-pass-atual-err">Senha incorreta</div></div>
      <div class="field-group"><label class="field-label">Nova senha</label><div class="field-wrap"><input class="field-input" id="p-pass-nova" type="password" placeholder="Mínimo 8 caracteres" oninput="checkStrength(this.value,'p')"><span class="field-icon" onclick="togglePass('p-pass-nova',this)">👁</span></div><div class="strength-bar"><div class="seg" id="pseg1"></div><div class="seg" id="pseg2"></div><div class="seg" id="pseg3"></div><div class="seg" id="pseg4"></div></div><div class="str-label" id="pstr-label">Digite uma senha</div><div class="field-err" id="p-pass-nova-err">Mínimo 8 caracteres</div></div>
      <div class="field-group"><label class="field-label">Confirmar nova senha</label><div class="field-wrap"><input class="field-input" id="p-pass-conf" type="password" placeholder="Repita a nova senha"><span class="field-icon" onclick="togglePass('p-pass-conf',this)">👁</span></div><div class="field-err" id="p-pass-conf-err">Senhas não coincidem</div></div>
      <div id="senha-fb" style="display:none;background:var(--okl);border:1.5px solid var(--ok);border-radius:12px;padding:10px 14px;font-size:12px;font-weight:600;color:#047a57;margin-bottom:12px;text-align:center">🔒 Senha alterada com sucesso!</div>
      <button class="btn-primary" onclick="salvarSenha()">Alterar senha</button>
      <button class="btn-outline" style="margin-top:10px" onclick="irPerfilSub('menu')">Cancelar</button>
      <div style="height:24px"></div>
    </div>`;
}

async function salvarSenha() {
  const atual = document.getElementById('p-pass-atual')?.value||'';
  const nova  = document.getElementById('p-pass-nova')?.value||'';
  const conf  = document.getElementById('p-pass-conf')?.value||'';
  let ok=true;
  if (!atual) { showErr('p-pass-atual','Informe a senha atual'); ok=false; }
  if (nova.length<8) { showErr('p-pass-nova','Mínimo 8 caracteres'); ok=false; }
  if (nova!==conf) { showErr('p-pass-conf','Senhas não coincidem'); ok=false; }
  if (!ok) return;
  const res = await apiFetch('/usuario/senha', { method:'PUT', body:JSON.stringify({atual, nova}) });
  if (res === null) { showErr('p-pass-atual','Senha atual incorreta'); return; }
  const fb = document.getElementById('senha-fb');
  if (fb) { fb.style.display='block'; setTimeout(()=>{ fb.style.display='none'; irPerfilSub('menu'); }, 2000); }
}

function renderPerfilHistorico() {
  const meses=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const hoje=new Date();
  const dados=Array.from({length:12},(_,i)=>{
    const d=new Date(hoje.getFullYear(),hoje.getMonth()-11+i,1);
    const base=2800+Math.random()*2200;
    return { mes:meses[d.getMonth()], ano:d.getFullYear(), valor:Math.round(base), fatura:(base*0.023+8).toFixed(2) };
  });
  const maxVal=Math.max(...dados.map(d=>d.valor));
  document.getElementById('tab-perfil').innerHTML=`
    <div class="profile-sub-header"><button class="psub-back" onclick="irPerfilSub('menu')">← Voltar</button><div class="psub-title">Histórico completo</div></div>
    <div class="profile-menu" style="padding-top:8px">
      <div class="psub-section">Consumo mensal (L)</div>
      <div style="margin-bottom:20px">
        ${dados.map((d,i)=>`
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <div style="width:36px;font-size:10px;font-weight:700;color:var(--txt2);text-align:right;flex-shrink:0">${d.mes}</div>
            <div style="flex:1;background:var(--bg3);border-radius:6px;height:22px;overflow:hidden">
              <div style="height:100%;width:${Math.round((d.valor/maxVal)*100)}%;background:${i===11?'var(--w1)':'var(--w2)'};border-radius:6px;display:flex;align-items:center;padding-left:8px;min-width:40px">
                <span style="font-size:9px;font-weight:700;color:#fff;white-space:nowrap">${d.valor.toLocaleString('pt-BR')}</span>
              </div>
            </div>
            <div style="width:56px;font-size:10px;font-weight:700;color:var(--ok);text-align:right;flex-shrink:0">R$${d.fatura}</div>
          </div>`).join('')}
      </div>
      <div style="background:linear-gradient(135deg,var(--w3),var(--w4));border-radius:18px;padding:18px 20px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center">
        <div><div style="font-size:11px;color:rgba(255,255,255,.6);font-weight:600">Total anual</div><div style="font-family:var(--font);font-size:26px;font-weight:800;color:#fff;letter-spacing:-1px;margin-top:2px">${fmtNum(dados.reduce((a,d)=>a+d.valor,0))} <span style="font-size:13px;font-weight:400;opacity:.7">L</span></div></div>
        <div style="text-align:right"><div style="font-size:11px;color:rgba(255,255,255,.6);font-weight:600">Total faturas</div><div style="font-family:var(--font);font-size:20px;font-weight:800;color:var(--a2);letter-spacing:-0.5px;margin-top:2px">${fmtBRL(dados.reduce((a,d)=>a+parseFloat(d.fatura),0))}</div></div>
      </div>
      <div style="height:24px"></div>
    </div>`;
}

function exportarRelatorio() {
  const d = STATE.consumo || _mockDashboard();
  const u = STATE.user || {};
  const txt = `=== RELATÓRIO SmartWater ===\nData: ${new Date().toLocaleDateString('pt-BR')}\nMorador: ${u.nome||'—'}\nUnidade: Apto ${u.apto||'—'}, ${u.condominio||'—'}\n\nCONSUMO:\n- Mês atual:    ${fmtNum(d.consumo_mes_atual)} L\n- Hoje:         ${fmtNum(d.consumo_hoje)} L\n- Média diária: ${fmtNum(d.media_diaria)} L/dia\n- Meta mensal:  ${fmtNum(META_CONSUMO)} L\n\nFINANCEIRO:\n- Estimativa da fatura: ${fmtBRL(d.estimativa_fatura)}\n===========================`;
  navigator.clipboard?.writeText(txt).then(()=>alert('✅ Relatório copiado!')).catch(()=>prompt('Copie o relatório:', txt));
}

function confirmarSair() {
  if (confirm('Deseja sair da sua conta SmartWater?')) {
    clearAuth();
    window.location.replace('index.html');
  }
}

// ═══════════════════════════════════════════════════
//  DESKTOP PANEL
// ═══════════════════════════════════════════════════
function updateDesktopPanel() {
  const d = STATE.consumo;
  if (!d) return;
  const pct = Math.round((d.consumo_mes_atual / d.meta_mensal) * 100);
  const varNeg = d.variacao_mes_anterior < 0;
  const el = id => document.getElementById(id);

  if (el('dp-consumo')) el('dp-consumo').textContent = fmtNum(d.consumo_mes_atual);
  if (el('dp-fatura')) el('dp-fatura').textContent = Math.round(d.estimativa_fatura);
  if (el('dp-meta-pct')) el('dp-meta-pct').textContent = pct;

  const naoLidos = STATE.notificacoes.filter(n => !n.lido);
  if (el('dp-alertas')) el('dp-alertas').textContent = naoLidos.length;

  const trend = el('dp-trend-consumo');
  if (trend) {
    trend.className = 'dp-trend ' + (varNeg ? 'down' : 'up');
    trend.textContent = (varNeg ? '↓' : '↑') + ' ' + fmtPct(Math.abs(d.variacao_mes_anterior));
  }

  const lista = el('dp-notifs-list');
  if (lista && STATE.notificacoes.length > 0) {
    const recentes = (naoLidos.length > 0 ? naoLidos : STATE.notificacoes).slice(0, 3);
    const cor = { critico: 'var(--err)', alerta: 'var(--warn)', ok: 'var(--ok)', info: 'var(--w1)' };
    lista.innerHTML = recentes.map(n => `
      <div class="dp-notif-row" style="border-left:3px solid ${cor[n.nivel] || 'var(--w1)'}">
        <div>${n.icone}</div>
        <div>
          <div style="font-size:12px;font-weight:700;color:var(--txt)">${n.titulo}</div>
          <div style="font-size:11px;color:var(--txt2);margin-top:2px">${n.tempo || n.desc?.slice(0,40) || ''}</div>
        </div>
      </div>`).join('');
  }
}

// ═══════════════════════════════════════════════════
//  CONSUMO DETALHADO (por hora / por dia)
// ═══════════════════════════════════════════════════
let consumoVista = 'hora'; // hora | dia

async function renderConsumoDetalhado() {
  const cont = document.getElementById('tab-consumo-det');
  if (!cont) return;
  cont.innerHTML = '<div class="loading-shimmer" style="height:300px;border-radius:16px"></div>';

  const dados = consumoVista === 'hora'
    ? await apiFetch('/consumo/por-hora') || _mockPorHora()
    : await apiFetch('/consumo/por-dia')  || _mockPorDia();

  const tabs = `
    <div style="display:flex;gap:6px;margin-bottom:14px">
      <button class="period-tab ${consumoVista==='hora'?'active':''}" onclick="mudaVistaConsumo('hora')">Por hora</button>
      <button class="period-tab ${consumoVista==='dia'?'active':''}" onclick="mudaVistaConsumo('dia')">Por dia</button>
    </div>`;

  if (consumoVista === 'hora') {
    const maxV = Math.max(...dados.filter(d=>d.tem_dado).map(d=>d.consumo_l||0), 1);
    const rows = dados.map(d => {
      if (!d.tem_dado) return `<tr><td style="color:var(--txt3)">${d.hora}</td><td colspan="3" style="color:var(--txt3);font-size:11px">—</td></tr>`;
      const pct = Math.round((d.consumo_l / maxV) * 80);
      const cor = d.status === 'vazamento' ? '#EF233C' : d.status === 'pico' ? '#FFB703' : 'var(--w1)';
      return `<tr>
        <td style="font-weight:600">${d.hora}</td>
        <td>${d.consumo_l} L</td>
        <td><span style="display:inline-block;width:${pct}%;height:6px;border-radius:3px;background:${cor};min-width:4px"></span></td>
        <td><span class="hora-status ${d.status}">${d.status==='vazamento'?'⚠️ Vazamento':d.status==='pico'?'📊 Pico':'✓'}</span></td>
      </tr>`;
    }).join('');

    const total = dados.reduce((a,d)=>a+(d.consumo_l||0),0);
    cont.innerHTML = tabs + `
      <div class="card animate-in">
        <div class="card-title">Consumo hora a hora — hoje <span style="font-size:11px;color:var(--w1);font-weight:600">${total} L total</span></div>
        <div style="overflow-x:auto">
          <table class="hora-table">
            <thead><tr><th>Hora</th><th>Consumo</th><th>Barra</th><th>Status</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  } else {
    const maxV = Math.max(...dados.map(d=>d.value||0), 1);
    const rows = dados.map(d => {
      const pct = Math.round((d.value / maxV) * 80);
      const cor = d.status === 'alto' ? '#EF233C' : d.status === 'baixo' ? '#06D6A0' : 'var(--w1)';
      return `<tr>
        <td><span style="font-weight:700">${d.dia_semana}</span> <span style="color:var(--txt3);font-size:11px">${d.data}</span></td>
        <td>${d.value} L</td>
        <td><span style="display:inline-block;width:${pct}%;height:6px;border-radius:3px;background:${cor};min-width:4px"></span></td>
        <td><span class="hora-status ${d.status === 'alto' ? 'vazamento' : d.status === 'baixo' ? 'normal' : 'normal'}">${d.status==='alto'?'↑ Alto':d.status==='baixo'?'↓ Baixo':'✓ Normal'}</span></td>
      </tr>`;
    }).join('');

    cont.innerHTML = tabs + `
      <div class="card animate-in">
        <div class="card-title">Consumo diário — últimas 2 semanas</div>
        <div style="overflow-x:auto">
          <table class="hora-table">
            <thead><tr><th>Dia</th><th>Consumo</th><th>Barra</th><th>Status</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }
}

function mudaVistaConsumo(vista) {
  consumoVista = vista;
  renderConsumoDetalhado();
}

function _mockPorHora() {
  const hora = new Date().getHours();
  return Array.from({length:24}, (_,h) => ({
    hora: `${String(h).padStart(2,'0')}h`,
    consumo_l: h > hora ? null : Math.round(Math.random() * 28 + (h>=6&&h<=9||h>=18&&h<=22?15:2)),
    tem_dado: h <= hora,
    status: h === 3 && Math.random() < .15 ? 'vazamento' : (h>=6&&h<=9||h>=18&&h<=22?'pico':'normal'),
  }));
}
function _mockPorDia() {
  const dias = ['Seg','Ter','Qua','Qui','Sex','Sab','Dom'];
  const hoje = new Date();
  return Array.from({length:14}, (_,i) => {
    const dt = new Date(hoje); dt.setDate(dt.getDate()-13+i);
    const v  = Math.round(80 + Math.random() * 140);
    return { dia_semana: dias[dt.getDay()], data: `${dt.getDate()}/${dt.getMonth()+1}`, value: v, status: v>180?'alto':v<85?'baixo':'normal' };
  });
}

// ═══════════════════════════════════════════════════
//  REDE — visão do MORADOR
// ═══════════════════════════════════════════════════
async function renderContasMorador() {
  const cont = document.getElementById('tab-sindico');
  if (!cont) return;
  cont.innerHTML = '<div class="loading-shimmer" style="height:180px;border-radius:16px;margin-bottom:14px"></div>';

  const contas = await apiFetch('/contas/minhas') || [];
  const statusLabel = { pago:'Pago', pendente:'Pendente', atrasado:'Atrasado' };
  const statusIcon = { pago:'✅', pendente:'💰', atrasado:'⚠️' };
  const abertas = contas.filter(c => c.status !== 'pago');
  const totalAberto = abertas.reduce((sum, c) => sum + Number(c.valor_rs || 0), 0);

  const items = contas.map(c => `
    <div class="conta-item animate-in">
      <div class="conta-avatar">${statusIcon[c.status] || '💧'}</div>
      <div class="conta-info">
        <div class="conta-nome">${formatMesRef(c.mes_ref)}</div>
        <div class="conta-unidade">${fmtNum(c.consumo_l || 0)} L consumidos · vence ${fmtDateBR(c.data_vencimento)}</div>
      </div>
      <div class="conta-right">
        <div class="conta-valor">${fmtBRL(c.valor_rs || 0)}</div>
        <span class="conta-status-badge ${c.status}">${statusLabel[c.status] || c.status}</span>
      </div>
    </div>`).join('');

  cont.innerHTML = `
    <div style="padding-top:6px">
      <div class="fatura-card animate-in" style="margin-bottom:14px">
        <div class="fatura-icon">💰</div>
        <div>
          <div class="fatura-label">Contas em aberto</div>
          <div class="fatura-value">${fmtBRL(totalAberto)}</div>
          <div class="fatura-sub">${abertas.length} fatura(s) pendente(s) do seu apartamento</div>
        </div>
      </div>

      <div class="card animate-in">
        <div class="card-title">Minhas contas</div>
        ${items || '<div style="text-align:center;color:var(--txt2);padding:28px;font-size:13px">Nenhuma conta encontrada para sua unidade.</div>'}
      </div>
    </div>`;
}

function formatMesRef(mesRef) {
  if (!mesRef || !mesRef.includes('-')) return mesRef || 'Fatura';
  const [ano, mes] = mesRef.split('-');
  const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${nomes[Number(mes) - 1] || mes}/${ano}`;
}

function fmtDateBR(dateStr) {
  if (!dateStr) return '—';
  const [ano, mes, dia] = dateStr.split('-');
  if (!ano || !mes || !dia) return dateStr;
  return `${dia}/${mes}/${ano}`;
}

async function renderRedeMorador() {
  const cont = document.getElementById('tab-sindico');
  if (!cont) return;
  cont.innerHTML = '<div class="loading-shimmer" style="height:200px;border-radius:16px;margin-bottom:14px"></div>';

  const pressoes = await apiFetch('/pressao/dashboard') || [];
  const balanco  = await apiFetch('/rede/balanco')     || {};

  const statusGeral = balanco.status_geral || 'normal';
  const corGeral = statusGeral==='vazamento' ? 'var(--err)' : statusGeral==='atencao' ? 'var(--warn)' : 'var(--ok)';
  const iconGeral = statusGeral==='vazamento' ? '🚨' : statusGeral==='atencao' ? '⚠️' : '✅';

  const iconeTipo = { captacao: '💧', reservatorio: '🏗️', distribuicao: '🌐' };
  const zonaCards = pressoes.map(z => `
    <div class="pressao-card ${z.status} animate-in">
      <div class="pressao-zona-nome">${z.nome}</div>
      <div class="pressao-valor">${(z.pressao_atual/1000).toFixed(1)}<span class="pressao-unidade"> kmmH2O</span></div>
      <div class="pressao-bar-wrap">
        <div class="pressao-bar-fill" style="width:${Math.min((z.pressao_atual/50000)*100,100)}%;background:${z.status==='critico'?'var(--err)':z.status==='atencao'?'var(--warn)':'var(--ok)'}"></div>
      </div>
      <div style="margin-top:6px"><span class="pressao-status-badge ${z.status}">${z.status==='critico'?'⚠️ Crítico':z.status==='atencao'?'↓ Atenção':'✓ Normal'}</span></div>
    </div>`).join('');

  cont.innerHTML = `
    <div style="padding-top:6px">
      <div class="rede-morador-card animate-in">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="font-size:32px">${iconGeral}</div>
          <div>
            <div class="rede-morador-title">Rede de Distribuição</div>
            <div class="rede-morador-sub">Status geral: <strong style="color:${corGeral}">${statusGeral.charAt(0).toUpperCase()+statusGeral.slice(1)}</strong>
            ${balanco.perda_total_pct ? ` · Perda: <strong>${balanco.perda_total_pct}%</strong>` : ''}</div>
          </div>
        </div>
      </div>

      <div class="card animate-in">
        <div class="card-title">Pressão por zona</div>
        <div class="pressao-grid">${zonaCards || '<div style="color:var(--txt2);font-size:13px;padding:12px">Carregando dados da rede...</div>'}</div>
      </div>

      <div class="card animate-in">
        <div class="card-title">O que significa a pressão?</div>
        <div class="tip-item"><div class="tip-emoji">✅</div><div><div class="tip-title">Normal (≥ 20.000 mmH2O)</div><div class="tip-desc">Abastecimento garantido em todos os andares.</div></div></div>
        <div class="tip-item"><div class="tip-emoji">⚠️</div><div><div class="tip-title">Atenção (15.000–20.000 mmH2O)</div><div class="tip-desc">Pressão reduzida, pode afetar andares mais altos.</div></div></div>
        <div class="tip-item"><div class="tip-emoji">🚨</div><div><div class="tip-title">Crítico (abaixo de 15.000 mmH2O)</div><div class="tip-desc">Risco de interrupção. Contate o síndico imediatamente.</div></div></div>
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════════
//  SÍNDICO EXPANDIDO — Sub-navegação
// ═══════════════════════════════════════════════════
let sindicoSub = 'visao_geral';
const SIND_TABS = [
  { id:'visao_geral', label:'Visão Geral' },
  { id:'consumo',     label:'Moradores' },
  { id:'contas',      label:'Contas' },
  { id:'notificar',   label:'Notificar' },
];

function irSindicoSub(sub) { sindicoSub = sub; renderSindico(); document.getElementById('tab-sindico')?.scrollTo(0,0); }

// Override renderSindico para usar nova lógica baseada em perfil
const _renderSindicoOriginal = renderSindico;
window.renderSindico = function renderSindico() {
  const isSindico = STATE.user?.perfil === 'sindico';
  const isOperador = STATE.user?.perfil === 'operador';
  const isMorador = !isSindico && !isOperador;
  if (isMorador) {
    renderContasMorador();
    return;
  }
  if (isOperador && !STATE.sindicoAuth) {
    renderRedeMorador();
    return;
  }
  // Síndico autenticado: mostrar painel completo
  switch(sindicoSub) {
    case 'consumo':   _renderSindConsumo();   break;
    case 'contas':    _renderSindContas();    break;
    case 'notificar': _renderSindNotificar(); break;
    default:          _renderSindVisaoGeral();break;
  }
};

function _sindNavHtml() {
  return `<div class="sind-nav">${SIND_TABS.map(t=>`<button class="sind-tab ${sindicoSub===t.id?'active':''}" onclick="irSindicoSub('${t.id}')">${t.label}</button>`).join('')}</div>`;
}

async function _renderSindVisaoGeral() {
  const cont = document.getElementById('tab-sindico');
  if (!cont) return;
  const res = await apiFetch('/contas/resumo-sindico') || { total_moradores:0, contas_pendentes:0, contas_atrasadas:0, valor_a_receber:0, consumo_total_l:0 };
  const contasAbertas = (res.contas_pendentes || 0) + (res.contas_atrasadas || 0);

  cont.innerHTML = `<div style="padding-top:6px">
    ${_sindNavHtml()}
    <div class="kpi-grid animate-in">
      <div class="kpi-card"><div class="kpi-label">Moradores</div><div class="kpi-value">${res.total_moradores}</div><div class="kpi-sub">unidades ativas</div></div>
      <div class="kpi-card"><div class="kpi-label">Consumo do mês</div><div class="kpi-value">${fmtLn(res.consumo_total_l)}</div><div class="kpi-sub">litros</div></div>
      <div class="kpi-card"><div class="kpi-label">Contas em aberto</div><div class="kpi-value ${res.contas_atrasadas>0?'warn':''}">${contasAbertas}</div><div class="kpi-sub">${res.contas_pendentes || 0} pendentes - ${res.contas_atrasadas || 0} atrasadas</div></div>
      <div class="kpi-card"><div class="kpi-label">Valor a receber</div><div class="kpi-value ok">${fmtBRL(res.valor_a_receber)}</div><div class="kpi-sub">condominio</div></div>
    </div>
    <div class="kpi-card animate-in" style="margin-bottom:14px;padding:16px">
      <div class="kpi-label">💰 A receber</div>
      <div class="kpi-value ok" style="font-size:32px">${fmtBRL(res.valor_a_receber)}</div>
      <div class="kpi-sub">total de contas pendentes + atrasadas</div>
    </div>
    <div class="card animate-in" style="padding:14px">
      <div class="card-title">Acesso rápido</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${[['💧','Moradores','consumo'],['📋','Contas','contas'],['📢','Notificar','notificar']].map(([ic,lb,id])=>`
          <button onclick="irSindicoSub('${id}')" style="display:flex;align-items:center;gap:10px;background:var(--bg2);border:none;border-radius:12px;padding:12px;cursor:pointer;font-family:var(--body)">
            <span style="font-size:20px">${ic}</span>
            <span style="font-size:13px;font-weight:600;color:var(--txt)">${lb}</span>
          </button>`).join('')}
      </div>
    </div>
    <button class="btn-outline" style="margin-top:4px" onclick="STATE.sindicoAuth=false;STATE.user&&(STATE.user.perfil!=='sindico')&&renderSindico()">🔓 Sair do painel administrativo</button>
  </div>`;
}

async function _renderSindConsumo() {
  const cont = document.getElementById('tab-sindico');
  if (!cont) return;
  cont.innerHTML = `<div style="padding-top:6px">${_sindNavHtml()}<div class="loading-shimmer" style="height:300px;border-radius:16px"></div></div>`;

  const res = await apiFetch('/contas/consumo-moradores') || { moradores:[], media_l:0 };
  const moradores = res.moradores || [];
  const media = res.media_l || 0;
  const maxC = Math.max(...moradores.map(m=>m.consumo_l||0), 1);

  const rows = moradores.map(m => {
    const pct = Math.round((m.consumo_l/maxC)*80);
    const diff = m.vs_media_pct;
    const corDiff = diff > 20 ? 'var(--err)' : diff > 10 ? 'var(--warn)' : 'var(--ok)';
    return `<tr>
      <td><div style="font-size:12px;font-weight:700;color:var(--txt)">${m.nome.split(' ')[0]}</div><div style="font-size:10px;color:var(--txt2)">${m.unidade}</div></td>
      <td style="font-size:12px;font-weight:700">${fmtNum(m.consumo_l)} L</td>
      <td><span style="display:inline-block;width:${pct}%;height:6px;border-radius:3px;background:var(--w1);min-width:4px"></span></td>
      <td style="font-size:11px;font-weight:700;color:${corDiff}">${diff>0?'+':''}${diff}%</td>
    </tr>`;
  }).join('');

  document.getElementById('tab-sindico').innerHTML = `<div style="padding-top:6px">
    ${_sindNavHtml()}
    <div class="card animate-in">
      <div class="card-title">Consumo dos moradores <span style="font-size:11px;color:var(--txt2);font-weight:500">Média: ${fmtNum(media)} L</span></div>
      <div style="overflow-x:auto">
        <table class="hora-table">
          <thead><tr><th>Morador</th><th>Consumo</th><th>Proporção</th><th>vs Média</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="4" style="text-align:center;color:var(--txt2);padding:20px">Sem dados</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  </div>`;
}

async function _renderSindContas() {
  const cont = document.getElementById('tab-sindico');
  if (!cont) return;
  cont.innerHTML = `<div style="padding-top:6px">${_sindNavHtml()}<div class="loading-shimmer" style="height:300px;border-radius:16px"></div></div>`;

  const contas = await apiFetch('/contas/todos') || [];

  const status_label = { pago:'Pago', pendente:'Pendente', atrasado:'Atrasado', sem_conta:'Sem conta' };
  const items = contas.map(c => `
    <div class="conta-item animate-in">
      <div class="conta-avatar">🏠</div>
      <div class="conta-info">
        <div class="conta-nome">${c.nome}</div>
        <div class="conta-unidade">Bloco ${c.bloco||'—'} · Apto ${c.apto||'—'}</div>
      </div>
      <div class="conta-right">
        <div class="conta-valor">${fmtBRL(c.valor_rs)}</div>
        <span class="conta-status-badge ${c.status}">${status_label[c.status]||c.status}</span>
      </div>
      ${c.status !== 'pago' ? `<button onclick="marcarContaPaga(${c.id})" style="position:absolute;right:10px;bottom:6px;background:none;border:none;font-size:10px;color:var(--w1);font-weight:700;cursor:pointer;font-family:var(--body)">Marcar pago</button>` : ''}
    </div>`).join('');

  const total = contas.reduce((a,c)=>a+c.valor_rs,0);
  const pendentes = contas.filter(c=>c.status!=='pago').length;

  document.getElementById('tab-sindico').innerHTML = `<div style="padding-top:6px">
    ${_sindNavHtml()}
    <div class="fatura-card animate-in" style="margin-bottom:14px">
      <div class="fatura-icon">💰</div>
      <div>
        <div class="fatura-label">Total do mês</div>
        <div class="fatura-value">${fmtBRL(total)}</div>
        <div class="fatura-sub">${pendentes} conta(s) não pagas</div>
      </div>
    </div>
    <div style="margin-bottom:14px">${items || '<div style="text-align:center;color:var(--txt2);padding:32px">Nenhuma conta encontrada</div>'}</div>
  </div>`;
}

async function marcarContaPaga(contaId) {
  await apiFetch(`/contas/${contaId}/status`, { method:'PUT', body:JSON.stringify({status:'pago'}) });
  _renderSindContas();
}

async function _renderSindPerdas() {
  const cont = document.getElementById('tab-sindico');
  if (!cont) return;
  cont.innerHTML = `<div style="padding-top:6px">${_sindNavHtml()}<div class="loading-shimmer" style="height:300px;border-radius:16px"></div></div>`;

  const dados = await apiFetch('/rede/perdas/resumo') || { perda_fisica_pct:12, perda_comercial_pct:8, perda_total_pct:20, perda_fisica_litros:0, historico_mensal:[] };

  const maxH = Math.max(...(dados.historico_mensal||[]).map(h=>h.consumo_l||0), 1);
  const histBars = (dados.historico_mensal||[]).map(h => {
    const pct = Math.round((h.consumo_l/maxH)*90);
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
      <div style="font-size:10px;font-weight:700;color:var(--txt2)">${fmtLn(h.consumo_l)}</div>
      <div style="width:100%;height:60px;display:flex;align-items:flex-end">
        <div style="width:100%;height:${pct}%;background:var(--w1);border-radius:4px 4px 0 0;min-height:4px"></div>
      </div>
      <div style="font-size:9px;color:var(--txt3)">${h.mes}</div>
    </div>`;
  }).join('');

  const corFisica   = dados.perda_fisica_pct  > 10 ? '#EF233C' : dados.perda_fisica_pct  > 5 ? '#FFB703' : '#06D6A0';
  const corComercial= dados.perda_comercial_pct>10 ? '#EF233C' : dados.perda_comercial_pct>5 ? '#FFB703' : '#06D6A0';

  document.getElementById('tab-sindico').innerHTML = `<div style="padding-top:6px">
    ${_sindNavHtml()}
    <div class="rede-resumo animate-in">
      <div class="rede-resumo-title">Perda total na rede</div>
      <div class="rede-perda-valor">${dados.perda_total_pct}%</div>
      <div class="rede-perda-label">${fmtNum(dados.perda_fisica_litros)} L perdidos no mês</div>
      <div class="rede-stats-row">
        <div class="rede-stat"><div class="rede-stat-val">${dados.perda_fisica_pct}%</div><div class="rede-stat-label">Perda física</div></div>
        <div class="rede-stat"><div class="rede-stat-val">${dados.perda_comercial_pct}%</div><div class="rede-stat-label">Perda comercial</div></div>
      </div>
    </div>
    <div class="card animate-in">
      <div class="card-title">Detalhamento</div>
      <div class="perda-bar-row">
        <div class="perda-bar-label">Perda física</div>
        <div class="perda-bar-track"><div class="perda-bar-fill" style="width:${Math.min(dados.perda_fisica_pct*4,100)}%;background:${corFisica}"></div></div>
        <div class="perda-bar-pct" style="color:${corFisica}">${dados.perda_fisica_pct}%</div>
      </div>
      <div class="perda-bar-row">
        <div class="perda-bar-label">Perda comercial</div>
        <div class="perda-bar-track"><div class="perda-bar-fill" style="width:${Math.min(dados.perda_comercial_pct*4,100)}%;background:${corComercial}"></div></div>
        <div class="perda-bar-pct" style="color:${corComercial}">${dados.perda_comercial_pct}%</div>
      </div>
      <div class="tip-item" style="padding-top:12px"><div class="tip-emoji">📌</div><div><div class="tip-title">Referência DAAE</div><div class="tip-desc">Perda ≤ 5%: normal · 5–10%: atenção · &gt;10%: investigar vazamento</div></div></div>
    </div>
    <div class="card animate-in">
      <div class="card-title">Histórico de consumo</div>
      <div style="display:flex;gap:6px;align-items:flex-end;height:90px;margin-bottom:8px">${histBars}</div>
    </div>
  </div>`;
}

async function _renderSindRede() {
  const cont = document.getElementById('tab-sindico');
  if (!cont) return;
  cont.innerHTML = `<div style="padding-top:6px">${_sindNavHtml()}<div class="loading-shimmer" style="height:300px;border-radius:16px"></div></div>`;

  const [zonas, balanco] = await Promise.all([
    apiFetch('/rede/zonas')   || [],
    apiFetch('/rede/balanco') || {},
  ]);

  const iconeTipo = { captacao:'💧', reservatorio:'🏗️', distribuicao:'🌐' };
  const zonaItems = (zonas||[]).map(z => `
    <div class="zona-item ${z.status_balanco} animate-in">
      <div class="zona-icon ${z.tipo}">${iconeTipo[z.tipo]||'🔵'}</div>
      <div style="flex:1;min-width:0">
        <div class="zona-nome">${z.nome}</div>
        <div class="zona-meta">${(z.pressao_mmh2o/1000).toFixed(1)} kmmH2O · E:${z.vazao_entrada_ls} S:${z.vazao_saida_ls} L/s</div>
      </div>
      <span class="zona-perda-chip ${z.status_balanco}">${z.perda_pct}%</span>
    </div>`).join('');

  const pressoesGrid = (zonas||[]).map(z => `
    <div class="pressao-card ${z.status_pressao}">
      <div class="pressao-zona-nome">${z.nome}</div>
      <div class="pressao-valor">${(z.pressao_mmh2o/1000).toFixed(1)}<span class="pressao-unidade"> k</span></div>
      <div class="pressao-bar-wrap">
        <div class="pressao-bar-fill" style="width:${Math.min((z.pressao_mmh2o/50000)*100,100)}%;background:${z.status_pressao==='critico'?'var(--err)':z.status_pressao==='atencao'?'var(--warn)':'var(--ok)'}"></div>
      </div>
    </div>`).join('');

  document.getElementById('tab-sindico').innerHTML = `<div style="padding-top:6px">
    ${_sindNavHtml()}
    <div class="rede-resumo animate-in">
      <div class="rede-resumo-title">Balanço hídrico geral</div>
      <div class="rede-perda-valor">${balanco.perda_total_pct||0}%</div>
      <div class="rede-perda-label">perda total · ${fmtNum(balanco.perda_vol_litros||0)} L/h perdidos</div>
      <div class="rede-stats-row">
        <div class="rede-stat"><div class="rede-stat-val">${balanco.total_entrada_ls||0} L/s</div><div class="rede-stat-label">Entrada</div></div>
        <div class="rede-stat"><div class="rede-stat-val">${balanco.total_saida_ls||0} L/s</div><div class="rede-stat-label">Saída</div></div>
      </div>
    </div>
    <div class="card animate-in">
      <div class="card-title">Pressão por zona <span style="font-size:10px;color:var(--txt3)">(mmH2O × 1000)</span></div>
      <div class="pressao-grid">${pressoesGrid}</div>
    </div>
    <div class="card animate-in">
      <div class="card-title">Balanço por zona</div>
      ${zonaItems}
    </div>
  </div>`;
}

async function _renderSindSensores() {
  const cont = document.getElementById('tab-sindico');
  if (!cont) return;
  const sensores = await apiFetch('/sensores/') || [];

  const items = sensores.map(s => {
    const batCor = s.bateria_pct > 50 ? 'ok' : s.bateria_pct > 20 ? 'warn' : 'crit';
    const stDot  = s.status?.toLowerCase() === 'ativo' ? 'ativo' : s.status?.toLowerCase() === 'inativo' ? 'inativo' : 'atencao';
    return `<div class="sensor-item animate-in">
      <div class="sensor-dot ${stDot}"></div>
      <div style="flex:1;min-width:0">
        <div class="sensor-nome">${s.nome}</div>
        <div class="sensor-meta">${s.localizacao} · ${s.tipo||'vazao'} · Crit. ${s.criticidade||2}</div>
        <div class="sensor-calib">Próx. calibração: ${s.proxima_calibracao||'—'}</div>
      </div>
      <div class="sensor-bateria-wrap">
        <div class="sensor-bateria-val ${batCor}">${s.bateria_pct||'—'}%</div>
        <div style="font-size:9px;color:var(--txt3)">bateria</div>
      </div>
    </div>`;
  }).join('');

  cont.innerHTML = `<div style="padding-top:6px">
    ${_sindNavHtml()}
    <div class="card animate-in">
      <div class="card-title">Sensores da rede</div>
      ${items || '<div style="text-align:center;color:var(--txt2);padding:24px">Nenhum sensor cadastrado</div>'}
    </div>
    <div class="card animate-in">
      <div class="card-title">Legenda de criticidade</div>
      <div class="tip-item"><div class="tip-emoji">🔴</div><div><div class="tip-title">Nível 3 (Alta criticidade)</div><div class="tip-desc">Calibração anual. Ex: sensor de captação principal.</div></div></div>
      <div class="tip-item"><div class="tip-emoji">🟡</div><div><div class="tip-title">Nível 2 (Média criticidade)</div><div class="tip-desc">Calibração bienal. Ex: pressões de recalque.</div></div></div>
      <div class="tip-item"><div class="tip-emoji">🟢</div><div><div class="tip-title">Nível 1 (Baixa criticidade)</div><div class="tip-desc">Calibração trienal. Ex: pressões de vizinhança.</div></div></div>
    </div>
  </div>`;
}

let notifTipo = 'cobranca';
async function _renderSindNotificar() {
  const cont = document.getElementById('tab-sindico');
  if (!cont) return;

  const usuarios = await apiFetch('/contas/consumo-moradores') || { moradores:[] };
  const moradores = usuarios.moradores || [];

  const opts = moradores.map(m => `<option value="${m.usuario_id}">${m.nome} — Apto ${m.unidade.split(' ').pop()}</option>`).join('');

  cont.innerHTML = `<div style="padding-top:6px">
    ${_sindNavHtml()}
    <div class="notif-form-card animate-in">
      <div class="card-title" style="margin-bottom:14px">Enviar notificação ao morador</div>
      <div class="notif-type-grid">
        ${[['cobranca','💰','Cobrança'],['vazamento','🚨','Vazamento'],['aviso','📢','Aviso']].map(([id,ic,lb])=>`
          <div class="notif-type-btn ${notifTipo===id?'selected':''}" onclick="selecionaTipoNotif('${id}')">
            <div class="notif-type-icon">${ic}</div>
            <div class="notif-type-label">${lb}</div>
          </div>`).join('')}
      </div>
      <div class="field-group">
        <label class="field-label">Morador</label>
        <div class="field-wrap">
          <select class="field-input" id="notif-usuario" style="padding-right:16px">
            <option value="">Selecione o morador...</option>
            ${opts}
          </select>
        </div>
      </div>
      <div class="field-group">
        <label class="field-label">Mensagem (opcional)</label>
        <textarea id="notif-msg" placeholder="Adicione detalhes..." style="width:100%;min-height:80px;border:1.5px solid var(--bd);border-radius:var(--rm);background:var(--bg2);color:var(--txt);font-size:14px;padding:12px;font-family:var(--body);resize:vertical;outline:none"></textarea>
      </div>
      <div id="notif-feedback" style="display:none;background:var(--okl);border:1.5px solid var(--ok);border-radius:12px;padding:10px 14px;font-size:12px;font-weight:600;color:#047a57;margin-bottom:12px">✅ Notificação enviada!</div>
      <button class="btn-primary" onclick="enviarNotifSindico()">Enviar notificação →</button>
    </div>
  </div>`;
}

function selecionaTipoNotif(tipo) { notifTipo = tipo; _renderSindNotificar(); }

async function enviarNotifSindico() {
  const uid = document.getElementById('notif-usuario')?.value;
  const msg = document.getElementById('notif-msg')?.value || '';
  if (!uid) { alert('Selecione um morador'); return; }
  const res = await apiFetch('/contas/notificar', { method:'POST', body: JSON.stringify({ usuario_id:parseInt(uid), tipo:notifTipo, mensagem:msg }) });
  if (res) {
    const fb = document.getElementById('notif-feedback');
    if (fb) { fb.style.display='block'; setTimeout(()=>{ fb.style.display='none'; },2500); }
  }
}

// ═══════════════════════════════════════════════════
//  HOOK: adicionar aba "Consumo detalhado" no dashboard
// ═══════════════════════════════════════════════════
const _switchTabOriginal = switchTab;
window.switchTab = function switchTab(tab) {
  _switchTabOriginal(tab);
  // Update nav label dinamicamente para morador
  const navSind = document.getElementById('nav-sindico');
  if (navSind && STATE.user) {
    if (STATE.user.perfil !== 'sindico') {
      navSind.querySelector('.nav-icon').textContent = '🌐';
      navSind.querySelector('.nav-label').textContent = 'Rede';
    } else {
      navSind.querySelector('.nav-icon').textContent = '🏢';
      navSind.querySelector('.nav-label').textContent = 'Síndico';
    }
  }
};

// Adiciona tab de consumo detalhado ao dashboard após render
const _switchTabPerfilOriginal = window.switchTab;
window.switchTab = function switchTab(tab) {
  _switchTabPerfilOriginal(tab);
  atualizarNavegacaoPorPerfil();
};

function atualizarNavegacaoPorPerfil() {
  const navDash = document.getElementById('nav-dashboard');
  const navSind = document.getElementById('nav-sindico');
  if (!STATE.user) return;

  const dashIcon = navDash?.querySelector('.nav-icon');
  const dashLabel = navDash?.querySelector('.nav-label');
  const icon = navSind?.querySelector('.nav-icon');
  const label = navSind?.querySelector('.nav-label');
  if (STATE.user.perfil === 'sindico') {
    if (dashIcon) dashIcon.textContent = '🏢';
    if (dashLabel) dashLabel.textContent = 'Condominio';
    if (icon) icon.textContent = '🏢';
    if (label) label.textContent = 'Gestao';
  } else if (STATE.user.perfil === 'operador') {
    if (dashIcon) dashIcon.textContent = '🚨';
    if (dashLabel) dashLabel.textContent = 'Alertas';
    if (icon) icon.textContent = '🌐';
    if (label) label.textContent = 'Rede';
  } else {
    if (dashIcon) dashIcon.textContent = '💧';
    if (dashLabel) dashLabel.textContent = 'Consumo';
    if (icon) icon.textContent = '💰';
    if (label) label.textContent = 'Contas';
  }
}

const _renderDashOriginal = renderDashboard;
window.renderDashboard = async function renderDashboard() {
  if (STATE.user?.perfil === 'sindico') {
    await renderDashboardSindico();
    return;
  }

  await _renderDashOriginal();
  // Injetar botão "Ver detalhes" no card de consumo
  const cont = document.getElementById('tab-dashboard');
  if (!cont) return;
  const det = document.getElementById('tab-consumo-det');
  if (!det) {
    const divDet = document.createElement('div');
    divDet.id = 'tab-consumo-det';
    divDet.className = 'app-content';
    divDet.style.display = 'none';
    cont.parentNode.insertBefore(divDet, cont.nextSibling);
  }
};

async function renderDashboardSindico() {
  const cont = document.getElementById('tab-dashboard');
  if (!cont) return;
  cont.innerHTML = '<div class="loading-shimmer" style="height:240px;border-radius:18px;margin-bottom:14px"></div>';

  const [res, consumo] = await Promise.all([
    apiFetch('/contas/resumo-sindico'),
    apiFetch('/contas/consumo-moradores'),
  ]);
  const resumo = res || { total_moradores:0, contas_pendentes:0, contas_atrasadas:0, valor_a_receber:0, consumo_total_l:0 };
  const contasAbertas = (resumo.contas_pendentes || 0) + (resumo.contas_atrasadas || 0);
  const moradores = consumo?.moradores || [];
  const maiores = moradores.slice(0, 4).map(m => `
    <div class="conta-item animate-in">
      <div class="conta-avatar">🏠</div>
      <div class="conta-info">
        <div class="conta-nome">${m.nome}</div>
        <div class="conta-unidade">${m.unidade}</div>
      </div>
      <div class="conta-right">
        <div class="conta-valor">${fmtNum(m.consumo_l)} L</div>
        <span class="conta-status-badge ${m.status}">${m.status}</span>
      </div>
    </div>`).join('');

  cont.innerHTML = `
    <div style="padding-top:6px">
      <div class="g5-badge">🏢 Visão do condomínio · ${STATE.user?.condominio || 'Condomínio'}</div>
      <div class="kpi-grid animate-in" style="margin-top:14px">
        <div class="kpi-card"><div class="kpi-label">Moradores</div><div class="kpi-value">${resumo.total_moradores}</div><div class="kpi-sub">unidades ativas</div></div>
        <div class="kpi-card"><div class="kpi-label">Consumo do mês</div><div class="kpi-value">${fmtLn(resumo.consumo_total_l)}</div><div class="kpi-sub">litros do condomínio</div></div>
        <div class="kpi-card"><div class="kpi-label">Contas em aberto</div><div class="kpi-value ${resumo.contas_atrasadas>0?'warn':''}">${contasAbertas}</div><div class="kpi-sub">${resumo.contas_pendentes || 0} pendentes - ${resumo.contas_atrasadas || 0} atrasadas</div></div>
        <div class="kpi-card"><div class="kpi-label">A receber</div><div class="kpi-value ok">${fmtBRL(resumo.valor_a_receber)}</div><div class="kpi-sub">pendentes + atrasadas</div></div>
      </div>

      <div class="card animate-in">
        <div class="card-title">Maiores consumos do condomínio</div>
        ${maiores || '<div style="text-align:center;color:var(--txt2);padding:24px">Sem dados de moradores.</div>'}
      </div>
    </div>`;
}

function verConsumoDetalhado() {
  const cont = document.getElementById('tab-dashboard');
  const det  = document.getElementById('tab-consumo-det');
  if (!cont || !det) return;
  cont.style.display = 'none';
  det.style.display  = 'block';
  renderConsumoDetalhado();
}

function voltarDashboard() {
  const cont = document.getElementById('tab-dashboard');
  const det  = document.getElementById('tab-consumo-det');
  if (!cont || !det) return;
  det.style.display  = 'none';
  cont.style.display = 'block';
}

// ═══════════════════════════════════════════════════
//  ALERTAS DA CIDADE → CONDOMÍNIO
// ═══════════════════════════════════════════════════
async function verificarAlertasCidade() {
  const perfil = STATE.user?.perfil || 'morador';
  if (perfil !== 'operador') {
    const btnCidade = document.getElementById('btn-cidade');
    const banner = document.getElementById('cidade-alerta-banner');
    if (btnCidade) btnCidade.style.display = 'none';
    if (banner) {
      banner.style.display = 'none';
      banner.innerHTML = '';
    }
    return;
  }

  const res = await apiFetch('/cidade/alertas');
  if (!res) return;

  const alertas = res.alertas || [];
  const criticos = alertas.filter(a => a.nivel === 'critico');

  // Mostrar botão cidade na header (síndico vê sempre, morador vê se houver alerta)
  const btnCidade = document.getElementById('btn-cidade');
  if (btnCidade) {
    const isSindico = STATE.user?.perfil === 'sindico';
    btnCidade.style.display = (isSindico || criticos.length > 0) ? 'flex' : 'none';
  }

  // Banner de alerta crítico da cidade
  const banner = document.getElementById('cidade-alerta-banner');
  if (banner) {
    if (criticos.length > 0) {
      banner.style.display = 'flex';
      banner.innerHTML = `<span>🚨</span><span><strong>Alerta na rede DAAE:</strong> ${criticos[0].mensagem} — <a href="./cidade.html" style="color:#fff;font-weight:700;text-decoration:underline">ver painel cidade</a></span>`;
    } else {
      banner.style.display = 'none';
    }
  }

  // Adicionar notificações da cidade ao STATE se ainda não existirem
  if (criticos.length > 0) {
    criticos.forEach(a => {
      const jaExiste = STATE.notificacoes.some(n => n.titulo && n.titulo.includes(a.zona) && n.nivel === 'critico');
      if (!jaExiste) {
        STATE.notificacoes.unshift({
          id: Date.now(),
          nivel: 'critico',
          titulo: `🌆 ${a.mensagem}`,
          desc: `Alerta detectado na rede DAAE — ${a.grupo}. Pode afetar o abastecimento do seu condomínio.`,
          icone: '🚨',
          lido: false,
          tempo: 'Agora',
          _cidade: true,
        });
      }
    });
    updateBadge();
  }
}

// Executar verificação de alertas da cidade periodicamente
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(verificarAlertasCidade, 2000);
  setInterval(verificarAlertasCidade, 60000);
});
