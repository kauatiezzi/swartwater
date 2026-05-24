
class SensorModel:
    def __init__(self, id, nome, localizacao, status="Ativo"):
        self.id = id
        self.nome = nome
        self.localizacao = localizacao
        self.status = status

    def __str__(self):
        return f"Sensor {self.nome} localizado em {self.localizacao}"