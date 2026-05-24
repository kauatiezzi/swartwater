import sqlite3
from db.connection import Usuarios  

class SensorService:
    def __init__(self, db_path='banco_dados.db'):
        self.db_path = db_path

    def listar_todos(self):
        """Busca todos os sensores cadastrados no banco"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, nome, localizacao, status FROM sensores")
            linhas = cursor.fetchall()
            
            sensores = []
            for l in linhas:
                sensores.append({
                    "id": l[0],
                    "nome": l[1],
                    "local": l[2],
                    "status": l[3]
                })
            return sensores

    def criar_novo(self, nome, localizacao):
        """Insere um novo sensor no banco de dados"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO sensores (nome, localizacao, status) VALUES (?, ?, ?)",
                    (nome, localizacao, 'Ativo')
                )
                conn.commit()
                return True
        except Exception as e:
            print(f"Erro ao salvar sensor: {e}")
            return False