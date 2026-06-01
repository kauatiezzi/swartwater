import datetime
from flask import Blueprint, jsonify, request
from db.connection import get_db, jwt_required, seed_contas, seed_notificacoes

contas_bp = Blueprint('contas', __name__)


def _requer_sindico(f):
    from functools import wraps
    @wraps(f)
    def wrapper(*args, **kwargs):
        if getattr(request, 'user_perfil', '') != 'sindico':
            return jsonify({'erro': 'Acesso restrito ao sindico'}), 403
        return f(*args, **kwargs)
    return wrapper


def _condominio_sindico(conn):
    row = conn.execute(
        "SELECT condominio FROM usuarios WHERE id=?",
        (request.user_id,)
    ).fetchone()
    return row['condominio'] if row else ''


def _mes_referencia_condominio(conn, condominio, mes=None):
    if mes:
        return mes
    row = conn.execute(
        """SELECT MAX(c.mes_ref) AS mes
           FROM contas c JOIN usuarios u ON u.id=c.usuario_id
           WHERE u.perfil='morador' AND u.condominio=?""",
        (condominio,)
    ).fetchone()
    return row['mes'] if row and row['mes'] else datetime.date.today().strftime('%Y-%m')


@contas_bp.route('/minhas', methods=['GET'])
@jwt_required
def minhas_contas():
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT * FROM contas WHERE usuario_id=? ORDER BY mes_ref DESC LIMIT 12",
            (request.user_id,)
        ).fetchall()
        if not rows:
            seed_contas(request.user_id, '')
            rows = conn.execute(
                "SELECT * FROM contas WHERE usuario_id=? ORDER BY mes_ref DESC LIMIT 12",
                (request.user_id,)
            ).fetchall()
        return jsonify([dict(r) for r in rows]), 200
    finally:
        conn.close()


@contas_bp.route('/resumo-sindico', methods=['GET'])
@jwt_required
@_requer_sindico
def resumo_sindico():
    conn = get_db()
    try:
        condominio = _condominio_sindico(conn)
        mes_ref = _mes_referencia_condominio(conn, condominio, request.args.get('mes'))
        total_usuarios = conn.execute(
            "SELECT COUNT(*) FROM usuarios WHERE perfil='morador' AND condominio=?",
            (condominio,)
        ).fetchone()[0]

        pendentes = conn.execute(
            """SELECT COUNT(*) FROM contas c JOIN usuarios u ON u.id=c.usuario_id
               WHERE c.mes_ref=? AND c.status='pendente'
                 AND u.perfil='morador' AND u.condominio=?""",
            (mes_ref, condominio)
        ).fetchone()[0]
        atrasados = conn.execute(
            """SELECT COUNT(*) FROM contas c JOIN usuarios u ON u.id=c.usuario_id
               WHERE c.mes_ref=? AND c.status='atrasado'
                 AND u.perfil='morador' AND u.condominio=?""",
            (mes_ref, condominio)
        ).fetchone()[0]
        valor_pendente = conn.execute(
            """SELECT COALESCE(SUM(c.valor_rs),0) FROM contas c JOIN usuarios u ON u.id=c.usuario_id
               WHERE c.mes_ref=? AND c.status IN ('pendente','atrasado')
                 AND u.perfil='morador' AND u.condominio=?""",
            (mes_ref, condominio)
        ).fetchone()[0]
        consumo_total = conn.execute(
            """SELECT COALESCE(SUM(c.consumo_l),0) FROM contas c JOIN usuarios u ON u.id=c.usuario_id
               WHERE c.mes_ref=? AND u.perfil='morador' AND u.condominio=?""",
            (mes_ref, condominio)
        ).fetchone()[0]

        return jsonify({
            'mes_ref': mes_ref,
            'total_moradores': total_usuarios,
            'contas_pendentes': pendentes,
            'contas_atrasadas': atrasados,
            'valor_a_receber': round(valor_pendente, 2),
            'consumo_total_l': int(consumo_total),
        }), 200
    finally:
        conn.close()


@contas_bp.route('/todos', methods=['GET'])
@jwt_required
@_requer_sindico
def todas_contas():
    conn = get_db()
    try:
        condominio = _condominio_sindico(conn)
        mes = _mes_referencia_condominio(conn, condominio, request.args.get('mes'))
        rows = conn.execute(
            """SELECT c.*, u.nome, u.apto, u.bloco, u.condominio
               FROM contas c JOIN usuarios u ON c.usuario_id = u.id
               WHERE c.mes_ref=? AND u.perfil='morador' AND u.condominio=?
               ORDER BY u.nome""",
            (mes, condominio)
        ).fetchall()

        # para moradores sem conta neste mês, gera automaticamente
        usuarios = conn.execute(
            "SELECT id, nome FROM usuarios WHERE perfil='morador' AND condominio=?",
            (condominio,)
        ).fetchall()
        ids_com_conta = {r['usuario_id'] for r in rows}
        gerou_conta = False
        for u in usuarios:
            if u['id'] not in ids_com_conta:
                seed_contas(u['id'], u['nome'])
                gerou_conta = True

        if gerou_conta or not rows:
            rows = conn.execute(
                """SELECT c.*, u.nome, u.apto, u.bloco, u.condominio
                   FROM contas c JOIN usuarios u ON c.usuario_id = u.id
                   WHERE c.mes_ref=? AND u.perfil='morador' AND u.condominio=?
                   ORDER BY u.nome""",
                (mes, condominio)
            ).fetchall()

        return jsonify([dict(r) for r in rows]), 200
    finally:
        conn.close()


@contas_bp.route('/<int:conta_id>/status', methods=['PUT'])
@jwt_required
@_requer_sindico
def atualizar_status(conta_id):
    d = request.get_json(silent=True) or {}
    novo_status = d.get('status')
    if novo_status not in ('pago', 'pendente', 'atrasado'):
        return jsonify({'erro': 'Status invalido'}), 400
    conn = get_db()
    try:
        condominio = _condominio_sindico(conn)
        pertence = conn.execute(
            """SELECT 1 FROM contas c JOIN usuarios u ON u.id=c.usuario_id
               WHERE c.id=? AND u.condominio=?""",
            (conta_id, condominio)
        ).fetchone()
        if not pertence:
            return jsonify({'erro': 'Conta fora do condominio do sindico'}), 403

        dt_pag = datetime.date.today().strftime('%Y-%m-%d') if novo_status == 'pago' else None
        conn.execute(
            "UPDATE contas SET status=?, data_pagamento=? WHERE id=?",
            (novo_status, dt_pag, conta_id)
        )
        conn.commit()
        return jsonify({'mensagem': 'Status atualizado'}), 200
    finally:
        conn.close()


@contas_bp.route('/notificar', methods=['POST'])
@jwt_required
@_requer_sindico
def notificar_morador():
    d = request.get_json(silent=True) or {}
    usuario_id = d.get('usuario_id')
    tipo       = d.get('tipo', 'cobranca')  # cobranca | vazamento | aviso
    mensagem   = d.get('mensagem', '')

    if not usuario_id:
        return jsonify({'erro': 'usuario_id obrigatorio'}), 400

    icones  = {'cobranca': '💰', 'vazamento': '🚨', 'aviso': '📢'}
    niveis  = {'cobranca': 'alerta', 'vazamento': 'critico', 'aviso': 'info'}
    titulos = {
        'cobranca': '💰 Conta em atraso',
        'vazamento': '🚨 Possivel vazamento na sua unidade',
        'aviso': '📢 Aviso do Sindico',
    }

    conn = get_db()
    try:
        condominio = _condominio_sindico(conn)
        pertence = conn.execute(
            "SELECT 1 FROM usuarios WHERE id=? AND perfil='morador' AND condominio=?",
            (usuario_id, condominio)
        ).fetchone()
        if not pertence:
            return jsonify({'erro': 'Morador fora do condominio do sindico'}), 403

        conn.execute(
            "INSERT INTO notificacoes (usuario_id, nivel, titulo, descricao, icone, lido) VALUES (?,?,?,?,?,0)",
            (usuario_id, niveis[tipo], titulos[tipo], mensagem or titulos[tipo], icones[tipo])
        )
        conn.commit()
        return jsonify({'mensagem': 'Notificacao enviada'}), 200
    finally:
        conn.close()


@contas_bp.route('/consumo-moradores', methods=['GET'])
@jwt_required
@_requer_sindico
def consumo_moradores():
    conn = get_db()
    try:
        condominio = _condominio_sindico(conn)
        mes = _mes_referencia_condominio(conn, condominio, request.args.get('mes'))
        rows = conn.execute(
            """SELECT u.id, u.nome, u.apto, u.bloco,
                      c.consumo_l, c.consumo_m3, c.valor_rs, c.status
               FROM usuarios u
               LEFT JOIN contas c ON c.usuario_id=u.id AND c.mes_ref=?
               WHERE u.perfil='morador' AND u.condominio=?
               ORDER BY c.consumo_l DESC""",
            (mes, condominio)
        ).fetchall()

        media = 0
        vals  = [r['consumo_l'] for r in rows if r['consumo_l']]
        if vals:
            media = sum(vals) / len(vals)

        result = []
        for r in rows:
            cl = r['consumo_l'] or 0
            result.append({
                'usuario_id': r['id'],
                'nome': r['nome'],
                'unidade': f"Bloco {r['bloco']} Apto {r['apto']}",
                'consumo_l': cl,
                'consumo_m3': r['consumo_m3'] or 0,
                'valor_rs': r['valor_rs'] or 0,
                'status': r['status'] or 'sem_conta',
                'vs_media_pct': round((cl - media) / media * 100, 1) if media else 0,
            })
        return jsonify({'mes_ref': mes, 'moradores': result, 'media_l': round(media, 0)}), 200
    finally:
        conn.close()
