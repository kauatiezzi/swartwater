from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash
from db.connection import get_db, generate_token, seed_notificacoes, seed_contas

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/register', methods=['POST'])
def register():
    d = request.get_json(silent=True) or {}
    nome = (d.get('nome') or '').strip()
    email = (d.get('email') or '').strip().lower()
    senha = d.get('senha') or ''
    cpf = (d.get('cpf') or '').replace('.', '').replace('-', '').strip()
    perfil = d.get('perfil') or 'morador'
    condominio = (d.get('cond') or d.get('condominio') or '').strip()
    bloco = (d.get('bloco') or '').strip()
    apto = (d.get('apto') or '').strip()
    tel = (d.get('tel') or '').strip()

    if not nome or not email or not senha:
        return jsonify({'erro': 'Nome, e-mail e senha são obrigatórios'}), 400
    if len(senha) < 8:
        return jsonify({'erro': 'Senha deve ter no mínimo 8 caracteres'}), 400

    conn = get_db()
    try:
        existe = conn.execute(
            "SELECT id FROM usuarios WHERE email=?", (email,)
        ).fetchone()
        if existe:
            return jsonify({'erro': 'E-mail já cadastrado'}), 409

        senha_hash = generate_password_hash(senha)
        cursor = conn.execute(
            """INSERT INTO usuarios
               (nome, cpf, email, tel, senha_hash, perfil, condominio, bloco, apto)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (nome, cpf or None, email, tel, senha_hash, perfil, condominio, bloco, apto)
        )
        conn.commit()
        user_id = cursor.lastrowid

        conn.execute(
            "INSERT OR IGNORE INTO preferencias_alerta (usuario_id) VALUES (?)", (user_id,)
        )
        conn.commit()

        seed_notificacoes(user_id)
        seed_contas(user_id, nome)

        token = generate_token(user_id, perfil)
        return jsonify({
            'mensagem': 'Conta criada com sucesso!',
            'token': token,
            'usuario': {
                'id': user_id,
                'nome': nome,
                'perfil': perfil,
                'condominio': condominio,
                'apto': apto,
                'avatar_emoji': '👤',
            }
        }), 201

    except Exception as e:
        print(f'Erro register: {e}')
        return jsonify({'erro': 'Erro ao criar conta'}), 500
    finally:
        conn.close()


@auth_bp.route('/forgot', methods=['POST'])
def forgot():
    d = request.get_json(silent=True) or {}
    email = (d.get('email') or '').strip()
    if not email or '@' not in email:
        return jsonify({'erro': 'E-mail inválido'}), 400
    # In production: send real reset email
    return jsonify({'mensagem': f'Se o e-mail {email} estiver cadastrado, você receberá um link em breve.'}), 200
