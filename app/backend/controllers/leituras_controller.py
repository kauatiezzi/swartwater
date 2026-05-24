from services.leitura_service import LeituraService

class LeituraController:

    @staticmethod
    def processar_calculo(dados):
        try:
            vol = float(dados.get("volume", 0))
            temp = float(dados.get("tempo", 0))
        except (TypeError, ValueError):
            return {"erro": "Volume e tempo devem ser números"}, 400

        if vol < 0 or temp <= 0:
            return {"erro": "Volume deve ser positivo e tempo deve ser maior que zero"}, 400

        resultado = LeituraService.calcular_vazao(vol, temp)
        print("RESULTADO:", resultado)

        return resultado, 200
