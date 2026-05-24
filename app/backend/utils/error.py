from flask import jsonify

def error_response(mensagem, status_code):
    """Padroniza a resposta de erro do sistema"""
    return jsonify({
        "sucesso": False,
        "mensagem": mensagem,
        "status": status_code
    }), status_code

def nao_encontrado(e):
    return error_response("Recurso não encontrado no servidor.", 404)

def erro_interno(e):
    return error_response("Ocorreu um erro interno no servidor.", 500)