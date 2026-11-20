const { db } = require('../db');

const SELECT_MOVIMENTACAO = `
  SELECT m.*, u.nome AS responsavel, eq.nome AS equipamento, eq.codigo_patrimonio, rq.solicitacao_id
  FROM movimentacao m
  JOIN usuario u ON u.id = m.responsavel_id
  JOIN reserva_equipamento rq ON rq.id = m.reserva_equipamento_id
  JOIN equipamento eq ON eq.id = rq.equipamento_id`;

function criar({ reservaId, tipo, responsavelId, condicao, quantidadeAvariada, observacao }) {
  return db.prepare(`
    INSERT INTO movimentacao (reserva_equipamento_id, tipo, responsavel_id, condicao, quantidade_avariada, observacao)
    VALUES (?, ?, ?, ?, ?, ?)`).run(reservaId, tipo, responsavelId, condicao, quantidadeAvariada, observacao).lastInsertRowid;
}

function buscarPorId(id) {
  return db.prepare(`${SELECT_MOVIMENTACAO} WHERE m.id = ?`).get(id);
}

function listarDaSolicitacao(solicitacaoId) {
  return db.prepare(`${SELECT_MOVIMENTACAO} WHERE rq.solicitacao_id = ? ORDER BY m.data_hora, m.id`).all(solicitacaoId);
}

function listar({ equipamentoId, tipo, condicao } = {}) {
  const condicoes = [];
  const valores = [];

  if (equipamentoId) {
    condicoes.push('rq.equipamento_id = ?');
    valores.push(equipamentoId);
  }
  if (tipo) {
    condicoes.push('m.tipo = ?');
    valores.push(tipo);
  }
  if (condicao) {
    condicoes.push('m.condicao = ?');
    valores.push(condicao);
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
  return db.prepare(`${SELECT_MOVIMENTACAO} ${where} ORDER BY m.data_hora DESC, m.id DESC LIMIT 200`).all(...valores);
}

module.exports = { criar, buscarPorId, listarDaSolicitacao, listar };
