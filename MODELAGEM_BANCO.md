# SmartWater — Modelagem do Banco de Dados

## Visão Geral do Sistema

O SmartWater é uma plataforma de monitoramento inteligente de consumo hídrico residencial/condominial.
Usuários (moradores e síndicos) acessam via app para visualizar consumo, receber alertas e gerenciar
preferências. Sensores físicos registram leituras de vazão que alimentam o dashboard.

---

## Diagrama de Relacionamentos (MER)

```
usuarios (1) ────< notificacoes
usuarios (1) ────< preferencias_alerta (1:1)
sensores (1) ────< leituras
```

---

## Tabelas

---

### 1. `usuarios`
Armazena todos os usuários do sistema (moradores e síndicos).

| Campo          | Tipo      | Obrigatório | Único | Padrão           | Descrição |
|----------------|-----------|-------------|-------|------------------|-----------|
| `id`           | INTEGER   | PK          | SIM   | autoincrement    | Identificador único |
| `nome`         | TEXT      | SIM         | NÃO   | —                | Nome completo |
| `cpf`          | TEXT      | NÃO         | SIM   | NULL             | CPF (somente dígitos, 11 chars). Único quando informado |
| `email`        | TEXT      | SIM         | SIM   | —                | E-mail de login. Único no sistema |
| `tel`          | TEXT      | NÃO         | NÃO   | NULL             | Telefone/WhatsApp (formato livre) |
| `senha_hash`   | TEXT      | SIM         | NÃO   | —                | Hash bcrypt da senha (werkzeug). NUNCA armazenar senha pura |
| `perfil`       | TEXT      | NÃO         | NÃO   | `'morador'`      | Tipo de acesso: `'morador'` ou `'sindico'` |
| `condominio`   | TEXT      | NÃO         | NÃO   | `''`             | Nome do condomínio |
| `bloco`        | TEXT      | NÃO         | NÃO   | `''`             | Bloco/torre |
| `apto`         | TEXT      | NÃO         | NÃO   | `''`             | Número do apartamento |
| `avatar_emoji` | TEXT      | NÃO         | NÃO   | `'👤'`           | Emoji do avatar (1 caractere Unicode) |
| `meta_mensal`  | INTEGER   | NÃO         | NÃO   | `4500`           | Meta de consumo em litros/mês |
| `criado_em`    | TIMESTAMP | NÃO         | NÃO   | `CURRENT_TIMESTAMP` | Data/hora de cadastro |

**Regras de negócio:**
- E-mail deve ser único e válido (`x@x.x`)
- Senha mínimo 8 caracteres (validado antes do hash)
- CPF: apenas dígitos (pontos e traços removidos antes de salvar). Único somente quando preenchido (pode ser NULL para usuários sem CPF)
- `perfil` aceita apenas: `'morador'` ou `'sindico'`
- `meta_mensal` mínimo 500 litros

---

### 2. `sensores`
Cadastro dos sensores físicos de vazão instalados no condomínio.

| Campo         | Tipo    | Obrigatório | Único | Padrão   | Descrição |
|---------------|---------|-------------|-------|----------|-----------|
| `id`          | INTEGER | PK          | SIM   | autoincrement | Identificador único |
| `nome`        | TEXT    | SIM         | NÃO   | —        | Nome descritivo do sensor |
| `localizacao` | TEXT    | SIM         | NÃO   | —        | Local de instalação (ex: "Entrada Principal") |
| `status`      | TEXT    | NÃO         | NÃO   | `'Ativo'` | Status operacional: `'Ativo'` ou `'Inativo'` |

**Dados iniciais (seed automático):**
```
Sensor Vazão Alpha   | Entrada Principal | Ativo
Sensor Vazão Beta    | Saída Tanque 2    | Inativo
Sensor Reservatório  | Cobertura         | Ativo
```

**Regras de negócio:**
- Todo sensor deve ter nome e localização
- `status` aceita apenas: `'Ativo'` ou `'Inativo'`

---

### 3. `leituras`
Registra cada leitura de vazão capturada pelos sensores.

| Campo        | Tipo      | Obrigatório | Único | Padrão              | Descrição |
|--------------|-----------|-------------|-------|---------------------|-----------|
| `id`         | INTEGER   | PK          | SIM   | autoincrement       | Identificador único |
| `sensor_id`  | INTEGER   | NÃO         | NÃO   | NULL                | FK → `sensores.id` |
| `valor_vazao`| REAL      | NÃO         | NÃO   | NULL                | Vazão em L/min (aceita decimais) |
| `data_hora`  | TIMESTAMP | NÃO         | NÃO   | `CURRENT_TIMESTAMP` | Data e hora da leitura |

**Relacionamento:** `sensor_id` → `sensores.id` (ON DELETE: NO ACTION)

**Regras de negócio:**
- `valor_vazao` deve ser >= 0 (validado na aplicação)
- Uma leitura sem `sensor_id` válido ainda pode ser inserida (sensor pode ter sido desativado)
- Leituras são imutáveis após registro (histórico de auditoria)
- Volume total de um período = soma de `valor_vazao` × intervalo de tempo entre leituras

---

### 4. `notificacoes`
Alertas e notificações gerados para cada usuário.

| Campo       | Tipo      | Obrigatório | Único | Padrão              | Descrição |
|-------------|-----------|-------------|-------|---------------------|-----------|
| `id`        | INTEGER   | PK          | SIM   | autoincrement       | Identificador único |
| `usuario_id`| INTEGER   | SIM         | NÃO   | —                   | FK → `usuarios.id` |
| `nivel`     | TEXT      | SIM         | NÃO   | —                   | Gravidade: `'critico'`, `'alerta'`, `'info'`, `'ok'` |
| `titulo`    | TEXT      | SIM         | NÃO   | —                   | Título curto da notificação |
| `descricao` | TEXT      | NÃO         | NÃO   | `''`                | Texto detalhado |
| `icone`     | TEXT      | NÃO         | NÃO   | `'🔔'`              | Emoji representativo |
| `lido`      | INTEGER   | NÃO         | NÃO   | `0`                 | Flag lido: `0` = não lido, `1` = lido |
| `criado_em` | TIMESTAMP | NÃO         | NÃO   | `CURRENT_TIMESTAMP` | Data/hora de criação |

**Relacionamento:** `usuario_id` → `usuarios.id` (ON DELETE: CASCADE recomendado)

**Regras de negócio:**
- `nivel` aceita apenas: `'critico'`, `'alerta'`, `'info'`, `'ok'`
- `lido`: apenas 0 ou 1 (booleano simulado em SQLite)
- Ao criar conta, 6 notificações iniciais são inseridas automaticamente para o usuário
- Notificações críticas não podem ser deletadas pelo usuário (somente marcadas como lidas)
- Ordenação padrão: `criado_em DESC` (mais recentes primeiro)

**Tipos de notificação e seus níveis:**
| Evento                          | Nível      |
|---------------------------------|-----------|
| Possível vazamento detectado    | `critico` |
| Consumo acima da média          | `alerta`  |
| Meta mensal em risco (> 80%)    | `alerta`  |
| Relatório semanal disponível    | `info`    |
| Dica de economia                | `info`    |
| Meta da semana atingida         | `ok`      |

---

### 5. `preferencias_alerta`
Configurações de notificação de cada usuário (relação 1:1 com `usuarios`).

| Campo               | Tipo    | Obrigatório | Padrão   | Descrição |
|---------------------|---------|-------------|----------|-----------|
| `usuario_id`        | INTEGER | PK / FK     | —        | FK → `usuarios.id`. Chave primária também |
| `vazamento`         | INTEGER | NÃO         | `1`      | Receber alerta de vazamento: 0/1 |
| `consumo_excessivo` | INTEGER | NÃO         | `1`      | Alerta de consumo acima da média: 0/1 |
| `meta_mensal_alerta`| INTEGER | NÃO         | `1`      | Alerta ao atingir 80% da meta: 0/1 |
| `relatorio_semanal` | INTEGER | NÃO         | `0`      | Relatório toda segunda-feira: 0/1 |
| `dicas`             | INTEGER | NÃO         | `1`      | Dicas de economia: 0/1 |
| `horario_silencio`  | INTEGER | NÃO         | `0`      | Silêncio noturno ativado: 0/1 |
| `silencio_inicio`   | TEXT    | NÃO         | `'22:00'`| Hora início silêncio (HH:MM) |
| `silencio_fim`      | TEXT    | NÃO         | `'07:00'`| Hora fim silêncio (HH:MM) |

**Relacionamento:** `usuario_id` → `usuarios.id` (1:1, ON DELETE CASCADE recomendado)

**Regras de negócio:**
- Registro criado automaticamente no cadastro do usuário (`INSERT OR IGNORE`)
- Todos os campos booleanos: apenas 0 ou 1
- `silencio_inicio` e `silencio_fim` no formato `'HH:MM'` (24h)
- Se `horario_silencio = 0`, os campos de hora são ignorados

---

## Resumo dos Relacionamentos

```
usuarios.id (PK)
    |
    |──< notificacoes.usuario_id (FK, obrigatório)
    |
    |──< preferencias_alerta.usuario_id (FK, PK, 1:1)

sensores.id (PK)
    |
    |──< leituras.sensor_id (FK, opcional)
```

---

## Scripts SQL de Criação (SQLite)

```sql
CREATE TABLE IF NOT EXISTS usuarios (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    nome         TEXT NOT NULL,
    cpf          TEXT UNIQUE,
    email        TEXT UNIQUE NOT NULL,
    tel          TEXT,
    senha_hash   TEXT NOT NULL,
    perfil       TEXT DEFAULT 'morador'
                      CHECK (perfil IN ('morador','sindico')),
    condominio   TEXT DEFAULT '',
    bloco        TEXT DEFAULT '',
    apto         TEXT DEFAULT '',
    avatar_emoji TEXT DEFAULT '👤',
    meta_mensal  INTEGER DEFAULT 4500
                          CHECK (meta_mensal >= 500),
    criado_em    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sensores (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nome        TEXT NOT NULL,
    localizacao TEXT NOT NULL,
    status      TEXT DEFAULT 'Ativo'
                     CHECK (status IN ('Ativo','Inativo'))
);

CREATE TABLE IF NOT EXISTS leituras (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    sensor_id   INTEGER REFERENCES sensores(id),
    valor_vazao REAL CHECK (valor_vazao >= 0),
    data_hora   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notificacoes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nivel       TEXT NOT NULL
                     CHECK (nivel IN ('critico','alerta','info','ok')),
    titulo      TEXT NOT NULL,
    descricao   TEXT DEFAULT '',
    icone       TEXT DEFAULT '🔔',
    lido        INTEGER DEFAULT 0 CHECK (lido IN (0,1)),
    criado_em   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS preferencias_alerta (
    usuario_id          INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    vazamento           INTEGER DEFAULT 1  CHECK (vazamento IN (0,1)),
    consumo_excessivo   INTEGER DEFAULT 1  CHECK (consumo_excessivo IN (0,1)),
    meta_mensal_alerta  INTEGER DEFAULT 1  CHECK (meta_mensal_alerta IN (0,1)),
    relatorio_semanal   INTEGER DEFAULT 0  CHECK (relatorio_semanal IN (0,1)),
    dicas               INTEGER DEFAULT 1  CHECK (dicas IN (0,1)),
    horario_silencio    INTEGER DEFAULT 0  CHECK (horario_silencio IN (0,1)),
    silencio_inicio     TEXT DEFAULT '22:00',
    silencio_fim        TEXT DEFAULT '07:00'
);
```

---

## Endpoints da API e Tabelas Utilizadas

| Método | Rota                          | Tabelas                            | Auth |
|--------|-------------------------------|-----------------------------------|------|
| POST   | `/api/auth/register`          | usuarios, preferencias_alerta, notificacoes | Não |
| POST   | `/api/login`                  | usuarios                           | Não |
| POST   | `/api/auth/forgot`            | —                                  | Não |
| GET    | `/api/consumo/dashboard`      | usuarios (meta_mensal) + leituras  | Sim |
| GET    | `/api/consumo/historico`      | leituras                           | Sim |
| GET    | `/api/notificacoes/`          | notificacoes                       | Sim |
| PATCH  | `/api/notificacoes/:id/lido`  | notificacoes                       | Sim |
| GET    | `/api/usuario/perfil`         | usuarios                           | Sim |
| PUT    | `/api/usuario/perfil`         | usuarios                           | Sim |
| PUT    | `/api/usuario/meta`           | usuarios (meta_mensal)             | Sim |
| GET    | `/api/usuario/alertas`        | preferencias_alerta                | Sim |
| PUT    | `/api/usuario/alertas`        | preferencias_alerta                | Sim |
| PUT    | `/api/usuario/senha`          | usuarios (senha_hash)              | Sim |
| GET    | `/api/sensores/`              | sensores                           | Não |
| POST   | `/api/sensores/cadastro`      | sensores                           | Não |
| POST   | `/api/leituras/calcular`      | leituras                           | Não |

---

## Observações para Migração / Produção

1. **Banco atual**: SQLite (arquivo `smartwater.db`). Adequado para desenvolvimento e demonstração.
2. **Produção recomendada**: PostgreSQL ou MySQL — suportam múltiplas conexões simultâneas.
3. **Senhas**: armazenadas com hash Werkzeug (bcrypt-like). Nunca migrar senhas em texto puro.
4. **CPF**: armazenado sem formatação (somente 11 dígitos numéricos). Aplicação remove pontos/traços antes de salvar.
5. **Timestamps**: usar UTC em todos os campos de data/hora.
6. **Futura expansão sugerida**:
   - Tabela `condominios` para separar o cadastro do condomínio dos usuários
   - Tabela `consumo_mensal` para agregar leituras por mês e usuário
   - Tabela `alertas_config` no nível do condomínio (limiares globais)
