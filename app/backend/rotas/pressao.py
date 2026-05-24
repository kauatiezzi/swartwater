import datetime, random
from flask import Blueprint, jsonify, request
from db.connection import get_db, jwt_required

pressao_bp = Blueprint('pressao', __name__)

STATUS_PRESSAO = {
    'critico': lambda p: p < 15000,
    'atencao': lambda p: 15000 <= p < 20000,
    'normal':  lambda p: p >= 20000,
}

def _status(p):
    if p < 15000: return 'critico'
    if p < 20000: return 'atencao'
    return 'normal'


@pressao_bp.route('/dashboard', methods=['GET'])
@jwt_required
def dashboard():
    conn = get_db()
    try:
        zonas = conn.execute("SELECT * FROM zonas_rede").fetchall()
        result = []
        for z in zonas:
            row = conn.execute(
                "SELECT pressao_mmh2o, data_hora FROM medicoes_pressao "
                "WHERE zona_id=? ORDER BY data_hora DESC LIMIT 1", (z['id'],)
            ).fetchone()
            pressao_atual = row['pressao_mmh2o'] if row else 25000
            result.append({
                'id': z['id'],
                'nome': z['nome'],
                'tipo': z['tipo'],
                'pressao_atual': pressao_atual,
                'pressao_min': z['pressao_min_mmh2o'],
                'pressao_max': z['pressao_max_mmh2o'],
                'status': _status(pressao_atual),
                'timestamp': row['data_hora'] if row else None,
            })
        return jsonify(result), 200
    finally:
        conn.close()


@pressao_bp.route('/historico/<int:zona_id>', methods=['GET'])
@jwt_required
def historico(zona_id):
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT pressao_mmh2o, data_hora FROM medicoes_pressao "
            "WHERE zona_id=? ORDER BY data_hora DESC LIMIT 24",
            (zona_id,)
        ).fetchall()
        data = [{'pressao': r['pressao_mmh2o'], 'hora': r['data_hora'][-8:-3]} for r in reversed(rows)]
        return jsonify(data), 200
    finally:
        conn.close()


@pressao_bp.route('/alertas', methods=['GET'])
@jwt_required
def alertas():
    conn = get_db()
    try:
        zonas = conn.execute("SELECT * FROM zonas_rede").fetchall()
        criticos = []
        for z in zonas:
            row = conn.execute(
                "SELECT pressao_mmh2o FROM medicoes_pressao WHERE zona_id=? ORDER BY data_hora DESC LIMIT 1",
                (z['id'],)
            ).fetchone()
            if row and row['pressao_mmh2o'] < z['pressao_min_mmh2o']:
                criticos.append({'zona': z['nome'], 'pressao': row['pressao_mmh2o'], 'minimo': z['pressao_min_mmh2o']})
        return jsonify(criticos), 200
    finally:
        conn.close()
