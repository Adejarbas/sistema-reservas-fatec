# Protótipo das telas (wireframes)

Protótipo feito em texto, antes da implementação, para definir o que cada tela precisa ter.

## Paleta de cores

Baseada nas cores da Fatec (preto, vermelho e branco).

| Uso | Cor |
|---|---|
| Cor principal (botões, links, destaques) | `#B71C1C` vermelho |
| Menu lateral e cabeçalho | `#1C1C1C` preto |
| Fundo das páginas | `#F5F5F5` cinza bem claro |
| Cards e tabelas | `#FFFFFF` branco |
| Texto | `#212121` |
| Texto secundário | `#616161` |

Status das solicitações (badges):

| Status | Cor |
|---|---|
| Rascunho | cinza `#757575` |
| Pendente | amarelo `#F9A825` (texto escuro) |
| Em ajustes | laranja `#EF6C00` |
| Aprovada | verde `#2E7D32` |
| Rejeitada | vermelho `#C62828` |
| Cancelada | cinza escuro `#424242` |
| Concluída | azul `#1565C0` |

Fonte: a padrão do sistema (Segoe UI no Windows, Roboto no Android), tamanho base 16px.

## Layout geral

Desktop:

```
+--------------+-----------------------------------------------+
| RESERVAS     |  Painel                     Ana  [sino 2] Sair |
| FATEC        +-----------------------------------------------+
|              |                                               |
| > Painel     |   (conteúdo da página)                        |
|   Agenda     |                                               |
|   Nova solic.|                                               |
|   Minhas sol.|                                               |
|   ...        |                                               |
+--------------+-----------------------------------------------+
```

Celular: o menu lateral some e aparece um botão "Menu" no cabeçalho que abre o menu por cima do conteúdo.

```
+-----------------------------+
| [Menu]  Reservas    [sino]  |
+-----------------------------+
|                             |
|  (conteúdo em uma coluna)   |
|                             |
+-----------------------------+
```

O menu mostra só os itens do perfil logado (mas a permissão de verdade é verificada no servidor).

## 1. Login

```
+-----------------------------+
|     Reservas Fatec          |
|                             |
|  E-mail  [______________]   |
|  Senha   [______________]   |
|                             |
|        [  Entrar  ]         |
|                             |
|  (mensagem de erro aqui)    |
+-----------------------------+
```

## 2. Painel

```
Olá, Ana (Solicitante)

+-------------+ +-------------+ +-------------+
| Pendentes 2 | | Aprovadas 3 | | Em ajustes 1|
+-------------+ +-------------+ +-------------+

Minhas próximas reservas
| Data       | Horário     | Recurso    | Status    |
| 22/11/2026 | 14:00-16:00 | Auditório  | [Aprovada]|

Notificações recentes
- Sua solicitação #4 foi devolvida para ajustes.
```

Para o gestor e o responsável por equipamentos, o painel mostra a quantidade de itens aguardando análise e um link para a fila.

## 3. Agenda / disponibilidade

```
Data [22/11/2026]  Recurso [Espaços v]   [Filtrar]

Auditório (cap. 120)
  07:00-14:00  Livre
  14:00-16:00  Ocupado  - Palestra: Carreira em TI
  16:00-23:00  Livre

Laboratório 3 (cap. 30)
  07:00-23:00  Bloqueado - Manutenção do ar-condicionado
```

Cada faixa tem cor diferente (livre / ocupado / bloqueado) e também o texto escrito, para não depender só da cor.

## 4. Nova solicitação (atividade + recursos)

```
Dados da atividade
  Título            [____________________]
  Tipo              [Palestra v]
  Descrição         [____________________]
  Público estimado  [___]
  Início            [dd/mm/aaaa --:--]
  Fim               [dd/mm/aaaa --:--]

Espaço
  [Auditório (cap. 120) v]

Equipamentos
  [Projetor PAT-0001 v]  Qtd [1]  [Adicionar]
  - Microfone sem fio PAT-0101 (1)     [remover]

Observações [____________________]

[Salvar rascunho]   [Enviar para análise]
```

Se houver conflito, a mensagem aparece em cima do formulário, por exemplo:
"O Auditório já está reservado das 14:00 às 16:00 nesse dia."

## 5. Minhas solicitações / detalhe

```
Status [Todos v]  De [__/__]  Até [__/__]  [Filtrar]

| #  | Atividade          | Data       | Status      |       |
| 4  | Minicurso Python   | 23/11/2026 | [Em ajustes]| [Ver] |
| 2  | Oficina de Git     | 24/11/2026 | [Pendente]  | [Ver] |
```

Detalhe:

```
Solicitação #4 - Minicurso de Python      [Em ajustes]

Recursos
| Recurso        | Período             | Status    |
| Laboratório 3  | 23/11 08:00-12:00   | Pendente  |
| Notebook       | 23/11 08:00-12:00   | Pendente  |

Histórico
- 19/11 10:00  Ana criou a solicitação
- 19/11 10:05  Ana enviou para análise
- 19/11 14:30  Roberto devolveu para ajustes: "Ajustar horário..."

[Editar]  [Reenviar]  [Cancelar]
```

## 6. Fila de aprovação (gestor e responsável por equipamentos)

```
Status [Pendente v]  Recurso [Todos v]  Solicitante [____]  [Filtrar]

| #  | Atividade        | Solicitante | Data       | Recursos          |       |
| 2  | Oficina de Git   | Ana         | 24/11/2026 | Sala 101, Notebook| [Ver] |
```

Na tela de análise:

```
Justificativa / motivo [_____________________________]

[Aprovar]   [Devolver para ajustes]   [Rejeitar]
```

Rejeitar e devolver exigem o texto preenchido. Cada equipamento tem os próprios botões Aprovar / Rejeitar.

## 7. Equipamentos (responsável por equipamentos)

```
[+ Novo equipamento]

| Patrimônio | Nome          | Categoria | Situação     |        |
| PAT-0001   | Projetor Epson| Projetor  | Operacional  | [Editar]|
| PAT-0301   | Caixa de som  | Áudio     | Manutenção   | [Editar]|

Retiradas e devoluções de hoje
| Reserva | Equipamento | Solicitante | Período     |              |
| 12      | Projetor    | Carlos      | 14:00-16:00 | [Registrar retirada] |
| 9       | Microfone   | Ana         | 08:00-10:00 | [Registrar devolução]|
```

Ao registrar a devolução: condição [OK / Avariado] e observação. Se for "Avariado", o equipamento passa para a situação "avariado" e não pode mais ser reservado.

## 8. Administração

```
Abas: [Usuários] [Perfis] [Parâmetros] [Auditoria]

Usuários
| Nome   | E-mail               | Perfil      | Ativo |         |
| Ana    | aluno@exemplo.edu.br | Solicitante | Sim   | [Editar]|

Parâmetros
| Intervalo técnico (min)       | [0]     |
| Horário de abertura           | [07:00] |
| Horário de fechamento         | [23:00] |
| Antecedência mínima (horas)   | [24]    |
```

Bloqueios de período ficam no menu do gestor ("Bloqueios"): recurso, início, fim e motivo.
