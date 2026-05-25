# SmartWater

SmartWater e um app web/mobile para monitoramento inteligente de consumo de agua, alertas e operacao DAAE. O projeto foi consolidado como entrega do **Grupo 6**, com frontend mobile, backend Flask, dados simulados por JSON e separacao de acesso por perfil.

## Visao Geral

O sistema atende tres tipos de usuario:

| Perfil | O que ve |
| --- | --- |
| Morador | Consumo do proprio apartamento, alertas pessoais e contas/faturas |
| Sindico | Visao geral do condominio, consumo por unidade, contas dos moradores e notificacoes |
| Operador DAAE | Visao da cidade, reservatorios, sensores, bombas, medidores, pressao, vazao, perdas e alertas criticos |

O dashboard operacional completo de outra equipe nao fica dentro da entrega do Grupo 6. O app DAAE apenas pode apontar para um painel externo quando necessario.

## Principais Recursos

- App responsivo com experiencia mobile.
- Login com perfis diferentes.
- Area do morador com consumo, metas, alertas e faturas.
- Area do sindico limitada ao proprio condominio.
- Area DAAE com dados de cidade inteira.
- Integracao por arquivo JSON simulando entrega dos outros grupos.
- Dados de pressao, vazao de entrada, vazao de saida e perda.
- Quatro reservatorios:
  - enterrado
  - semi-enterrado
  - apoiado
  - elevado
- Equipamentos monitorados:
  - bomba submersa
  - bomba de recalque
  - medidor master
  - macromedidor
  - manometro
  - medidor de nivel
- Preparado para empacotar como APK Android via Capacitor.
- Pode ser usado no iPhone como PWA pelo Safari.

## Stack

### Backend

- Python
- Flask
- SQLite
- Gunicorn para producao
- Nginx como proxy reverso

### Frontend

- HTML
- CSS
- JavaScript
- Capacitor para gerar APK Android

## Estrutura

```txt
app/
  backend/
    app.py
    data/
      smartwater_integracao.json
      README_INTEGRACAO.md
    db/
      connection.py
    rotas/
      auth.py
      cidade.py
      consumo.py
      contas.py
      integracao.py
      login.py
      notificacoes.py
      pressao.py
      rede.py
      sensores.py
      usuario.py
    services/
    models/
    controllers/

  frontend/
    capacitor.config.json
    package.json
    www/
      index.html
      login.html
      app.html
      daae.html
      styles.css
      js/
```

## Dados de Teste

Senha padrao:

```txt
Smart@123
```

Usuarios:

| Perfil | Email |
| --- | --- |
| Morador | marina.morador@smartwater.test |
| Morador com alerta | rafael.morador@smartwater.test |
| Sindico | camila.sindico@smartwater.test |
| Operador DAAE | operador@daae.com.br |

## Rodando Localmente

Entre no backend:

```bash
cd app/backend
python -m venv venv
```

Ative o ambiente:

Windows:

```powershell
.\venv\Scripts\activate
```

Linux/macOS:

```bash
source venv/bin/activate
```

Instale as dependencias:

```bash
pip install -r requirements.txt
```

Rode:

```bash
python app.py
```

Acesse:

```txt
http://localhost:5000
```

Rotas principais:

```txt
http://localhost:5000/login.html
http://localhost:5000/app.html
http://localhost:5000/daae.html
```

## APIs Principais

### Auth

```txt
POST /api/login
POST /api/auth/register
POST /api/auth/forgot
```

### Morador

```txt
GET /api/consumo/dashboard
GET /api/consumo/historico
GET /api/contas/minhas
GET /api/notificacoes/
```

### Sindico

```txt
GET /api/contas/resumo-sindico
GET /api/contas/todos
GET /api/contas/consumo-moradores
POST /api/contas/notificar
PUT /api/contas/<conta_id>/status
```

### DAAE

```txt
GET /api/cidade/dashboard
GET /api/cidade/alertas
GET /api/cidade/historico/<zona_id>
GET /api/cidade/sensores
GET /api/integracao/fonte-json
GET /api/integracao/resumo-daae
POST /api/integracao/sincronizar
```

## Regras de Acesso

- Morador nao acessa dados de rede DAAE.
- Sindico nao acessa sensores, bombas, reservatorios nem dados de cidade.
- Sindico enxerga somente moradores e contas do proprio condominio.
- Operador DAAE acessa a visao completa da cidade e o JSON consolidado.

## JSON de Integracao

O arquivo principal fica em:

```txt
app/backend/data/smartwater_integracao.json
```

Ele simula a entrega dos dados externos e inclui:

- condominios
- reservatorios
- equipamentos
- sensores
- bombas
- medicoes de pressao
- medicoes de vazao
- contas
- usuarios de teste
- alertas

## Deploy em VPS

Exemplo usando Ubuntu.

### 1. Instalar pacotes

```bash
apt update && apt upgrade -y
apt install -y python3 python3-venv python3-pip nginx git unzip
```

### 2. Clonar o projeto

```bash
cd /var/www
git clone https://github.com/kauatiezzi/swartwater.git smart-water
cd /var/www/smart-water/app/backend
```

### 3. Criar ambiente Python

```bash
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn
```

### 4. Testar

```bash
python app.py
```

Pare com `CTRL + C`.

### 5. Criar servico systemd

```bash
nano /etc/systemd/system/smartwater.service
```

Conteudo:

```ini
[Unit]
Description=SmartWater Flask API
After=network.target

[Service]
User=root
WorkingDirectory=/var/www/smart-water/app/backend
Environment="PATH=/var/www/smart-water/app/backend/venv/bin"
ExecStart=/var/www/smart-water/app/backend/venv/bin/gunicorn -w 1 -b 127.0.0.1:5000 app:app
Restart=always

[Install]
WantedBy=multi-user.target
```

Ativar:

```bash
systemctl daemon-reload
systemctl enable smartwater
systemctl start smartwater
systemctl status smartwater
```

### 6. Configurar Nginx

```bash
nano /etc/nginx/sites-available/smartwater
```

Conteudo:

```nginx
server {
    listen 80;
    server_name SEU_DOMINIO_OU_IP;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Ativar:

```bash
ln -s /etc/nginx/sites-available/smartwater /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
```

### 7. HTTPS com Certbot

Depois de apontar o dominio para a VPS:

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d smartwater.seudominio.com
```

## Atualizar na VPS

```bash
cd /var/www/smart-water
git pull
cd app/backend
source venv/bin/activate
pip install -r requirements.txt
systemctl restart smartwater
```

## Android APK

No computador local:

```bash
cd app/frontend
npm install
npx cap sync android
npx cap open android
```

No Android Studio:

```txt
Build > Build Bundle(s) / APK(s) > Build APK(s)
```

Depois coloque o APK em:

```txt
app/frontend/www/downloads/smartwater.apk
```

Link esperado:

```txt
https://smartwater.seudominio.com/downloads/smartwater.apk
```

## iPhone sem App Store

No iPhone:

1. Abrir o site no Safari.
2. Tocar em compartilhar.
3. Selecionar `Adicionar a Tela de Inicio`.
4. Salvar como `SmartWater`.

Com HTTPS e dominio, a experiencia fica melhor.

## Status do Projeto

Entrega consolidada:

- frontend mobile
- backend Flask
- dados integrados via JSON
- perfis separados
- deploy em VPS
- suporte a APK Android
- uso como PWA no iPhone

