import random
import datetime
from flask import Blueprint, request, jsonify
from db.connection import get_db, jwt_required

consumo_bp = Blueprint('consumo', __name__)


def _distribuir_total(total, pesos):
    soma = sum(pesos) or 1
    valores = [max(0, int(round(total * p / soma))) for p in pesos]
    diff = int(total) - sum(valores)
    if valores:
        valores[-1] += diff
    return valores


def _contas_recentes(conn, user_id):
    return conn.execute(
        "SELECT * FROM contas WHERE usuario_id=? ORDER BY mes_ref DESC LIMIT 2",
        (user_id,)
    ).fetchall()


def _gerar_consumo_diario(user_id, total_l=None):
    hoje = datetime.date.today()
    rng = random.Random(user_id * 31 + hoje.month * 7 + hoje.year)
    dados = []
    pesos = []
    for i in range(30):
        d = hoje - datetime.timedelta(days=29 - i)
        label = f"{d.day}/{d.month}"
        base = 120 if d.weekday() < 5 else 160
        valor = rng.randint(base - 40, base + 80)
        pesos.append(valor)
        dados.append({'label': label, 'value': valor})

    if total_l is not None:
        valores = _distribuir_total(int(total_l), pesos)
        for item, valor in zip(dados, valores):
            item['value'] = valor
    return dados


def _gerar_consumo_mensal(user_id, conn=None):
    meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
             'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    if conn is not None:
        rows = conn.execute(
            "SELECT mes_ref, consumo_l FROM contas WHERE usuario_id=? ORDER BY mes_ref",
            (user_id,)
        ).fetchall()
        if rows:
            por_mes = {}
            for row in rows:
                if row['mes_ref'] and '-' in row['mes_ref']:
                    por_mes[int(row['mes_ref'].split('-')[1])] = int(row['consumo_l'] or 0)
            return [{'label': meses[i], 'value': por_mes.get(i + 1, 0)} for i in range(12)]

    rng = random.Random(user_id * 17 + datetime.date.today().year)
    return [{'label': m, 'value': rng.randint(2400, 5200)} for m in meses]


@consumo_bp.route('/dashboard', methods=['GET'])
@jwt_required
def dashboard():
    user_id = request.user_id
    conn = get_db()
    try:
        user = conn.execute(
            "SELECT meta_mensal, condominio FROM usuarios WHERE id=?", (user_id,)
        ).fetchone()
        meta = user['meta_mensal'] if user else 4500
        condominio = user['condominio'] if user else ''

        contas = _contas_recentes(conn, user_id)
        conta_atual = contas[0] if contas else None

        if conta_atual:
            consumo_mes = int(conta_atual['consumo_l'] or 0)
            fatura = round(float(conta_atual['valor_rs'] or 0), 2)
            mes_ref = conta_atual['mes_ref']
        else:
            consumo_mes = None
            fatura = None
            mes_ref = None

        hist = _gerar_consumo_diario(user_id, consumo_mes)
        if consumo_mes is None:
            consumo_mes = sum(d['value'] for d in hist[-30:])
            fatura = round(consumo_mes * 0.01603 + 12, 2)

        consumo_hoje = hist[-1]['value']
        media = round(consumo_mes / 30)

        conta_anterior = contas[1] if len(contas) > 1 else None
        if conta_anterior and conta_anterior['consumo_l']:
            anterior_l = float(conta_anterior['consumo_l'])
            variacao = round((consumo_mes - anterior_l) / anterior_l * 100, 1)
        else:
            variacao = 0.0

        comp = 0.0
        if condominio and mes_ref:
            media_cond = conn.execute(
                """SELECT AVG(c.consumo_l)
                   FROM contas c JOIN usuarios u ON u.id=c.usuario_id
                   WHERE c.mes_ref=? AND u.condominio=? AND u.perfil='morador'""",
                (mes_ref, condominio)
            ).fetchone()[0]
            if media_cond:
                comp = round((consumo_mes - float(media_cond)) / float(media_cond) * 100, 1)

        return jsonify({
            'consumo_mes_atual': consumo_mes,
            'consumo_hoje': consumo_hoje,
            'media_diaria': media,
            'estimativa_fatura': fatura,
            'mes_ref': mes_ref,
            'meta_mensal': meta,
            'variacao_mes_anterior': variacao,
            'comparativo_condominio': comp,
            'vazamento_risco': False,
        }), 200
    finally:
        conn.close()


@consumo_bp.route('/historico', methods=['GET'])
@jwt_required
def historico():
    user_id = request.user_id
    periodo = request.args.get('periodo', 'diario')
    conn = get_db()
    try:
        if periodo == 'mensal':
            dados = _gerar_consumo_mensal(user_id, conn)
        else:
            contas = _contas_recentes(conn, user_id)
            total = int(contas[0]['consumo_l']) if contas else None
            dados = _gerar_consumo_diario(user_id, total)
        return jsonify(dados), 200
    finally:
        conn.close()


@consumo_bp.route('/por-hora', methods=['GET'])
@jwt_required
def por_hora():
    user_id = request.user_id
    rng = random.Random(user_id * 7 + datetime.date.today().toordinal())
    hora_atual = datetime.datetime.now().hour
    pico_manha = range(6, 10)
    pico_noite = range(18, 23)
    dados = []
    for h in range(24):
        if h > hora_atual:
            dados.append({'hora': f'{h:02d}h', 'consumo_l': None, 'tem_dado': False})
            continue
        if h in pico_manha:
            base = rng.randint(18, 35)
        elif h in pico_noite:
            base = rng.randint(15, 28)
        elif 0 <= h < 5:
            base = rng.randint(0, 5)
        else:
            base = rng.randint(4, 14)
        vazamento = h == 3 and rng.random() < 0.2
        if vazamento:
            base += rng.randint(8, 18)
        dados.append({
            'hora': f'{h:02d}h',
            'consumo_l': base,
            'tem_dado': True,
            'status': 'vazamento' if vazamento else ('pico' if (h in pico_manha or h in pico_noite) else 'normal'),
        })
    return jsonify(dados), 200


@consumo_bp.route('/por-dia', methods=['GET'])
@jwt_required
def por_dia():
    user_id = request.user_id
    conn = get_db()
    try:
        contas = _contas_recentes(conn, user_id)
        total = int(contas[0]['consumo_l']) if contas else None
    finally:
        conn.close()

    dados = _gerar_consumo_diario(user_id, total)[-14:]
    semana = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom']
    hoje = datetime.date.today()
    result = []
    for i, d in enumerate(dados):
        dt = hoje - datetime.timedelta(days=len(dados) - 1 - i)
        result.append({
            **d,
            'dia_semana': semana[dt.weekday()],
            'data': dt.strftime('%d/%m'),
            'status': 'alto' if d['value'] > 180 else ('baixo' if d['value'] < 80 else 'normal'),
        })
    return jsonify(result), 200
