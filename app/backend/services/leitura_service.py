class LeituraService:

    @staticmethod
    def calcular_vazao(volume, tempo):
        if tempo <= 0:
            return {"erro": "Tempo não pode ser zero"}

        vazao = volume / tempo
        return {"vazao": vazao}
