from flask import Blueprint, request, jsonify
from controllers.leituras_controller import LeituraController

leituras_bp = Blueprint('leituras', __name__)

@leituras_bp.route('/calcular', methods=['POST'])
def calcular():
    resposta, status = LeituraController.processar_calculo(request.get_json(silent=True) or {})
    return jsonify(resposta), status
