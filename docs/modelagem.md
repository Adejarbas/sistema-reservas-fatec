# Modelagem

Os diagramas estão em Mermaid. O GitHub mostra eles direto no navegador; no VS Code dá para ver com a extensão "Markdown Preview Mermaid Support".

## DER (Diagrama Entidade-Relacionamento)

```mermaid
erDiagram
    PERFIL ||--o{ USUARIO : "tem"
    USUARIO ||--o{ ATIVIDADE : "é responsável"
    USUARIO ||--o{ SOLICITACAO : "solicita"
    ATIVIDADE ||--o{ SOLICITACAO : "gera"
    SOLICITACAO ||--o{ RESERVA_ESPACO : "contém"
    SOLICITACAO ||--o{ RESERVA_EQUIPAMENTO : "contém"
    ESPACO ||--o{ RESERVA_ESPACO : "é reservado em"
    CATEGORIA ||--o{ EQUIPAMENTO : "agrupa"
    EQUIPAMENTO ||--o{ RESERVA_EQUIPAMENTO : "é reservado em"
    RESERVA_EQUIPAMENTO ||--o{ MOVIMENTACAO : "tem retirada/devolução"
    USUARIO ||--o{ MOVIMENTACAO : "registra"
    SOLICITACAO ||--o{ APROVACAO_HISTORICO : "tem"
    USUARIO ||--o{ APROVACAO_HISTORICO : "executa"
    ESPACO ||--o{ BLOQUEIO_RECURSO : "pode ter"
    EQUIPAMENTO ||--o{ BLOQUEIO_RECURSO : "pode ter"
    USUARIO ||--o{ BLOQUEIO_RECURSO : "cria"
    USUARIO ||--o{ NOTIFICACAO : "recebe"
    USUARIO ||--o{ AUDITORIA : "gera"

    PERFIL {
        int id PK
        text nome UK
        text permissoes
    }
    USUARIO {
        int id PK
        text nome
        text email UK
        text senha_hash
        int perfil_id FK
        int ativo
    }
    ATIVIDADE {
        int id PK
        text titulo
        text tipo
        text descricao
        int responsavel_id FK
        int publico_estimado
        text status
        text inicio
        text fim
    }
    SOLICITACAO {
        int id PK
        int atividade_id FK
        int solicitante_id FK
        text status
        text motivo
        text criada_em
        text atualizada_em
    }
    ESPACO {
        int id PK
        text nome UK
        text localizacao
        int capacidade
        int ativo
    }
    CATEGORIA {
        int id PK
        text nome UK
    }
    EQUIPAMENTO {
        int id PK
        text codigo_patrimonio UK
        text nome
        int categoria_id FK
        text tipo_controle
        int quantidade_total
        text situacao
        text localizacao
    }
    RESERVA_ESPACO {
        int id PK
        int solicitacao_id FK
        int espaco_id FK
        text inicio
        text fim
        text status
        text justificativa
    }
    RESERVA_EQUIPAMENTO {
        int id PK
        int solicitacao_id FK
        int equipamento_id FK
        text inicio
        text fim
        int quantidade
        text status
        text justificativa
    }
    MOVIMENTACAO {
        int id PK
        int reserva_equipamento_id FK
        text tipo
        int responsavel_id FK
        text data_hora
        text condicao
        int quantidade_avariada
        text observacao
    }
    APROVACAO_HISTORICO {
        int id PK
        int solicitacao_id FK
        int ator_id FK
        text acao
        text status_anterior
        text status_novo
        text justificativa
        text data_hora
    }
    BLOQUEIO_RECURSO {
        int id PK
        int espaco_id FK
        int equipamento_id FK
        text inicio
        text fim
        text motivo
        int criado_por FK
    }
    NOTIFICACAO {
        int id PK
        int usuario_id FK
        text mensagem
        text link
        int lida
        text criada_em
    }
    AUDITORIA {
        int id PK
        int usuario_id FK
        text acao
        text entidade
        int entidade_id
        text detalhes
        text data_hora
    }
    PARAMETRO {
        text chave PK
        text valor
        text descricao
    }
```

Observações sobre o modelo:

- **Disponibilidade não é guardada.** Ela é calculada a partir de `RESERVA_ESPACO` / `RESERVA_EQUIPAMENTO` (status `aprovada` ou `retirado`) e `BLOQUEIO_RECURSO`.
- `BLOQUEIO_RECURSO` tem `espaco_id` **ou** `equipamento_id`, nunca os dois (`CHECK` no banco). O PDF sugere `tipo_recurso + recurso_id`; separando em duas colunas dá para ter chave estrangeira.
- `EQUIPAMENTO.tipo_controle` separa o item individual (patrimônio, quantidade 1) do item por quantidade (estoque, ex.: cabos).
- `MOVIMENTACAO` tem `UNIQUE (reserva_equipamento_id, tipo)`: no máximo uma retirada e uma devolução por reserva.
- `APROVACAO_HISTORICO` tem triggers que impedem `UPDATE` e `DELETE`.
- `PARAMETRO` guarda as regras configuráveis (intervalo técnico, horário de funcionamento, antecedência).

## Diagrama de casos de uso

```mermaid
flowchart LR
    SOL([Solicitante])
    GES([Gestor de Espaços / Secretaria])
    EQP([Responsável por Equipamentos])
    ADM([Administrador])
    PUB([Consulta pública])

    subgraph Sistema de Reservas
        UC1[Fazer login]
        UC2[Consultar disponibilidade]
        UC3[Criar solicitação / rascunho]
        UC4[Enviar e acompanhar solicitação]
        UC5[Cancelar solicitação]
        UC6[Analisar solicitação: aprovar, rejeitar, devolver]
        UC7[Cadastrar espaços]
        UC8[Bloquear período]
        UC9[Cadastrar equipamentos e categorias]
        UC10[Aprovar ou rejeitar equipamento]
        UC11[Registrar retirada e devolução]
        UC12[Registrar avaria / manutenção]
        UC13[Gerenciar usuários e perfis]
        UC14[Alterar parâmetros]
        UC15[Consultar auditoria]
        UC16[Ver notificações]
        UC17[Ver agenda pública]
    end

    SOL --- UC1 & UC2 & UC3 & UC4 & UC5 & UC16
    GES --- UC1 & UC2 & UC6 & UC7 & UC8 & UC5 & UC16
    EQP --- UC1 & UC2 & UC9 & UC10 & UC11 & UC12 & UC8 & UC16
    ADM --- UC1 & UC13 & UC14 & UC15
    PUB --- UC17
```

## Diagrama de estados da solicitação

```mermaid
stateDiagram-v2
    [*] --> Rascunho: criar
    Rascunho --> Pendente: enviar (verifica disponibilidade)
    Rascunho --> Cancelada: cancelar
    Pendente --> Aprovada: aprovar (verifica de novo, em transação)
    Pendente --> Rejeitada: rejeitar (justificativa obrigatória)
    Pendente --> EmAjustes: devolver (motivo obrigatório)
    Pendente --> Cancelada: cancelar
    EmAjustes --> Pendente: corrigir e reenviar
    EmAjustes --> Cancelada: cancelar
    Aprovada --> Pendente: alterar (nova análise)
    Aprovada --> Cancelada: cancelar (libera a agenda)
    Aprovada --> Concluida: concluir (após o término)
    Rejeitada --> [*]
    Cancelada --> [*]
    Concluida --> [*]

    EmAjustes: Em ajustes
    Concluida: Concluída
```

## Processo: reserva de auditório com equipamento

```mermaid
sequenceDiagram
    actor S as Solicitante
    participant API
    participant BD as Banco (SQLite)
    actor G as Gestor
    actor E as Resp. Equipamentos

    S->>API: POST /api/solicitacoes (auditório + projetor, enviar)
    API->>BD: verifica reservas aprovadas e bloqueios
    alt conflito
        API-->>S: 409 "O espaço Auditório já está reservado das 14:00 às 16:00..."
    else livre
        API->>BD: grava solicitação Pendente + histórico
        API-->>S: 201 Pendente
        API->>G: notificação "nova solicitação"
    end

    G->>API: PATCH /api/solicitacoes/:id/aprovar
    API->>BD: BEGIN IMMEDIATE
    API->>BD: verifica conflito de novo
    API->>BD: espaço = aprovada, solicitação = Aprovada, histórico
    API->>BD: COMMIT
    API->>S: notificação "aprovada"

    E->>API: PATCH /api/reservas-equipamento/:id/aprovar
    E->>API: POST /api/movimentacoes (retirada, ok)
    E->>API: POST /api/movimentacoes (devolução, avariado)
    API->>BD: equipamento.situacao = avariado
```
