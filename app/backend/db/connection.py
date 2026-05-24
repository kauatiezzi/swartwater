import sqlite3
import os
import json
import datetime
from functools import wraps
from flask import request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash

try:
    import jwt
    _JWT_AVAILABLE = True
except ImportError:
    import hashlib, secrets
    _JWT_AVAILABLE = False

_DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'smartwater.db')
_INTEGRACAO_JSON = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'smartwater_integracao.json')
SECRET_KEY = 'smartwater-secret-2025'


def get_db():
    conn = sqlite3.connect(_DB, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    c = conn.cursor()
    c.executescript('''
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            cpf TEXT UNIQUE,
            email TEXT UNIQUE NOT NULL,
            tel TEXT,
            senha_hash TEXT NOT NULL,
            perfil TEXT DEFAULT 'morador',
            condominio TEXT DEFAULT '',
            bloco TEXT DEFAULT '',
            apto TEXT DEFAULT '',
            avatar_emoji TEXT DEFAULT '🏠',
            meta_mensal INTEGER DEFAULT 4500,
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS sensores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            localizacao TEXT NOT NULL,
            tipo TEXT DEFAULT 'vazao',
            criticidade INTEGER DEFAULT 2,
            bateria_pct INTEGER DEFAULT 100,
            protocolo TEXT DEFAULT 'Digital',
            status TEXT DEFAULT 'Ativo',
            ultima_calibracao TEXT,
            proxima_calibracao TEXT
        );

        CREATE TABLE IF NOT EXISTS leituras (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sensor_id INTEGER,
            valor_vazao REAL,
            data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(sensor_id) REFERENCES sensores(id)
        );

        CREATE TABLE IF NOT EXISTS notificacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            nivel TEXT NOT NULL,
            titulo TEXT NOT NULL,
            descricao TEXT DEFAULT '',
            icone TEXT DEFAULT '🔔',
            lido INTEGER DEFAULT 0,
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
        );

        CREATE TABLE IF NOT EXISTS preferencias_alerta (
            usuario_id INTEGER PRIMARY KEY,
            vazamento INTEGER DEFAULT 1,
            consumo_excessivo INTEGER DEFAULT 1,
            meta_mensal_alerta INTEGER DEFAULT 1,
            relatorio_semanal INTEGER DEFAULT 0,
            dicas INTEGER DEFAULT 1,
            horario_silencio INTEGER DEFAULT 0,
            silencio_inicio TEXT DEFAULT '22:00',
            silencio_fim TEXT DEFAULT '07:00',
            FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
        );

        CREATE TABLE IF NOT EXISTS zonas_rede (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            tipo TEXT DEFAULT 'distribuicao',
            pressao_min_mmh2o REAL DEFAULT 15000,
            pressao_max_mmh2o REAL DEFAULT 50000,
            capacidade_ls REAL DEFAULT 20
        );

        CREATE TABLE IF NOT EXISTS medicoes_pressao (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            zona_id INTEGER NOT NULL,
            pressao_mmh2o REAL NOT NULL,
            data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(zona_id) REFERENCES zonas_rede(id)
        );

        CREATE TABLE IF NOT EXISTS medicoes_vazao_rede (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            zona_id INTEGER NOT NULL,
            vazao_ls REAL NOT NULL,
            tipo TEXT DEFAULT 'saida',
            data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(zona_id) REFERENCES zonas_rede(id)
        );

        CREATE TABLE IF NOT EXISTS contas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            mes_ref TEXT NOT NULL,
            consumo_m3 REAL DEFAULT 0,
            consumo_l INTEGER DEFAULT 0,
            valor_rs REAL DEFAULT 0,
            status TEXT DEFAULT 'pendente',
            data_vencimento TEXT,
            data_pagamento TEXT,
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
        );
    ''')
    conn.commit()

    _ensure_columns(c, 'usuarios', {
        'cpf': 'TEXT',
        'tel': 'TEXT',
        'perfil': "TEXT DEFAULT 'morador'",
        'condominio': "TEXT DEFAULT ''",
        'bloco': "TEXT DEFAULT ''",
        'apto': "TEXT DEFAULT ''",
        'avatar_emoji': "TEXT DEFAULT '🏠'",
        'meta_mensal': 'INTEGER DEFAULT 4500',
        'criado_em': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
    })
    _ensure_columns(c, 'sensores', {
        'tipo': "TEXT DEFAULT 'vazao'",
        'criticidade': 'INTEGER DEFAULT 2',
        'bateria_pct': 'INTEGER DEFAULT 100',
        'protocolo': "TEXT DEFAULT 'Digital'",
        'status': "TEXT DEFAULT 'Ativo'",
        'ultima_calibracao': 'TEXT',
        'proxima_calibracao': 'TEXT',
    })
    _ensure_columns(c, 'contas', {
        'consumo_m3': 'REAL DEFAULT 0',
        'consumo_l': 'INTEGER DEFAULT 0',
        'valor_rs': 'REAL DEFAULT 0',
        'status': "TEXT DEFAULT 'pendente'",
        'data_vencimento': 'TEXT',
        'data_pagamento': 'TEXT',
        'criado_em': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
    })
    conn.commit()

    # Seed sensores
    c.execute("SELECT COUNT(*) FROM sensores")
    if c.fetchone()[0] == 0:
        c.executemany(
            "INSERT INTO sensores (nome, localizacao, tipo, criticidade, bateria_pct, protocolo, status, ultima_calibracao, proxima_calibracao) VALUES (?,?,?,?,?,?,?,?,?)",
            [
                ('Sensor Vazao Alpha',    'Entrada Principal',  'vazao',   3, 87, 'Wireless ISA100', 'Ativo', '2025-03-01', '2026-03-01'),
                ('Sensor Vazao Beta',     'Saida Tanque 2',     'vazao',   2, 45, 'HART 4-20mA',    'Inativo','2024-06-15', '2026-06-15'),
                ('Sensor Reservatorio',   'Cobertura',          'nivel',   3, 92, 'Wireless ISA100', 'Ativo', '2025-01-10', '2026-01-10'),
                ('Manometro Entrada',     'Captacao Anhumas',   'pressao', 3, 78, 'Wireless ISA100', 'Ativo', '2025-02-20', '2026-02-20'),
                ('Sensor Nivel Tanque',   'Poco das Cruzes',    'nivel',   2, 61, 'HART 4-20mA',    'Ativo', '2024-11-05', '2026-11-05'),
                ('Sensor Vazao Gamma',    'Vila Harmonia',      'vazao',   1, 95, 'Digital',         'Ativo', '2024-09-01', '2027-09-01'),
                ('Manometro Saida',       'Praca Fonte Luminosa','pressao',2, 33, 'HART 4-20mA',    'Atencao','2024-08-15', '2026-08-15'),
            ]
        )
        conn.commit()

    # Seed zonas_rede
    c.execute("SELECT COUNT(*) FROM zonas_rede")
    if c.fetchone()[0] == 0:
        c.executemany(
            "INSERT INTO zonas_rede (nome, tipo, pressao_min_mmh2o, pressao_max_mmh2o, capacidade_ls) VALUES (?,?,?,?,?)",
            [
                ('Captacao Anhumas',       'captacao',      15000, 50000, 35),
                ('Poco das Cruzes',        'captacao',      15000, 50000, 25),
                ('Reservatorio Principal', 'reservatorio',  15000, 50000, 40),
                ('Vila Harmonia',          'distribuicao',  15000, 50000, 15),
                ('Centro',                 'distribuicao',  15000, 50000, 20),
                ('Vila Sedenho',           'distribuicao',  15000, 50000, 12),
            ]
        )
        conn.commit()

        # Seed 48h de medicoes de pressao por zona
        import random as _rnd
        agora = datetime.datetime.utcnow()
        zonas_rows = c.execute("SELECT id, tipo FROM zonas_rede").fetchall()
        pressao_seed = []
        vazao_seed   = []
        for zona in zonas_rows:
            zid, ztipo = zona['id'], zona['tipo']
            base_p = 32000 if ztipo == 'captacao' else (28000 if ztipo == 'reservatorio' else 22000)
            base_e = 20 if ztipo == 'captacao' else (30 if ztipo == 'reservatorio' else 8)
            base_s = base_e * 0.88  # 12% loss total
            for h in range(48):
                ts = (agora - datetime.timedelta(hours=47-h)).strftime('%Y-%m-%d %H:%M:%S')
                ruido = _rnd.uniform(-2000, 2000)
                if 6 <= (agora - datetime.timedelta(hours=47-h)).hour <= 9:
                    ruido -= 4000  # pressao cai no pico
                pressao_seed.append((zid, round(base_p + ruido, 1), ts))
                vazao_seed.append((zid, round(base_e + _rnd.uniform(-2, 2), 2), 'entrada', ts))
                vazao_seed.append((zid, round(base_s + _rnd.uniform(-1.5, 1.5), 2), 'saida', ts))

        c.executemany(
            "INSERT INTO medicoes_pressao (zona_id, pressao_mmh2o, data_hora) VALUES (?,?,?)",
            pressao_seed
        )
        c.executemany(
            "INSERT INTO medicoes_vazao_rede (zona_id, vazao_ls, tipo, data_hora) VALUES (?,?,?,?)",
            vazao_seed
        )
        conn.commit()

    conn.close()
    try:
        seed_integracao_json()
    except Exception as e:
        print(f'Seed integracao warning: {e}')


def _load_integracao_json():
    with open(_INTEGRACAO_JSON, 'r', encoding='utf-8') as f:
        return json.load(f)


def _ensure_columns(cursor, table, columns):
    existing = {row['name'] for row in cursor.execute(f"PRAGMA table_info({table})").fetchall()}
    for name, ddl in columns.items():
        if name not in existing:
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}")


def _ensure_zona(c, nome, tipo='distribuicao', pressao_min=15000, pressao_max=50000, capacidade=20):
    row = c.execute("SELECT id FROM zonas_rede WHERE nome=?", (nome,)).fetchone()
    if row:
        return row['id']
    c.execute(
        "INSERT INTO zonas_rede (nome, tipo, pressao_min_mmh2o, pressao_max_mmh2o, capacidade_ls) VALUES (?,?,?,?,?)",
        (nome, tipo, pressao_min, pressao_max, capacidade)
    )
    return c.lastrowid


def seed_integracao_json():
    """Carrega a massa de integracao entregue em JSON para o SQLite local."""
    data = _load_integracao_json()
    senha_hash = generate_password_hash(data.get('credenciais_teste', {}).get('senha_padrao', 'Smart@123'))
    resumo = {'usuarios': 0, 'sensores': 0, 'zonas': 0, 'contas': 0, 'notificacoes': 0, 'leituras': 0}

    conn = get_db()
    try:
        c = conn.cursor()

        zonas_por_nome = {}
        for cond in data.get('condominios', []):
            zona_nome = cond.get('zona_rede') or cond.get('bairro') or cond.get('nome')
            tipo = 'reservatorio' if 'Reservatorio' in (cond.get('reservatorio') or '') else 'distribuicao'
            before = c.execute("SELECT id FROM zonas_rede WHERE nome=?", (zona_nome,)).fetchone()
            zonas_por_nome[zona_nome] = _ensure_zona(c, zona_nome, tipo=tipo)
            if not before:
                resumo['zonas'] += 1

        for leitura in data.get('leituras_rede', []):
            zona_nome = leitura.get('zona')
            zona_id = zonas_por_nome.get(zona_nome) or _ensure_zona(c, zona_nome)
            ts = (leitura.get('timestamp') or '').replace('T', ' ')[:19]
            exists_p = c.execute(
                "SELECT id FROM medicoes_pressao WHERE zona_id=? AND data_hora=?",
                (zona_id, ts)
            ).fetchone()
            if not exists_p:
                c.execute(
                    "INSERT INTO medicoes_pressao (zona_id, pressao_mmh2o, data_hora) VALUES (?,?,?)",
                    (zona_id, leitura.get('pressao_mmh2o') or 0, ts)
                )
                resumo['leituras'] += 1
            for tipo_json, tipo_db in (('vazao_entrada_ls', 'entrada'), ('vazao_saida_ls', 'saida')):
                exists_v = c.execute(
                    "SELECT id FROM medicoes_vazao_rede WHERE zona_id=? AND tipo=? AND data_hora=?",
                    (zona_id, tipo_db, ts)
                ).fetchone()
                if not exists_v:
                    c.execute(
                        "INSERT INTO medicoes_vazao_rede (zona_id, vazao_ls, tipo, data_hora) VALUES (?,?,?,?)",
                        (zona_id, leitura.get(tipo_json) or 0, tipo_db, ts)
                    )
                    resumo['leituras'] += 1

        for eq in data.get('equipamentos', []):
            nome = eq.get('nome')
            if not nome:
                continue
            exists = c.execute("SELECT id FROM sensores WHERE nome=?", (nome,)).fetchone()
            if exists:
                c.execute(
                    """UPDATE sensores SET localizacao=?, tipo=?, criticidade=?, bateria_pct=?,
                       protocolo=?, status=?, ultima_calibracao=COALESCE(?, ultima_calibracao),
                       proxima_calibracao=COALESCE(?, proxima_calibracao)
                       WHERE nome=?""",
                    (
                        eq.get('localizacao', ''),
                        eq.get('tipo', 'vazao'),
                        eq.get('criticidade', 2),
                        eq.get('bateria_pct', 100),
                        eq.get('protocolo', 'Digital'),
                        eq.get('status', 'Ativo'),
                        eq.get('ultima_manutencao'),
                        eq.get('proxima_manutencao'),
                        nome,
                    )
                )
            else:
                c.execute(
                    """INSERT INTO sensores
                       (nome, localizacao, tipo, criticidade, bateria_pct, protocolo, status,
                        ultima_calibracao, proxima_calibracao)
                       VALUES (?,?,?,?,?,?,?,?,?)""",
                    (
                        nome,
                        eq.get('localizacao', ''),
                        eq.get('tipo', 'vazao'),
                        eq.get('criticidade', 2),
                        eq.get('bateria_pct', 100),
                        eq.get('protocolo', 'Digital'),
                        eq.get('status', 'Ativo'),
                        eq.get('ultima_manutencao'),
                        eq.get('proxima_manutencao'),
                    )
                )
                resumo['sensores'] += 1

        for u in data.get('usuarios_teste', []):
            email = (u.get('email') or '').lower()
            if not email:
                continue
            row = c.execute("SELECT id FROM usuarios WHERE email=?", (email,)).fetchone()
            if row:
                user_id = row['id']
                c.execute(
                    """UPDATE usuarios SET nome=?, cpf=?, tel=?, perfil=?, condominio=?,
                       bloco=?, apto=?, meta_mensal=? WHERE id=?""",
                    (
                        u.get('nome'), u.get('cpf'), u.get('tel'), u.get('perfil', 'morador'),
                        u.get('condominio', ''), u.get('bloco', ''), u.get('apto', ''),
                        u.get('meta_mensal', 4500), user_id
                    )
                )
            else:
                c.execute(
                    """INSERT INTO usuarios
                       (nome, cpf, email, tel, senha_hash, perfil, condominio, bloco, apto, avatar_emoji, meta_mensal)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                    (
                        u.get('nome'), u.get('cpf'), email, u.get('tel'), senha_hash,
                        u.get('perfil', 'morador'), u.get('condominio', ''), u.get('bloco', ''),
                        u.get('apto', ''), '👤', u.get('meta_mensal', 4500)
                    )
                )
                user_id = c.lastrowid
                resumo['usuarios'] += 1
            c.execute("INSERT OR IGNORE INTO preferencias_alerta (usuario_id) VALUES (?)", (user_id,))

        email_to_id = {
            r['email']: r['id']
            for r in c.execute("SELECT id, email FROM usuarios").fetchall()
        }

        for conta in data.get('contas', []):
            user_id = email_to_id.get((conta.get('email_usuario') or '').lower())
            if not user_id:
                continue
            mes = conta.get('mes_ref')
            exists = c.execute(
                "SELECT id FROM contas WHERE usuario_id=? AND mes_ref=?",
                (user_id, mes)
            ).fetchone()
            consumo_l = int(conta.get('consumo_l') or 0)
            consumo_m3 = round(consumo_l / 1000, 3)
            if exists:
                c.execute(
                    """UPDATE contas SET consumo_m3=?, consumo_l=?, valor_rs=?, status=?,
                       data_vencimento=?, data_pagamento=? WHERE id=?""",
                    (
                        consumo_m3, consumo_l, conta.get('valor_rs') or 0, conta.get('status', 'pendente'),
                        conta.get('data_vencimento'), conta.get('data_pagamento'), exists['id']
                    )
                )
            else:
                c.execute(
                    """INSERT INTO contas
                       (usuario_id, mes_ref, consumo_m3, consumo_l, valor_rs, status, data_vencimento, data_pagamento)
                       VALUES (?,?,?,?,?,?,?,?)""",
                    (
                        user_id, mes, consumo_m3, consumo_l, conta.get('valor_rs') or 0,
                        conta.get('status', 'pendente'), conta.get('data_vencimento'), conta.get('data_pagamento')
                    )
                )
                resumo['contas'] += 1

        for alerta in data.get('alertas', []):
            alvos = []
            email = (alerta.get('email_usuario') or '').lower()
            if email and email_to_id.get(email):
                alvos.append(email_to_id[email])
            elif alerta.get('publico') == 'sindico':
                alvos.extend(
                    r['id'] for r in c.execute(
                        "SELECT id FROM usuarios WHERE perfil='sindico' AND condominio=?",
                        (alerta.get('condominio') or '',)
                    ).fetchall()
                )
            elif alerta.get('publico') == 'daae':
                alvos.extend(r['id'] for r in c.execute("SELECT id FROM usuarios WHERE perfil='operador'").fetchall())

            for user_id in alvos:
                exists = c.execute(
                    "SELECT id FROM notificacoes WHERE usuario_id=? AND titulo=?",
                    (user_id, alerta.get('titulo'))
                ).fetchone()
                if exists:
                    continue
                icone = '🚨' if alerta.get('nivel') == 'critico' else '⚠️'
                c.execute(
                    "INSERT INTO notificacoes (usuario_id, nivel, titulo, descricao, icone, lido) VALUES (?,?,?,?,?,0)",
                    (user_id, alerta.get('nivel', 'info'), alerta.get('titulo'), alerta.get('descricao'), icone)
                )
                resumo['notificacoes'] += 1

        conn.commit()
        return resumo
    finally:
        conn.close()


def seed_contas(user_id, nome_usuario):
    import random as _rnd
    conn = get_db()
    try:
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM contas WHERE usuario_id=?", (user_id,))
        if c.fetchone()[0] > 0:
            return
        hoje = datetime.date.today()
        _rnd.seed(user_id * 13)
        for m in range(4, 0, -1):
            ref_date = hoje.replace(day=1) - datetime.timedelta(days=30*m)
            mes_ref  = ref_date.strftime('%Y-%m')
            consumo_l = int(_rnd.gauss(3800, 600))
            consumo_m3 = round(consumo_l / 1000, 3)
            valor_rs  = round(consumo_m3 * 8.50 + 12.00, 2)
            venc = ref_date.replace(day=15).strftime('%Y-%m-%d')
            if m > 1:
                pago_day = _rnd.choice([10, 12, 14, 15, 16, 18])
                dt_pag = ref_date.replace(day=min(pago_day, 28)).strftime('%Y-%m-%d')
                status  = 'pago'
            else:
                dt_pag = None
                status  = _rnd.choice(['pendente', 'pendente', 'atrasado'])
            c.execute(
                "INSERT INTO contas (usuario_id, mes_ref, consumo_m3, consumo_l, valor_rs, status, data_vencimento, data_pagamento) VALUES (?,?,?,?,?,?,?,?)",
                (user_id, mes_ref, consumo_m3, consumo_l, valor_rs, status, venc, dt_pag)
            )
        conn.commit()
    finally:
        conn.close()


def generate_token(user_id, perfil):
    if _JWT_AVAILABLE:
        payload = {
            'user_id': user_id,
            'perfil': perfil,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(days=7)
        }
        return jwt.encode(payload, SECRET_KEY, algorithm='HS256')
    # Fallback: store token in a simple table
    token = secrets.token_hex(32)
    conn = get_db()
    try:
        conn.execute(
            "CREATE TABLE IF NOT EXISTS tokens (token TEXT PRIMARY KEY, user_id INTEGER, perfil TEXT, exp TIMESTAMP)"
        )
        exp = datetime.datetime.utcnow() + datetime.timedelta(days=7)
        conn.execute("INSERT INTO tokens VALUES (?,?,?,?)", (token, user_id, perfil, exp))
        conn.commit()
    finally:
        conn.close()
    return token


def verify_token(token):
    if not token:
        return None
    if _JWT_AVAILABLE:
        try:
            return jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        except Exception:
            return None
    # Fallback
    conn = get_db()
    try:
        conn.execute(
            "CREATE TABLE IF NOT EXISTS tokens (token TEXT PRIMARY KEY, user_id INTEGER, perfil TEXT, exp TIMESTAMP)"
        )
        row = conn.execute("SELECT user_id, perfil, exp FROM tokens WHERE token=?", (token,)).fetchone()
        if not row:
            return None
        if datetime.datetime.fromisoformat(row['exp']) < datetime.datetime.utcnow():
            return None
        return {'user_id': row['user_id'], 'perfil': row['perfil']}
    except Exception:
        return None
    finally:
        conn.close()


def jwt_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.headers.get('Authorization', '')
        token = auth[7:] if auth.startswith('Bearer ') else None
        payload = verify_token(token)
        if not payload:
            return jsonify({'erro': 'Token inválido ou expirado'}), 401
        request.user_id = payload['user_id']
        request.user_perfil = payload.get('perfil', 'morador')
        return f(*args, **kwargs)
    return decorated


def seed_notificacoes(user_id):
    conn = get_db()
    try:
        c = conn.cursor()
        legacy_titles = [
            '🚨 Possível vazamento detectado',
            '📊 Consumo acima da média',
            '🎯 Meta mensal em risco',
            '📊 Relatório semanal disponível',
            '✅ Meta da semana atingida!',
            '💡 Dica de economia',
        ]
        c.executemany(
            "DELETE FROM notificacoes WHERE usuario_id=? AND titulo=?",
            [(user_id, titulo) for titulo in legacy_titles]
        )
        conn.commit()
        c.execute("SELECT COUNT(*) FROM notificacoes WHERE usuario_id=?", (user_id,))
        if c.fetchone()[0] > 0:
            return
        user = c.execute("SELECT perfil FROM usuarios WHERE id=?", (user_id,)).fetchone()
        perfil = user['perfil'] if user else 'morador'
        if perfil == 'sindico':
            notifs = [
                (user_id, 'alerta', 'Conta de morador em atraso',
                 'Existe conta pendente no seu condominio. Acesse Gestao > Contas para acompanhar.',
                 '⚠️', 0),
                (user_id, 'info', 'Resumo do condominio atualizado',
                 'Os dados de consumo e contas do condominio foram sincronizados.',
                 '🏢', 1),
            ]
        elif perfil == 'operador':
            notifs = [
                (user_id, 'critico', 'Bomba submersa com pressao critica',
                 'Bomba Submersa Sedenho abaixo do minimo operacional. Verifique o painel DAAE.',
                 '🚨', 0),
                (user_id, 'alerta', 'Perda elevada na Vila Sedenho',
                 'Balanco hidrico indica perda acima do limite esperado na zona.',
                 '⚠️', 0),
            ]
        else:
            notifs = [
                (user_id, 'info', 'Conta do mes disponivel',
                 'Sua fatura ja pode ser consultada na aba Contas.',
                 '💰', 0),
                (user_id, 'ok', 'Consumo dentro do esperado',
                 'Seu apartamento esta dentro da faixa normal de consumo do condominio.',
                 '✅', 1),
            ]
        c.executemany(
            "INSERT INTO notificacoes (usuario_id,nivel,titulo,descricao,icone,lido) VALUES (?,?,?,?,?,?)",
            notifs
        )
        conn.commit()
    finally:
        conn.close()


# Backward-compat class kept for existing rotas/login.py
class Autenticar:
    def verificar_login(self, usuario_digitado, senha_digitada):
        conn = get_db()
        try:
            row = conn.execute(
                "SELECT id, senha_hash, perfil FROM usuarios WHERE email=? OR cpf=?",
                (usuario_digitado, usuario_digitado)
            ).fetchone()
            if row and check_password_hash(row['senha_hash'], senha_digitada):
                return True
            return False
        except Exception as e:
            print(f"Erro login: {e}")
            return False
        finally:
            conn.close()
