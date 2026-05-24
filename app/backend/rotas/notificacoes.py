from flask import Blueprint, jsonify, request
from db.connection import get_db, jwt_required, seed_notificacoes

notificacoes_bp = Blueprint('notificacoes', __name__)


@notificacoes_bp.route('/', methods=['GET'])
@jwt_required
def listar():
    user_id = request.user_id
    seed_notificacoes(user_id)
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT id, nivel, titulo, descricao, icone, lido, criado_em "
            "FROM notificacoes WHERE usuario_id=? ORDER BY criado_em DESC",
            (user_id,)
        ).fetchall()
        notifs = []
        for r in rows:
            ts = r['criado_em'] or ''
            notifs.append({
                'id': r['id'],
                'nivel': r['nivel'],
                'titulo': r['titulo'],
                'desc': r['descricao'],
                'icone': r['icone'],
                'lido': bool(r['lido']),
                'tempo': _formatar_tempo(ts),
            })
        return jsonify(notifs), 200
    finally:
        conn.close()


@notificacoes_bp.route('/<int:notif_id>/lido', methods=['PATCH'])
@jwt_required
def marcar_lido(notif_id):
    user_id = request.user_id
    conn = get_db()
    try:
        conn.execute(
            "UPDATE notificacoes SET lido=1 WHERE id=? AND usuario_id=?",
            (notif_id, user_id)
        )
        conn.commit()
        return jsonify({'mensagem': 'Marcado como lido'}), 200
    finally:
        conn.close()


def _formatar_tempo(ts):
    if not ts:
        return ''
    try:
        import datetime
        dt = datetime.datetime.fromisoformat(ts)
        agora = datetime.datetime.utcnow()
        diff = agora - dt
        mins = int(diff.total_seconds() / 60)
        if mins < 2:
            return 'Agora'
        if mins < 60:
            return f'{mins} min atrás'
        horas = mins // 60
        if horas < 24:
            return f'{horas}h atrás'
        dias = horas // 24
        if dias == 1:
            return 'Ontem'
        return f'{dias} dias atrás'
    except Exception:
        return ts
