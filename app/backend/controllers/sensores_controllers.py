from flask import Response
import json


class SensoresController:
    @staticmethod
    def listar_sensores():
        sensores = [
            {"id": 1, "nome": "Sensor Vazão Alpha", "local": "Entrada Principal", "status": "Ativo"},
            {"id": 2, "nome": "Sensor Vazão Beta", "local": "Saída Tanque 2", "status": "Inativo"},
        ]

        return Response(
            json.dumps(sensores, ensure_ascii=False, indent=4),
            mimetype="application/json",
        ), 200

    @staticmethod
    def cadastrar_sensor(dados):
        dados = dados or {}
        nome = dados.get("nome")
        local = dados.get("local")

        if not nome or not local:
            return {"erro": "Nome e local são obrigatórios"}, 400

        return {"mensagem": f"Sensor {nome} cadastrado com sucesso!"}, 201
