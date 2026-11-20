# Regras de negócio e onde estão implementadas

Todas as regras são validadas no **backend**. O frontend só ajuda o usuário (esconde botões, mostra avisos), mas quem decide é a API.

Caminhos relativos a `backend/src/`.

## Atividades e espaços

| Regra | Descrição | Onde está |
|---|---|---|
| RN-01 | Só usuários autenticados e autorizados podem solicitar | `middlewares/auth.js` (`autenticar`, `permitir('solicitar')`) e `routes/solicitacaoRoutes.js` |
| RN-02 | Atividade precisa de título, tipo, descrição, responsável, data, horários e público | `services/solicitacaoService.js` → `validarDados()`; o responsável é o usuário logado |
| RN-03 | Fim depois do início (sem duração nula/negativa) | `services/disponibilidadeService.js` → `validarPeriodo()` e `CHECK (inicio < fim)` no `schema.sql` |
| RN-04 | Não aprovar duas reservas incompatíveis no mesmo espaço; considerar intervalo de montagem | `disponibilidadeService.verificarEspaco()` + `reservaModel.conflitoEspaco()`; parâmetro `intervalo_tecnico_min` |
| RN-05 | Não reservar sobre bloqueio | `verificarEspaco()` / `verificarEquipamento()` + `bloqueioModel.buscarConflito()` |
| RN-06 | Público não pode passar da capacidade do espaço | `verificarEspaco()` |
| RN-07 | Horário de funcionamento e antecedência mínima | `validarPeriodo()`; parâmetros `horario_abertura`, `horario_fechamento`, `antecedencia_min_horas`. Pedido fora da regra é **bloqueado** |
| RN-08 | Decisão registra quem decidiu, quando e justificativa (obrigatória na rejeição) | `solicitacaoService.aprovar/rejeitar/devolverParaAjustes()` + `historicoModel.registrar()` |
| RN-09 | Alterar depois de aprovada exige nova verificação e nova análise | `solicitacaoService.atualizar()`: refaz a verificação e volta para **Pendente** |
| RN-10 | Cancelamento libera a agenda e registra quem e por quê | `solicitacaoService.cancelar()`: reservas passam para `cancelada`, motivo obrigatório (exceto rascunho) |

## Equipamentos

| Regra | Descrição | Onde está |
|---|---|---|
| RN-11 | Equipamento com patrimônio/código, categoria, situação e local | tabela `equipamento` (`schema.sql`) e `services/equipamentoService.js` → `validar()` |
| RN-12 | Item individual não pode ter reservas sobrepostas | `disponibilidadeService.verificarEquipamento()` + `reservaModel.ocupacoesEquipamento()` |
| RN-13 | Item por quantidade não pode ficar com saldo negativo | `verificarEquipamento()`: soma o que está reservado no período e compara com `quantidade_total` |
| RN-14 | Manutenção, avariado ou inativo não pode ser reservado | `verificarEquipamento()` (situação diferente de `operacional`) |
| RN-15 | Retirada registra responsável, data/hora e condição | `services/movimentacaoService.js` → `registrarRetirada()` |
| RN-16 | Devolução registra data/hora, quem recebeu, condição; atraso e avaria ficam no histórico | `registrarDevolucao()`: calcula o atraso e grava no histórico; avaria chama `registrarAvaria()` |
| RN-17 | Reserva de equipamento pode ser junto com evento ou só de equipamentos | solicitação sem `espaco_id` é decidida pelo Responsável por Equipamentos (`exigirPodeDecidir()`) |
| RN-18 | Aprovar o evento não aprova todos os recursos | cada recurso tem status próprio; `aprovar()` só aprova o espaço e os equipamentos são aprovados em `aprovarEquipamento()` |

## Regras gerais

| Regra | Onde está |
|---|---|
| Conflito: `inicioA < fimB` **e** `inicioB < fimA` (reservas encostadas não conflitam) | `disponibilidadeService.sobrepoe()` e as consultas de `reservaModel` |
| Disponibilidade não é um campo: é calculada pelas reservas aprovadas/retiradas e bloqueios | `reservaModel.conflitoEspaco()`, `ocupacoesEquipamento()`, `ocupacoesDoDia()` |
| Só reserva **aprovada** (ou equipamento **retirado**) ocupa a agenda. Pendente não bloqueia, mas o envio já é recusado se bater com uma aprovada | `reservaModel` (filtro por status) e `solicitacaoService.enviarNaTransacao()` |
| Equipamento retirado e não devolvido continua ocupado depois do horário | `reservaModel.ocupacoesEquipamento()` (condição `status = 'retirado'`) |
| Verificação refeita na aprovação, dentro de transação `BEGIN IMMEDIATE` | `solicitacaoService.aprovar()` e `aprovarEquipamento()` com `db.transaction(...).immediate()`; `busy_timeout` em `db.js` |
| Transições de status válidas | `TRANSICOES` em `solicitacaoService.js` + `validarTransicao()` |
| Toda mudança de status grava histórico, que não pode ser apagado | `mudarStatus()` + triggers `historico_sem_delete` e `historico_sem_update` no `schema.sql` |
| Devolução com avaria deixa o item indisponível | `movimentacaoService.registrarAvaria()` |
| Solicitante não aprova a própria solicitação (RNF-03) | `exigirPodeDecidir()` e `exigirPodeDecidirEquipamento()` |
| Bloqueio criado sobre reserva aprovada: o bloqueio é criado e os solicitantes são avisados | `services/bloqueioService.js` → `criar()` |

## Máquina de estados da solicitação

| De | Para | Quem | Ação |
|---|---|---|---|
| Rascunho | Pendente | Solicitante | Enviar (verifica disponibilidade e antecedência) |
| Rascunho | Cancelada | Solicitante | Cancelar |
| Pendente | Aprovada | Gestor (ou Resp. Equipamentos, se só tiver equipamento) | Aprovar (verifica de novo, em transação) |
| Pendente | Rejeitada | Gestor | Rejeitar (justificativa obrigatória) |
| Pendente | Em ajustes | Gestor | Devolver (motivo obrigatório) |
| Pendente | Cancelada | Solicitante ou gestor | Cancelar (motivo obrigatório) |
| Em ajustes | Pendente | Solicitante | Corrigir e reenviar |
| Em ajustes | Cancelada | Solicitante ou gestor | Cancelar |
| Aprovada | Pendente | Solicitante | Alterar (nova verificação e nova análise) |
| Aprovada | Cancelada | Solicitante ou gestor | Cancelar (libera a agenda) |
| Aprovada | Concluída | Gestor | Concluir (só depois do término e sem equipamento pendente de devolução) |

Rejeitada, Cancelada e Concluída são estados finais. Qualquer outra transição é recusada com **409**.

## Requisitos funcionais (RF)

| RF | Situação | Onde |
|---|---|---|
| RF-01 Autenticar e aplicar permissões | Feito | `authService`, `middlewares/auth.js` |
| RF-02 Cadastrar/editar espaços | Feito | `espacoService`, tela `espacos.html` |
| RF-03 Cadastrar equipamentos e categorias | Feito | `equipamentoService`, tela `equipamentos.html` |
| RF-04 Calendário por dia, espaço e situação | Feito | `GET /api/disponibilidade`, tela `agenda.html` |
| RF-05 Cadastrar, editar e enviar atividade | Feito | `solicitacaoService.criar/atualizar/enviar`, tela `nova-solicitacao.html` |
| RF-06 Solicitar espaço | Feito | idem |
| RF-07 Solicitar um ou mais equipamentos | Feito | idem |
| RF-08 Validar conflito no servidor | Feito | `disponibilidadeService` |
| RF-09 Aprovar, rejeitar, devolver | Feito | `solicitacaoService`, tela `solicitacao.html` |
| RF-10 Notificações internas | Feito | `notificacaoService`, tela `notificacoes.html` |
| RF-11 Retirada e devolução | Feito | `movimentacaoService`, tela `movimentacoes.html` |
| RF-12 Histórico de alterações e decisões | Feito | `aprovacao_historico` + `auditoria` |
| RF-13 Listagem filtrável | Feito | `GET /api/solicitacoes` (status, data, espaço, equipamento, solicitante) |
| RF-14 Exportar CSV/PDF (opcional) | Não feito | — |
| RF-15 Avisos por e-mail (opcional) | Não feito | — |
| RF-16 Calendário público (opcional) | Feito | `GET /api/agenda`, tela `agenda-publica.html` |

## Requisitos não funcionais (RNF)

| RNF | Como foi atendido |
|---|---|
| RNF-01 Responsivo e uso por teclado | CSS mobile-first, menu recolhível, tabelas viram cartões no celular, foco visível, link "pular para o conteúdo", labels em todos os campos, Esc fecha o menu |
| RNF-02 Validação no front e no back | O front valida o básico; todas as regras são revalidadas na API |
| RNF-03 Autorização no servidor | `permitir(...)` em todas as rotas restritas; teste de 403 em `tests/permissoes.test.js` |
| RNF-04 Senha com hash e proteção contra ataques comuns | bcrypt; consultas parametrizadas (SQL injection); `esc()` no front (XSS); cookie `httpOnly` + `sameSite: strict` |
| RNF-05 Aprovação transacional | `BEGIN IMMEDIATE` (`.immediate()` do better-sqlite3) |
| RNF-06 Data/hora consistente | Formato único `AAAA-MM-DDTHH:MM` em horário local (ver limitações) |
| RNF-07 Dados pessoais mínimos | Só nome e e-mail; agenda pública sem dados pessoais; solicitante só vê as próprias solicitações |
| RNF-08 Mensagens de erro claras | `AppError` com mensagem para o usuário; erros inesperados vão para o console do servidor |
| RNF-09 Legibilidade e contraste | Paleta preto/vermelho/branco com contraste alto, fonte de 16px |

## Limitações conhecidas

- As datas ficam em horário local (fuso único da unidade), e não em UTC. Para uma unidade só, isso simplifica e evita erros de conversão.
- O saldo de itens por quantidade é calculado somando tudo que se sobrepõe ao período pedido. É um cálculo conservador: pode recusar um pedido que caberia se as outras reservas não se sobrepõem entre si.
- O intervalo técnico vale para espaços. Para equipamentos é usada a sobreposição simples.
- Uma solicitação tem um único período para todos os recursos.
- Ao reduzir a quantidade de um item por avaria, reservas futuras já aprovadas não são revistas automaticamente.
- Exportação CSV/PDF e e-mail (opcionais) não foram implementados.
