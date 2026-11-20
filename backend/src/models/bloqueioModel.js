const { db } = require('../db');

const SELECT_BLOQUEIO = `
  SELECT b.*, es.nome AS espaco, eq.nome AS equipamento, eq.codigo_patrimonio, u.nome AS criado_por_nome
  FROM bloqueio_recurso b
  LEFT JOIN espaco es ON es.id = b.espaco_id
  LEFT JOIN equipamento eq ON eq.id = b.equipamento_id
  JOIN usuario u ON u.id = b.criado_por`;

function listar({ de, ate, espacoId, equipamentoId } = {}) {
  const condicoes = [];
  const valores = [];

  if (de) {
    condicoes.push('b.fim > ?');
    valores.push(`${de}T00:00`);
  }
  if (ate) {
    condicoes.push('b.inicio < ?');
    valores.push(`${ate}T24:00`);
  }
  if (espacoId) {
    condicoes.push('b.espaco_id = ?');
    valores.push(espacoId);
  }
  if (equipamentoId) {
    condicoes.push('b.equipamento_id = ?');
    valores.push(equipamentoId);
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
  return db.prepare(`${SELECT_BLOQUEIO} ${where} ORDER BY b.inicio`).all(...valores);
}

function buscarPorId(id) {
  return db.prepare(`${SELECT_BLOQUEIO} WHERE b.id = ?`).get(id);
}

function criar({ espacoId, equipamentoId, inicio, fim, motivo, criadoPor }) {
  return db.prepare(`
    INSERT INTO bloqueio_recurso (espaco_id, equipamento_id, inicio, fim, motivo, criado_por)
    VALUES (?, ?, ?, ?, ?, ?)`).run(espacoId, equipamentoId, inicio, fim, motivo, criadoPor).lastInsertRowid;
}

function remover(id) {
  db.prepare('DELETE FROM bloqueio_recurso WHERE id = ?').run(id);
}

// Primeiro bloqueio que se sobrepõe ao período (mesma regra de conflito das reservas).
function buscarConflito(coluna, recursoId, inicio, fim) {
  return db.prepare(`
    SELECT * FROM bloqueio_recurso
    WHERE ${coluna} = ? AND inicio < ? AND ? < fim
    ORDER BY inicio LIMIT 1`).get(recursoId, fim, inicio);
}

module.exports = { listar, buscarPorId, criar, remover, buscarConflito };
