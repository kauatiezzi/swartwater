import json
import os
from copy import deepcopy

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(BASE_DIR, 'data', 'smartwater_integracao.json')


def carregar_integracao():
    with open(DATA_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)


def resumo_daae():
    data = carregar_integracao()
    leituras = data.get('leituras_rede', [])
    alertas = data.get('alertas', [])
    equipamentos = data.get('equipamentos', [])
    reservatorios = data.get('reservatorios', [])

    criticos = [a for a in alertas if a.get('nivel') == 'critico']
    atencao = [z for z in leituras if z.get('status') == 'atencao']
    total_entrada = sum(float(z.get('vazao_entrada_ls') or 0) for z in leituras)
    total_saida = sum(float(z.get('vazao_saida_ls') or 0) for z in leituras)
    perda_total = 0
    if total_entrada:
        perda_total = round((total_entrada - total_saida) / total_entrada * 100, 1)

    return {
        'origem': data.get('origem'),
        'daae': data.get('daae'),
        'resumo': {
            'zonas_monitoradas': len(leituras),
            'condominios_monitorados': len(data.get('condominios', [])),
            'reservatorios_monitorados': len(reservatorios),
            'equipamentos_monitorados': len(equipamentos),
            'alertas_criticos': len(criticos),
            'zonas_atencao': len(atencao),
            'vazao_total_entrada_ls': round(total_entrada, 2),
            'vazao_total_saida_ls': round(total_saida, 2),
            'perda_total_pct': perda_total,
        },
        'alertas': alertas,
        'leituras_rede': leituras,
        'reservatorios': reservatorios,
        'equipamentos': equipamentos,
        'atualizado_em': data.get('atualizado_em'),
    }


def visao_condominio(condominio_id):
    data = carregar_integracao()
    cond = next((c for c in data.get('condominios', []) if c.get('id') == condominio_id), None)
    if not cond:
        return None

    nome = cond.get('nome')
    moradores = [
        u for u in data.get('usuarios_teste', [])
        if u.get('perfil') == 'morador' and u.get('condominio') == nome
    ]
    emails = {u.get('email') for u in moradores}
    contas = [c for c in data.get('contas', []) if c.get('email_usuario') in emails]
    alertas = [
        a for a in data.get('alertas', [])
        if a.get('condominio') == nome or a.get('email_usuario') in emails
    ]

    result = deepcopy(cond)
    result['moradores'] = moradores
    result['contas'] = contas
    result['alertas'] = alertas
    result['total_pendente_rs'] = round(
        sum(float(c.get('valor_rs') or 0) for c in contas if c.get('status') != 'pago'),
        2
    )
    result['contas_abertas'] = len([c for c in contas if c.get('status') != 'pago'])
    return result
