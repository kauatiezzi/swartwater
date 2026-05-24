import random
import datetime
from flask import Blueprint, request, jsonify
from db.connection import get_db, jwt_required

consumo_bp = Blueprint('consumo', __name__)


def _gerar_consumo_diario(user_id):
    hoje = datetime.date.today()
    rng = random.Random(user_id * 31 + hoje.month * 7 + hoje.year)
    dados = []
    for i in range(30):
        d = hoje - datetime.timedelta(days=29 - i)
        label = f"{d.day}/{d.month}"
        base = 120 if d.weekday() < 5 else 160
        valor = rng.randint(base - 40, base + 80)
        dados.append({'label': label, 'value': valor})
    return dados


def _gerar_consumo_mensal(user_id):
    meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
             'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    rng = random.Random(user_id * 17 + datetime.date.today().year)
    return [{'label': m, 'value': rng.randint(2400, 5200)} for m in meses]


@consumo_bp.route('/dashboard', methods=['GET'])
@jwt_required
def dashboard():
    user_id = request.user_id
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT meta_mensal FROM usuarios WHERE id=?", (user_id,)
        ).fetchone()
        meta = row['meta_mensal'] if row else 4500

        hist = _gerar_consumo_diario(user_id)
        consumo_mes = sum(d['value'] for d in hist[-30:])
        consumo_hoje = hist[-1]['value']
        media = round(consumo_mes / 30)
        fatura = round(consumo_mes * 0.022 + 12, 2)

        rng = random.Random(user_id + datetime.date.today().day)
        variacao = round(rng.uniform(-15.0, 20.0), 1)
        comp = round(rng.uniform(-12.0, 8.0), 1)

        return jsonify({
            'consumo_mes_atual': consumo_mes,
            'consumo_hoje': consumo_hoje,
            'media_diaria': media,
            'estimativa_fatura': fatura,
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
    if periodo == 'mensal':
        dados = _gerar_consumo_mensal(user_id)
    else:
        dados = _gerar_consumo_diario(user_id)
    return jsonify(dados), 200


@consumo_bp.route('/por-hora', methods=['GET'])
@jwt_required
def por_hora():
    user_id = request.user_id
    rng = random.Random(user_id * 7 + datetime.date.today().toordinal())
    hora_atual = datetime.datetime.now().hour
    pico_manha = range(6, 10)
    pico_noite  = range(18, 23)
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
    dados = _gerar_consumo_diario(user_id)[-14:]
    semana = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom']
    hoje = datetime.date.today()
    result = []
    for i, d in enumerate(dados):
        dt = hoje - datetime.timedelta(days=len(dados)-1-i)
        result.append({
            **d,
            'dia_semana': semana[dt.weekday()],
            'data': dt.strftime('%d/%m'),
            'status': 'alto' if d['value'] > 180 else ('baixo' if d['value'] < 80 else 'normal'),
        })
    return jsonify(result), 200
