import datetime, random
from flask import Blueprint, jsonify, request
from db.connection import get_db, jwt_required
from functools import wraps

cidade_bp = Blueprint('cidade', __name__)


def operador_daae(f):
    """Permite acesso apenas a operadores DAAE."""
    @wraps(f)
    @jwt_required
    def wrapper(*args, **kwargs):
        perfil = getattr(request, 'user_perfil', '')
        if perfil != 'operador':
            return jsonify({'erro': 'Acesso restrito a operadores DAAE'}), 403
        return f(*args, **kwargs)
    return wrapper

# Mapeamento fixo: qual grupo é responsável por cada tipo de dado
GRUPOS = {
    1: {'nome': 'Grupo 1', 'tema': 'Sensores de Vazão',    'icone': '💧', 'cor': '#00B4D8'},
    2: {'nome': 'Grupo 2', 'tema': 'Sensores de Pressão',  'icone': '📊', 'cor': '#0077B6'},
    3: {'nome': 'Grupo 3', 'tema': 'Hardware / MCU',        'icone': '⚙️', 'cor': '#06D6A0'},
    4: {'nome': 'Grupo 4', 'tema': 'Comunicação Wi-Fi/LoRa','icone': '📡', 'cor': '#FFB703'},
}

ZONA_GRUPO = {
    'captacao':      1,   # Grupo 1: vazão na entrada
    'reservatorio':  2,   # Grupo 2: pressão nos reservatórios
    'distribuicao':  1,   # Grupo 1: vazão na distribuição
}


def _status_pressao(p):
    if p < 15000: return 'critico'
    if p < 20000: return 'atencao'
    return 'normal'

def _pct_perda(e, s):
    if not e: return 0.0
    return round((e - s) / e * 100, 1)

def _status_balanco(pct):
    if pct <= 5: return 'normal'
    if pct <= 10: return 'atencao'
    return 'vazamento'


def _media_vazao_recente(conn, zona_id, tipo):
    row = conn.execute(
        """SELECT AVG(vazao_ls) AS media
           FROM (
             SELECT vazao_ls
             FROM medicoes_vazao_rede
             WHERE zona_id=? AND tipo=?
             ORDER BY data_hora DESC
             LIMIT 12
           )""",
        (zona_id, tipo)
    ).fetchone()
    return row['media'] or 0


@cidade_bp.route('/dashboard', methods=['GET'])
@operador_daae
def dashboard():
    """Visão geral da cidade — requer login de operador DAAE."""
    conn = get_db()
    try:
        zonas = conn.execute("SELECT * FROM zonas_rede").fetchall()
        resultado = []
        alertas_ativos = 0

        for z in zonas:
            p_row = conn.execute(
                "SELECT pressao_mmh2o, data_hora FROM medicoes_pressao "
                "WHERE zona_id=? ORDER BY data_hora DESC LIMIT 1", (z['id'],)
            ).fetchone()
            pressao = p_row['pressao_mmh2o'] if p_row else 25000
            status_p = _status_pressao(pressao)

            entrada = _media_vazao_recente(conn, z['id'], 'entrada')
            saida   = _media_vazao_recente(conn, z['id'], 'saida')
            pct_p   = _pct_perda(entrada, saida)
            status_b = _status_balanco(pct_p)

            grupo_id  = ZONA_GRUPO.get(z['tipo'], 1)
            grupo_info = GRUPOS.get(grupo_id, GRUPOS[1])

            status_geral = 'critico' if (status_p == 'critico' or status_b == 'vazamento') else \
                           ('atencao' if (status_p == 'atencao' or status_b == 'atencao') else 'normal')
            if status_geral in ('critico', 'atencao'):
                alertas_ativos += 1

            resultado.append({
                'id': z['id'],
                'nome': z['nome'],
                'tipo': z['tipo'],
                'grupo': grupo_info,
                'pressao_mmh2o': round(pressao, 0),
                'status_pressao': status_p,
                'vazao_entrada_ls': round(entrada, 2),
                'vazao_saida_ls':   round(saida, 2),
                'perda_pct': pct_p,
                'status_balanco': status_b,
                'status_geral': status_geral,
                'ultima_leitura': p_row['data_hora'] if p_row else None,
            })

        # Totais da cidade
        total_e = sum(z['vazao_entrada_ls'] for z in resultado)
        total_s = sum(z['vazao_saida_ls']   for z in resultado)
        criticos = [z for z in resultado if z['status_geral'] == 'critico']
        atencao  = [z for z in resultado if z['status_geral'] == 'atencao']

        return jsonify({
            'zonas': resultado,
            'resumo': {
                'total_zonas': len(resultado),
                'alertas_ativos': alertas_ativos,
                'zonas_criticas': len(criticos),
                'zonas_atencao': len(atencao),
                'vazao_total_entrada_ls': round(total_e, 2),
                'vazao_total_saida_ls': round(total_s, 2),
                'perda_total_pct': _pct_perda(total_e, total_s),
            },
            'grupos': list(GRUPOS.values()),
            'timestamp': datetime.datetime.utcnow().isoformat(),
        }), 200
    finally:
        conn.close()


@cidade_bp.route('/alertas', methods=['GET'])
def alertas():
    """Alertas ativos na cidade — público."""
    conn = get_db()
    try:
        zonas = conn.execute("SELECT * FROM zonas_rede").fetchall()
        alertas = []
        for z in zonas:
            p = conn.execute(
                "SELECT pressao_mmh2o FROM medicoes_pressao WHERE zona_id=? ORDER BY data_hora DESC LIMIT 1",
                (z['id'],)
            ).fetchone()
            if p and p['pressao_mmh2o'] < 15000:
                alertas.append({
                    'tipo': 'pressao_critica',
                    'zona': z['nome'],
                    'zona_id': z['id'],
                    'valor': p['pressao_mmh2o'],
                    'minimo': 15000,
                    'grupo': GRUPOS[ZONA_GRUPO.get(z['tipo'], 1)]['nome'],
                    'nivel': 'critico',
                    'mensagem': f"Pressão crítica em {z['nome']}: {p['pressao_mmh2o']:.0f} mmH2O (mín: 15.000)",
                })
            elif p and p['pressao_mmh2o'] < 20000:
                alertas.append({
                    'tipo': 'pressao_baixa',
                    'zona': z['nome'],
                    'zona_id': z['id'],
                    'valor': p['pressao_mmh2o'],
                    'grupo': GRUPOS[ZONA_GRUPO.get(z['tipo'], 1)]['nome'],
                    'nivel': 'atencao',
                    'mensagem': f"Pressão baixa em {z['nome']}: {p['pressao_mmh2o']:.0f} mmH2O",
                })

            # Balanço hídrico
            e = _media_vazao_recente(conn, z['id'], 'entrada')
            s = _media_vazao_recente(conn, z['id'], 'saida')
            pct = _pct_perda(e, s)
            if pct > 10:
                alertas.append({
                    'tipo': 'vazamento',
                    'zona': z['nome'],
                    'zona_id': z['id'],
                    'valor': pct,
                    'grupo': GRUPOS[ZONA_GRUPO.get(z['tipo'], 2)]['nome'],
                    'nivel': 'critico' if pct > 15 else 'atencao',
                    'mensagem': f"Possível vazamento em {z['nome']}: {pct}% de perda",
                })

        return jsonify({'alertas': alertas, 'total': len(alertas)}), 200
    finally:
        conn.close()


@cidade_bp.route('/historico/<int:zona_id>', methods=['GET'])
@operador_daae
def historico_zona(zona_id):
    """Histórico de 24h de pressão e vazão de uma zona."""
    conn = get_db()
    try:
        pressoes = conn.execute(
            "SELECT pressao_mmh2o, data_hora FROM medicoes_pressao "
            "WHERE zona_id=? ORDER BY data_hora DESC LIMIT 24", (zona_id,)
        ).fetchall()
        vazoes_e = conn.execute(
            "SELECT vazao_ls, data_hora FROM medicoes_vazao_rede "
            "WHERE zona_id=? AND tipo='entrada' ORDER BY data_hora DESC LIMIT 24", (zona_id,)
        ).fetchall()

        return jsonify({
            'pressao_24h': [{'valor': r['pressao_mmh2o'], 'hora': r['data_hora'][-8:-3]} for r in reversed(pressoes)],
            'vazao_24h':   [{'valor': r['vazao_ls'],       'hora': r['data_hora'][-8:-3]} for r in reversed(vazoes_e)],
        }), 200
    finally:
        conn.close()


@cidade_bp.route('/leitura', methods=['POST'])
@jwt_required
def receber_leitura():
    """
    Endpoint para Grupos 1, 2 e 3 enviarem leituras dos sensores.
    Payload: { zona_id, tipo: 'pressao'|'vazao_entrada'|'vazao_saida'|'qualidade', valor, grupo }
    """
    d = request.get_json(silent=True) or {}
    zona_id = d.get('zona_id')
    tipo    = d.get('tipo')
    valor   = d.get('valor')
    grupo   = d.get('grupo', 0)

    if not zona_id or not tipo or valor is None:
        return jsonify({'erro': 'zona_id, tipo e valor sao obrigatorios'}), 400

    conn = get_db()
    try:
        if tipo == 'pressao':
            conn.execute(
                "INSERT INTO medicoes_pressao (zona_id, pressao_mmh2o) VALUES (?,?)",
                (zona_id, float(valor))
            )
        elif tipo in ('vazao_entrada', 'vazao_saida'):
            tipo_vazao = 'entrada' if tipo == 'vazao_entrada' else 'saida'
            conn.execute(
                "INSERT INTO medicoes_vazao_rede (zona_id, vazao_ls, tipo) VALUES (?,?,?)",
                (zona_id, float(valor), tipo_vazao)
            )
        else:
            return jsonify({'erro': f'Tipo desconhecido: {tipo}'}), 400

        conn.commit()
        return jsonify({'mensagem': f'Leitura de {tipo} registrada para zona {zona_id}'}), 201
    finally:
        conn.close()


@cidade_bp.route('/sensores', methods=['GET'])
@operador_daae
def sensores_cidade():
    """Lista sensores da cidade com grupo responsável."""
    conn = get_db()
    try:
        rows = conn.execute("SELECT * FROM sensores ORDER BY criticidade DESC").fetchall()
        resultado = []
        for r in rows:
            s = dict(r)
            # Determina grupo pelo tipo do sensor
            g = 1 if s.get('tipo') in ('pressao', 'nivel') else (2 if s.get('tipo') == 'vazao' else 3)
            s['grupo'] = GRUPOS[g]
            resultado.append(s)
        return jsonify(resultado), 200
    finally:
        conn.close()
