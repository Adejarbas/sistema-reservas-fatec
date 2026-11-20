const { db } = require('../db');

const SELECT_SOLICITACAO = `
  SELECT s.id, s.status, s.motivo, s.criada_em, s.atualizada_em, s.solicitante_id, s.atividade_id,
         u.nome AS solicitante, u.email AS solicitante_email,
         a.titulo, a.tipo, a.descricao, a.publico_estimado, a.inicio, a.fim, a.status AS status_atividade
  FROM solicitacao s
  JOIN usuario u ON u.id = s.solicitante_id
  JOIN atividade a ON a.id = s.atividade_id`;

function buscarPorId(id) {
  return db.prepare(`${SELECT_SOLICITACAO} WHERE s.id = ?`).get(id);
}

function listar(filtros = {}) {
  const condicoes = [];
  const valores = [];

  if (filtros.solicitanteId) {
    condicoes.push('s.solicitante_id = ?');
    valores.push(filtros.solicitanteId);
  }
  if (filtros.status) {
    condicoes.push('s.status = ?');
    valores.push(filtros.status);
  }
  if (filtros.de) {
    condicoes.push('a.inicio >= ?');
    valores.push(`${filtros.de}T00:00`);
  }
  if (filtros.ate) {
    condicoes.push('a.inicio < ?');
    valores.push(`${filtros.ate}T24:00`);
  }
  if (filtros.espacoId) {
    condicoes.push('EXISTS (SELECT 1 FROM reserva_espaco re WHERE re.solicitacao_id = s.id AND re.espaco_id = ?)');
    valores.push(filtros.espacoId);
  }
  if (filtros.equipamentoId) {
    condicoes.push('EXISTS (SELECT 1 FROM reserva_equipamento rq WHERE rq.solicitacao_id = s.id AND rq.equipamento_id = ?)');
    valores.push(filtros.equipamentoId);
  }
  if (filtros.solicitante) {
    condicoes.push('u.nome LIKE ?');
    valores.push(`%${filtros.solicitante}%`);
  }
  // Fila do gestor não mostra rascunhos de outras pessoas.
  if (filtros.ocultarRascunhosDeOutros) {
    condicoes.push("(s.status <> 'rascunho' OR s.solicitante_id = ?)");
    valores.push(filtros.ocultarRascunhosDeOutros);
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
  return db.prepare(`
    SELECT s.id, s.status, s.criada_em, s.solicitante_id, u.nome AS solicitante,
           a.titulo, a.tipo, a.inicio, a.fim, a.publico_estimado,
           (SELECT GROUP_CONCAT(e.nome, ', ') FROM reserva_espaco re
              JOIN espaco e ON e.id = re.espaco_id WHERE re.solicitacao_id = s.id) AS espacos,
           (SELECT COUNT(*) FROM reserva_equipamento rq WHERE rq.solicitacao_id = s.id) AS total_equipamentos
    FROM solicitacao s
    JOIN usuario u ON u.id = s.solicitante_id
    JOIN atividade a ON a.id = s.atividade_id
    ${where}
    ORDER BY a.inicio DESC, s.id DESC
    LIMIT 300`).all(...valores);
}

function criarAtividade(dados, responsavelId) {
  return db.prepare(`
    INSERT INTO atividade (titulo, tipo, descricao, responsavel_id, publico_estimado, inicio, fim)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    dados.titulo, dados.tipo, dados.descricao, responsavelId, dados.publico_estimado, dados.inicio, dados.fim
  ).lastInsertRowid;
}

function atualizarAtividade(id, dados) {
  db.prepare(`
    UPDATE atividade SET titulo = ?, tipo = ?, descricao = ?, publico_estimado = ?, inicio = ?, fim = ?
    WHERE id = ?`).run(dados.titulo, dados.tipo, dados.descricao, dados.publico_estimado, dados.inicio, dados.fim, id);
}

function atualizarStatusAtividade(id, status) {
  db.prepare('UPDATE atividade SET status = ? WHERE id = ?').run(status, id);
}

function criar(atividadeId, solicitanteId, motivo) {
  return db.prepare('INSERT INTO solicitacao (atividade_id, solicitante_id, motivo) VALUES (?, ?, ?)')
    .run(atividadeId, solicitanteId, motivo).lastInsertRowid;
}

function atualizarMotivo(id, motivo) {
  db.prepare(`UPDATE solicitacao SET motivo = ?, atualizada_em = strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime') WHERE id = ?`)
    .run(motivo, id);
}

function atualizarStatus(id, status) {
  db.prepare(`UPDATE solicitacao SET status = ?, atualizada_em = strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime') WHERE id = ?`)
    .run(status, id);
}

// Agenda pública: só eventos aprovados, sem dados pessoais.
function agendaPublica(de, ate) {
  return db.prepare(`
    SELECT a.titulo, a.tipo, a.inicio, a.fim,
           (SELECT GROUP_CONCAT(e.nome, ', ') FROM reserva_espaco re
              JOIN espaco e ON e.id = re.espaco_id
              WHERE re.solicitacao_id = s.id AND re.status = 'aprovada') AS local
    FROM solicitacao s
    JOIN atividade a ON a.id = s.atividade_id
    WHERE s.status = 'aprovada' AND a.inicio >= ? AND a.inicio < ?
    ORDER BY a.inicio`).all(`${de}T00:00`, `${ate}T24:00`);
}

module.exports = {
  buscarPorId,
  listar,
  criarAtividade,
  atualizarAtividade,
  atualizarStatusAtividade,
  criar,
  atualizarMotivo,
  atualizarStatus,
  agendaPublica
};
