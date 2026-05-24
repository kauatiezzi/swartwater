from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from db.connection import get_db, jwt_required

usuario_bp = Blueprint('usuario', __name__)


@usuario_bp.route('/perfil', methods=['GET'])
@jwt_required
def get_perfil():
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT id, nome, cpf, email, tel, perfil, condominio, bloco, apto, avatar_emoji, meta_mensal "
            "FROM usuarios WHERE id=?", (request.user_id,)
        ).fetchone()
        if not row:
            return jsonify({'erro': 'Usuário não encontrado'}), 404
        return jsonify(dict(row)), 200
    finally:
        conn.close()


@usuario_bp.route('/perfil', methods=['PUT'])
@jwt_required
def atualizar_perfil():
    d = request.get_json(silent=True) or {}
    conn = get_db()
    try:
        conn.execute(
            """UPDATE usuarios SET
               nome=COALESCE(?,nome), cpf=COALESCE(?,cpf), email=COALESCE(?,email),
               tel=COALESCE(?,tel), condominio=COALESCE(?,condominio),
               bloco=COALESCE(?,bloco), apto=COALESCE(?,apto),
               avatar_emoji=COALESCE(?,avatar_emoji)
               WHERE id=?""",
            (
                d.get('nome'), d.get('cpf'), d.get('email'),
                d.get('tel'), d.get('cond') or d.get('condominio'),
                d.get('bloco'), d.get('apto'),
                d.get('avatar_emoji'),
                request.user_id
            )
        )
        conn.commit()
        return jsonify({'mensagem': 'Perfil atualizado'}), 200
    finally:
        conn.close()


@usuario_bp.route('/meta', methods=['PUT'])
@jwt_required
def atualizar_meta():
    d = request.get_json(silent=True) or {}
    meta = d.get('meta')
    if not meta or int(meta) < 500:
        return jsonify({'erro': 'Meta inválida (mínimo 500 L)'}), 400
    conn = get_db()
    try:
        conn.execute("UPDATE usuarios SET meta_mensal=? WHERE id=?", (int(meta), request.user_id))
        conn.commit()
        return jsonify({'mensagem': 'Meta atualizada', 'meta': int(meta)}), 200
    finally:
        conn.close()


@usuario_bp.route('/alertas', methods=['GET'])
@jwt_required
def get_alertas():
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT * FROM preferencias_alerta WHERE usuario_id=?", (request.user_id,)
        ).fetchone()
        if not row:
            conn.execute("INSERT OR IGNORE INTO preferencias_alerta (usuario_id) VALUES (?)", (request.user_id,))
            conn.commit()
            row = conn.execute(
                "SELECT * FROM preferencias_alerta WHERE usuario_id=?", (request.user_id,)
            ).fetchone()
        return jsonify(dict(row)), 200
    finally:
        conn.close()


@usuario_bp.route('/alertas', methods=['PUT'])
@jwt_required
def atualizar_alertas():
    d = request.get_json(silent=True) or {}
    conn = get_db()
    try:
        conn.execute("INSERT OR IGNORE INTO preferencias_alerta (usuario_id) VALUES (?)", (request.user_id,))
        conn.execute(
            """UPDATE preferencias_alerta SET
               vazamento=?, consumo_excessivo=?, meta_mensal_alerta=?,
               relatorio_semanal=?, dicas=?, horario_silencio=?,
               silencio_inicio=?, silencio_fim=?
               WHERE usuario_id=?""",
            (
                int(d.get('vazamento', 1)), int(d.get('consumo_excessivo', 1)),
                int(d.get('meta_mensal', 1)), int(d.get('relatorio_semanal', 0)),
                int(d.get('dicas', 1)), int(d.get('horario_silencio', 0)),
                d.get('silencio_inicio', '22:00'), d.get('silencio_fim', '07:00'),
                request.user_id
            )
        )
        conn.commit()
        return jsonify({'mensagem': 'Preferências salvas'}), 200
    finally:
        conn.close()


@usuario_bp.route('/senha', methods=['PUT'])
@jwt_required
def alterar_senha():
    d = request.get_json(silent=True) or {}
    atual = d.get('atual') or ''
    nova = d.get('nova') or ''
    if not atual or not nova:
        return jsonify({'erro': 'Senha atual e nova são obrigatórias'}), 400
    if len(nova) < 8:
        return jsonify({'erro': 'Nova senha deve ter no mínimo 8 caracteres'}), 400
    conn = get_db()
    try:
        row = conn.execute("SELECT senha_hash FROM usuarios WHERE id=?", (request.user_id,)).fetchone()
        if not row or not check_password_hash(row['senha_hash'], atual):
            return jsonify({'erro': 'Senha atual incorreta'}), 401
        conn.execute(
            "UPDATE usuarios SET senha_hash=? WHERE id=?",
            (generate_password_hash(nova), request.user_id)
        )
        conn.commit()
        return jsonify({'mensagem': 'Senha alterada com sucesso'}), 200
    finally:
        conn.close()
