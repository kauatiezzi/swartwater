import datetime
from flask import Blueprint, jsonify, request
from db.connection import get_db, jwt_required

rede_bp = Blueprint('rede', __name__)


def _pct_perda(entrada, saida):
    if not entrada or entrada == 0:
        return 0.0
    return round((entrada - saida) / entrada * 100, 1)

def _status_balanco(pct):
    if pct <= 5:   return 'normal'
    if pct <= 10:  return 'atencao'
    return 'vazamento'


@rede_bp.route('/zonas', methods=['GET'])
@jwt_required
def zonas():
    conn = get_db()
    try:
        zonas = conn.execute("SELECT * FROM zonas_rede").fetchall()
        result = []
        for z in zonas:
            p_row = conn.execute(
                "SELECT pressao_mmh2o FROM medicoes_pressao WHERE zona_id=? ORDER BY data_hora DESC LIMIT 1",
                (z['id'],)
            ).fetchone()
            pressao = p_row['pressao_mmh2o'] if p_row else 25000

            e_row = conn.execute(
                "SELECT AVG(vazao_ls) as avg FROM medicoes_vazao_rede "
                "WHERE zona_id=? AND tipo='entrada' AND data_hora > datetime('now','-1 hour')",
                (z['id'],)
            ).fetchone()
            s_row = conn.execute(
                "SELECT AVG(vazao_ls) as avg FROM medicoes_vazao_rede "
                "WHERE zona_id=? AND tipo='saida' AND data_hora > datetime('now','-1 hour')",
                (z['id'],)
            ).fetchone()

            entrada = e_row['avg'] or 0
            saida   = s_row['avg'] or 0
            pct     = _pct_perda(entrada, saida)

            result.append({
                'id': z['id'], 'nome': z['nome'], 'tipo': z['tipo'],
                'pressao_mmh2o': round(pressao, 0),
                'status_pressao': 'critico' if pressao < 15000 else ('atencao' if pressao < 20000 else 'normal'),
                'vazao_entrada_ls': round(entrada, 2),
                'vazao_saida_ls':   round(saida, 2),
                'perda_pct': pct,
                'status_balanco': _status_balanco(pct),
            })
        return jsonify(result), 200
    finally:
        conn.close()


@rede_bp.route('/balanco', methods=['GET'])
@jwt_required
def balanco():
    conn = get_db()
    try:
        zonas = conn.execute("SELECT * FROM zonas_rede").fetchall()
        total_entrada = total_saida = 0
        detalhes = []
        for z in zonas:
            e = conn.execute(
                "SELECT COALESCE(SUM(vazao_ls),0) as tot FROM medicoes_vazao_rede "
                "WHERE zona_id=? AND tipo='entrada' AND data_hora > datetime('now','-24 hours')",
                (z['id'],)
            ).fetchone()['tot']
            s = conn.execute(
                "SELECT COALESCE(SUM(vazao_ls),0) as tot FROM medicoes_vazao_rede "
                "WHERE zona_id=? AND tipo='saida' AND data_hora > datetime('now','-24 hours')",
                (z['id'],)
            ).fetchone()['tot']
            total_entrada += e
            total_saida   += s
            pct = _pct_perda(e, s)
            detalhes.append({
                'zona': z['nome'], 'tipo': z['tipo'],
                'entrada_ls': round(e, 2), 'saida_ls': round(s, 2),
                'perda_pct': pct, 'status': _status_balanco(pct),
            })

        perda_total = _pct_perda(total_entrada, total_saida)
        perda_vol_l = round((total_entrada - total_saida) * 1000, 0)

        return jsonify({
            'total_entrada_ls': round(total_entrada, 2),
            'total_saida_ls':   round(total_saida, 2),
            'perda_total_pct':  perda_total,
            'perda_vol_litros': perda_vol_l,
            'status_geral':     _status_balanco(perda_total),
            'detalhes':         detalhes,
        }), 200
    finally:
        conn.close()


@rede_bp.route('/perdas/resumo', methods=['GET'])
@jwt_required
def perdas_resumo():
    conn = get_db()
    try:
        # Perda fisica: balanco de vazao
        e = conn.execute(
            "SELECT COALESCE(SUM(vazao_ls),0) as tot FROM medicoes_vazao_rede "
            "WHERE tipo='entrada' AND data_hora > datetime('now','-30 days')"
        ).fetchone()['tot']
        s = conn.execute(
            "SELECT COALESCE(SUM(vazao_ls),0) as tot FROM medicoes_vazao_rede "
            "WHERE tipo='saida' AND data_hora > datetime('now','-30 days')"
        ).fetchone()['tot']
        perda_fisica_pct = _pct_perda(e, s)
        perda_fisica_l   = round((e - s) * 1000, 0)

        # Perda comercial: consumo faturado vs medido
        faturado = conn.execute(
            "SELECT COALESCE(SUM(consumo_l),0) as tot FROM contas WHERE mes_ref >= date('now','-3 months','start of month')"
        ).fetchone()['tot']
        medido_aprox = faturado * 1.08  # estimativa: 8% perdas comerciais
        perda_com_pct = round((medido_aprox - faturado) / medido_aprox * 100, 1) if medido_aprox else 0

        # Historico mensal (ultimos 6 meses)
        historico = []
        for m in range(5, -1, -1):
            ref = (datetime.date.today().replace(day=1) - datetime.timedelta(days=30*m))
            mes_str = ref.strftime('%Y-%m')
            label   = ref.strftime('%b/%y')
            rows = conn.execute(
                "SELECT COALESCE(SUM(consumo_l),0) as tot FROM contas WHERE mes_ref=?", (mes_str,)
            ).fetchone()
            historico.append({'mes': label, 'consumo_l': int(rows['tot'])})

        return jsonify({
            'perda_fisica_pct':    round(perda_fisica_pct, 1),
            'perda_fisica_litros': int(perda_fisica_l),
            'perda_comercial_pct': perda_com_pct,
            'perda_total_pct':     round(perda_fisica_pct + perda_com_pct, 1),
            'historico_mensal':    historico,
        }), 200
    finally:
        conn.close()
