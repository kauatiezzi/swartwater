# Integracao SmartWater

Este diretorio concentra a massa de dados usada pelo app mobile do Grupo 6.

## Arquivo principal

- `smartwater_integracao.json`: simula a entrega em JSON dos outros grupos e os dados administrativos que o DAAE enviaria.

O backend carrega esse arquivo durante `init_db()` e cria/atualiza:

- usuarios de teste dos perfis `morador`, `sindico` e `operador`
- contas de condominio
- notificacoes para morador, sindico e DAAE
- sensores e equipamentos da rede
- leituras de pressao e vazao
- bomba submersa subterranea da Vila Sedenho

## Credenciais de teste

Senha padrao para todos:

```txt
Smart@123
```

Usuarios principais:

```txt
Morador normal: marina.morador@smartwater.test
Morador com alerta: rafael.morador@smartwater.test
Sindico: camila.sindico@smartwater.test
Operador DAAE: operador@daae.com.br
```

## Endpoints novos

Todos exigem token JWT.

```txt
GET  /api/integracao/fonte-json
GET  /api/integracao/resumo-daae
GET  /api/integracao/condominios/<condominio_id>/visao-geral
POST /api/integracao/sincronizar
```

O `POST /api/integracao/sincronizar` e exclusivo do perfil `operador`.
