import os
from flask import Flask, send_from_directory
from rotas.login import login_bp
from rotas.auth import auth_bp
from rotas.sensores import sensores_bp
from rotas.leituras import leituras_bp
from rotas.consumo import consumo_bp
from rotas.notificacoes import notificacoes_bp
from rotas.usuario import usuario_bp
from rotas.pressao import pressao_bp
from rotas.rede import rede_bp
from rotas.contas import contas_bp
from rotas.cidade import cidade_bp
from rotas.integracao import integracao_bp
from db.connection import init_db, get_db, seed_contas, seed_notificacoes

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.normpath(os.path.join(BASE_DIR, '..', 'frontend', 'www'))

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path='')

# ── CORS ────────────────────────────────────────────────────────────────────
@app.after_request
def cors(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    return response

@app.before_request
def handle_options():
    from flask import request
    if request.method == 'OPTIONS':
        from flask import make_response
        r = make_response()
        r.headers['Access-Control-Allow-Origin'] = '*'
        r.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        r.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
        return r, 200

# ── API BLUEPRINTS (/api prefix) ─────────────────────────────────────────────
app.register_blueprint(login_bp,          url_prefix='/api')
app.register_blueprint(auth_bp,           url_prefix='/api/auth')
app.register_blueprint(sensores_bp,       url_prefix='/api/sensores')
app.register_blueprint(leituras_bp,       url_prefix='/api/leituras')
app.register_blueprint(consumo_bp,        url_prefix='/api/consumo')
app.register_blueprint(notificacoes_bp,   url_prefix='/api/notificacoes')
app.register_blueprint(usuario_bp,        url_prefix='/api/usuario')
app.register_blueprint(pressao_bp,        url_prefix='/api/pressao')
app.register_blueprint(rede_bp,           url_prefix='/api/rede')
app.register_blueprint(contas_bp,         url_prefix='/api/contas')
app.register_blueprint(cidade_bp,         url_prefix='/api/cidade')
app.register_blueprint(integracao_bp,     url_prefix='/api/integracao')

# ── FRONTEND PAGES ────────────────────────────────────────────────────────────
@app.route('/')
@app.route('/index.html')
def serve_splash():
    return send_from_directory(FRONTEND_DIR, 'index.html')

@app.route('/acesso')
@app.route('/acesso.html')
def serve_acesso():
    return send_from_directory(FRONTEND_DIR, 'acesso.html')

@app.route('/login.html')
def serve_login():
    return send_from_directory(FRONTEND_DIR, 'login.html')

@app.route('/cadastro.html')
def serve_cadastro():
    return send_from_directory(FRONTEND_DIR, 'cadastro.html')

@app.route('/app.html')
def serve_app():
    return send_from_directory(FRONTEND_DIR, 'app.html')

@app.route('/splash.html')
def serve_splash_cond():
    return send_from_directory(FRONTEND_DIR, 'splash.html')

@app.route('/daae.html')
def serve_daae():
    return send_from_directory(FRONTEND_DIR, 'daae.html')

@app.route('/apresentacao/')
@app.route('/apresentacao')
def serve_apresentacao():
    return send_from_directory(os.path.join(FRONTEND_DIR, 'apresentacao'), 'index.html')

# cidade.html mantido localmente para referência, mas não exposto na web

# Catch-all: serve static assets (css, js, fonts, images)
@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory(FRONTEND_DIR, filename)

# ── STARTUP ───────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    with app.app_context():
        init_db()
        # Seed contas para usuários existentes que ainda não têm
        try:
            conn = get_db()
            usuarios = conn.execute("SELECT id, nome FROM usuarios").fetchall()
            conn.close()
            for u in usuarios:
                seed_contas(u['id'], u['nome'])
                seed_notificacoes(u['id'])
        except Exception as e:
            print(f'Seed warning: {e}')
        print('\n=== SmartWater API ===')
        for rule in sorted(app.url_map.iter_rules(), key=lambda r: r.rule):
            print(f'  {rule.methods} {rule.rule}')
        print(f'\n  Frontend: {FRONTEND_DIR}')
        print('=====================\n')
    app.run(debug=True, port=5000)
