from flask import Blueprint, request, jsonify
from db.connection import get_db, generate_token, check_password_hash

login_bp = Blueprint('login', __name__)


@login_bp.route('/login', methods=['POST'])
def login():
    dados = request.get_json(silent=True) or {}
    usuario = dados.get('usuario') or dados.get('email') or ''
    senha = dados.get('senha') or dados.get('password') or ''

    if not usuario or not senha:
        return jsonify({'erro': 'Usuário e senha são obrigatórios'}), 400

    conn = get_db()
    try:
        row = conn.execute(
            "SELECT id, nome, senha_hash, perfil, condominio, apto, avatar_emoji "
            "FROM usuarios WHERE email=? OR cpf=?",
            (usuario, usuario)
        ).fetchone()

        if not row or not check_password_hash(row['senha_hash'], senha):
            return jsonify({'erro': 'Usuário ou senha incorretos'}), 401

        token = generate_token(row['id'], row['perfil'])
        return jsonify({
            'mensagem': 'Login aprovado!',
            'token': token,
            'usuario': {
                'id': row['id'],
                'nome': row['nome'],
                'perfil': row['perfil'],
                'condominio': row['condominio'],
                'apto': row['apto'],
                'avatar_emoji': row['avatar_emoji'],
            }
        }), 200

    except Exception as e:
        print(f'Erro login: {e}')
        return jsonify({'erro': 'Erro interno'}), 500
    finally:
        conn.close()
