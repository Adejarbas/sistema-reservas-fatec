const { db } = require('../db');

// Só existe INSERT e SELECT: o histórico nunca é alterado (o banco também impede com triggers).
function registrar(solicitacaoId, atorId, acao, statusAnterior, statusNovo, justificativa = null) {
  db.prepare(`
    INSERT INTO aprovacao_historico (solicitacao_id, ator_id, acao, status_anterior, status_novo, justificativa)
    VALUES (?, ?, ?, ?, ?, ?)`).run(solicitacaoId, atorId, acao, statusAnterior, statusNovo, justificativa);
}

function listarDaSolicitacao(solicitacaoId) {
  return db.prepare(`
    SELECT h.*, u.nome AS ator
    FROM aprovacao_historico h
    JOIN usuario u ON u.id = h.ator_id
    WHERE h.solicitacao_id = ?
    ORDER BY h.data_hora, h.id`).all(solicitacaoId);
}

module.exports = { registrar, listarDaSolicitacao };
