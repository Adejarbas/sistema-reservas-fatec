-- Criação das tabelas do sistema de reservas.
-- Datas e horários ficam no formato 'AAAA-MM-DDTHH:MM' (horário local),
-- o mesmo do <input type="datetime-local">. Nesse formato a comparação
-- de texto respeita a ordem cronológica.

PRAGMA foreign_keys = ON;

-- Apaga as tabelas antigas (filhas antes das mães) para recriar o banco do zero.
DROP TABLE IF EXISTS auditoria;
DROP TABLE IF EXISTS notificacao;
DROP TABLE IF EXISTS bloqueio_recurso;
DROP TABLE IF EXISTS aprovacao_historico;
DROP TABLE IF EXISTS movimentacao;
DROP TABLE IF EXISTS reserva_equipamento;
DROP TABLE IF EXISTS reserva_espaco;
DROP TABLE IF EXISTS solicitacao;
DROP TABLE IF EXISTS atividade;
DROP TABLE IF EXISTS equipamento;
DROP TABLE IF EXISTS categoria;
DROP TABLE IF EXISTS espaco;
DROP TABLE IF EXISTS parametro;
DROP TABLE IF EXISTS usuario;
DROP TABLE IF EXISTS perfil;

CREATE TABLE perfil (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nome        TEXT NOT NULL UNIQUE,
  -- lista separada por vírgula, ex.: 'solicitar,decidir_espaco'
  permissoes  TEXT NOT NULL DEFAULT ''
);

CREATE TABLE usuario (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nome        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  senha_hash  TEXT NOT NULL,
  perfil_id   INTEGER NOT NULL REFERENCES perfil(id),
  ativo       INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  criado_em   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'))
);

CREATE TABLE parametro (
  chave      TEXT PRIMARY KEY,
  valor      TEXT NOT NULL,
  descricao  TEXT
);

CREATE TABLE espaco (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  nome         TEXT NOT NULL UNIQUE,
  localizacao  TEXT,
  capacidade   INTEGER NOT NULL CHECK (capacidade > 0),
  ativo        INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1))
);

CREATE TABLE categoria (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  nome  TEXT NOT NULL UNIQUE
);

-- A disponibilidade NÃO fica guardada aqui: ela depende do período e é
-- calculada a partir das reservas e bloqueios. "situacao" é só o estado físico.
CREATE TABLE equipamento (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo_patrimonio  TEXT NOT NULL UNIQUE,
  nome               TEXT NOT NULL,
  categoria_id       INTEGER NOT NULL REFERENCES categoria(id),
  -- individual: um item com patrimônio próprio; quantidade: itens iguais em estoque (ex.: cabos)
  tipo_controle      TEXT NOT NULL DEFAULT 'individual' CHECK (tipo_controle IN ('individual', 'quantidade')),
  quantidade_total   INTEGER NOT NULL DEFAULT 1 CHECK (quantidade_total >= 0),
  situacao           TEXT NOT NULL DEFAULT 'operacional'
                     CHECK (situacao IN ('operacional', 'manutencao', 'avariado', 'inativo')),
  localizacao        TEXT,
  CHECK (tipo_controle = 'quantidade' OR quantidade_total = 1)
);

CREATE TABLE atividade (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo            TEXT NOT NULL,
  tipo              TEXT NOT NULL CHECK (tipo IN ('palestra', 'oficina', 'minicurso', 'seminario',
                                                  'reuniao', 'cultural', 'extensao', 'outro')),
  descricao         TEXT NOT NULL,
  responsavel_id    INTEGER NOT NULL REFERENCES usuario(id),
  publico_estimado  INTEGER NOT NULL CHECK (publico_estimado > 0),
  status            TEXT NOT NULL DEFAULT 'planejada'
                    CHECK (status IN ('planejada', 'confirmada', 'cancelada', 'concluida')),
  inicio            TEXT NOT NULL,
  fim               TEXT NOT NULL,
  CHECK (inicio < fim)
);

CREATE TABLE solicitacao (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  atividade_id    INTEGER REFERENCES atividade(id),
  solicitante_id  INTEGER NOT NULL REFERENCES usuario(id),
  status          TEXT NOT NULL DEFAULT 'rascunho'
                  CHECK (status IN ('rascunho', 'pendente', 'em_ajustes', 'aprovada',
                                    'rejeitada', 'cancelada', 'concluida')),
  motivo          TEXT,
  criada_em       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime')),
  atualizada_em   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'))
);

-- Cada recurso pedido tem seu próprio status (aprovar o evento não aprova tudo).
CREATE TABLE reserva_espaco (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  solicitacao_id  INTEGER NOT NULL REFERENCES solicitacao(id),
  espaco_id       INTEGER NOT NULL REFERENCES espaco(id),
  inicio          TEXT NOT NULL,
  fim             TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente', 'aprovada', 'rejeitada', 'cancelada', 'concluida')),
  justificativa   TEXT,
  CHECK (inicio < fim)
);

CREATE TABLE reserva_equipamento (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  solicitacao_id  INTEGER NOT NULL REFERENCES solicitacao(id),
  equipamento_id  INTEGER NOT NULL REFERENCES equipamento(id),
  inicio          TEXT NOT NULL,
  fim             TEXT NOT NULL,
  quantidade      INTEGER NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  status          TEXT NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente', 'aprovada', 'rejeitada', 'cancelada', 'retirado', 'devolvido')),
  justificativa   TEXT,
  CHECK (inicio < fim)
);

-- responsavel_id: quem entregou (retirada) ou quem recebeu (devolução).
CREATE TABLE movimentacao (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  reserva_equipamento_id  INTEGER NOT NULL REFERENCES reserva_equipamento(id),
  tipo                    TEXT NOT NULL CHECK (tipo IN ('retirada', 'devolucao')),
  responsavel_id          INTEGER NOT NULL REFERENCES usuario(id),
  data_hora               TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime')),
  condicao                TEXT NOT NULL CHECK (condicao IN ('ok', 'avariado')),
  quantidade_avariada     INTEGER NOT NULL DEFAULT 0 CHECK (quantidade_avariada >= 0),
  observacao              TEXT,
  -- uma reserva tem no máximo uma retirada e uma devolução
  UNIQUE (reserva_equipamento_id, tipo)
);

CREATE TABLE aprovacao_historico (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  solicitacao_id   INTEGER NOT NULL REFERENCES solicitacao(id),
  ator_id          INTEGER NOT NULL REFERENCES usuario(id),
  acao             TEXT NOT NULL,
  status_anterior  TEXT,
  status_novo      TEXT,
  justificativa    TEXT,
  data_hora        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'))
);

-- O histórico não pode ser apagado nem alterado.
CREATE TRIGGER historico_sem_delete BEFORE DELETE ON aprovacao_historico
BEGIN
  SELECT RAISE(ABORT, 'O histórico não pode ser apagado.');
END;

CREATE TRIGGER historico_sem_update BEFORE UPDATE ON aprovacao_historico
BEGIN
  SELECT RAISE(ABORT, 'O histórico não pode ser alterado.');
END;

-- Usei uma coluna para cada tipo de recurso (em vez de tipo_recurso + recurso_id)
-- para poder ter chave estrangeira. O CHECK garante que só uma delas é preenchida.
CREATE TABLE bloqueio_recurso (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  espaco_id       INTEGER REFERENCES espaco(id),
  equipamento_id  INTEGER REFERENCES equipamento(id),
  inicio          TEXT NOT NULL,
  fim             TEXT NOT NULL,
  motivo          TEXT NOT NULL,
  criado_por      INTEGER NOT NULL REFERENCES usuario(id),
  criado_em       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime')),
  CHECK (inicio < fim),
  CHECK ((espaco_id IS NULL) <> (equipamento_id IS NULL))
);

CREATE TABLE notificacao (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id  INTEGER NOT NULL REFERENCES usuario(id),
  mensagem    TEXT NOT NULL,
  link        TEXT,
  lida        INTEGER NOT NULL DEFAULT 0 CHECK (lida IN (0, 1)),
  criada_em   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'))
);

-- Registro de ações administrativas (cadastros, alterações de usuário, parâmetros etc.)
CREATE TABLE auditoria (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id  INTEGER REFERENCES usuario(id),
  acao        TEXT NOT NULL,
  entidade    TEXT NOT NULL,
  entidade_id INTEGER,
  detalhes    TEXT,
  data_hora   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'))
);

CREATE INDEX idx_reserva_espaco_periodo ON reserva_espaco (espaco_id, inicio, fim);
CREATE INDEX idx_reserva_equip_periodo ON reserva_equipamento (equipamento_id, inicio, fim);
CREATE INDEX idx_solicitacao_status ON solicitacao (status);
CREATE INDEX idx_notificacao_usuario ON notificacao (usuario_id, lida);
