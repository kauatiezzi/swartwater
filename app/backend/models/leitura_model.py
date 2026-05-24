
class LeituraModel:
    def __init__(self, id, valor_vazao, data_hora, sensor_id):
        self.id = id
        self.valor_vazao = valor_vazao
        self.data_hora = data_hora
        self.sensor_id = sensor_id

    def to_dict(self):
        """Útil para converter o objeto em JSON para o Dashboard"""
        return {
            "id": self.id,
            "vazao": self.valor_vazao,
            "data": self.data_hora,
            "sensor_id": self.sensor_id
        }