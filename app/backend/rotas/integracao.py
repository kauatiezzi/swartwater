from flask import Blueprint, jsonify, request
from db.connection import jwt_required, seed_integracao_json
from services.integracao_service import carregar_integracao, resumo_daae, visao_condominio

integracao_bp = Blueprint('integracao', __name__)


def _perfil_permitido(*perfis):
    return getattr(request, 'user_perfil', '') in perfis


@integracao_bp.route('/fonte-json', methods=['GET'])
@jwt_required
def fonte_json():
    """Contrato completo recebido dos outros grupos e dos dados DAAE simulados."""
    if not _perfil_permitido('operador'):
        return jsonify({'erro': 'Acesso restrito a operadores DAAE'}), 403
    return jsonify(carregar_integracao()), 200


@integracao_bp.route('/resumo-daae', methods=['GET'])
@jwt_required
def get_resumo_daae():
    if not _perfil_permitido('operador'):
        return jsonify({'erro': 'Acesso restrito a operadores DAAE'}), 403
    return jsonify(resumo_daae()), 200


@integracao_bp.route('/condominios/<condominio_id>/visao-geral', methods=['GET'])
@jwt_required
def get_visao_condominio(condominio_id):
    if not _perfil_permitido('sindico', 'operador'):
        return jsonify({'erro': 'Acesso restrito a sindicos e operadores'}), 403
    result = visao_condominio(condominio_id)
    if not result:
        return jsonify({'erro': 'Condominio nao encontrado'}), 404
    return jsonify(result), 200


@integracao_bp.route('/sincronizar', methods=['POST'])
@jwt_required
def sincronizar():
    if not _perfil_permitido('operador'):
        return jsonify({'erro': 'Acesso restrito a operadores DAAE'}), 403
    resumo = seed_integracao_json()
    return jsonify({'mensagem': 'Dados sincronizados a partir do JSON', 'resumo': resumo}), 200
