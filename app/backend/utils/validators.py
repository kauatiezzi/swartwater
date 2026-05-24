# utils/validators.py

class Validators:
    @staticmethod
    def validar_vazao(volume, tempo):
        """Garante que volume e tempo sejam números positivos"""
        try:
            vol = float(volume)
            temp = float(tempo)
            
            if vol < 0 or temp <= 0:
                return False, "O volume deve ser >= 0 e o tempo deve ser > 0."
            return True, None
        except (ValueError, TypeError):
            return False, "Os valores de volume e tempo devem ser numéricos."

    @staticmethod
    def validar_login(usuario, senha):
        """Verifica se os campos não estão em branco"""
        if not usuario or not senha:
            return False, "Usuário e senha são obrigatórios."
        if len(senha) < 3:
            return False, "A senha deve ter pelo menos 3 caracteres."
        return True, None