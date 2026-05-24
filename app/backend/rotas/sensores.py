from flask import Blueprint, request, jsonify
from controllers.sensores_controllers import SensoresController
from db.connection import get_db

sensores_bp = Blueprint('sensores', __name__)

@sensores_bp.route('/', methods=['GET'])
def listar_todos():
    conn = get_db()
    try:
        rows = conn.execute("SELECT * FROM sensores").fetchall()
        return jsonify([dict(r) for r in rows]), 200
    finally:
        conn.close()

@sensores_bp.route('/cadastro', methods=['POST'])
def cadastrar():
    dados = request.get_json()
    resultado, status = SensoresController.cadastrar_sensor(dados)
    return resultado, status