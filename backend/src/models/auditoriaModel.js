const { db } = require('../db');

function registrar(usuarioId, acao, entidade, entidadeId = null, detalhes = null) {
  db.prepare(
    'INSERT INTO auditoria (usuario_id, acao, entidade, entidade_id, detalhes) VALUES (?, ?, ?, ?, ?)'
  ).run(usuarioId, acao, entidade, entidadeId, detalhes);
}

function listar({ entidade, usuarioId, de, ate } = {}) {
  const condicoes = [];
  const valores = [];

  if (entidade) {
    condicoes.push('a.entidade = ?');
    valores.push(entidade);
  }
  if (usuarioId) {
    condicoes.push('a.usuario_id = ?');
    valores.push(usuarioId);
  }
  if (de) {
    condicoes.push('a.data_hora >= ?');
    valores.push(de);
  }
  if (ate) {
    condicoes.push('a.data_hora <= ?');
    valores.push(`${ate}T23:59:59`);
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
  return db.prepare(`
    SELECT a.*, u.nome AS usuario
    FROM auditoria a
    LEFT JOIN usuario u ON u.id = a.usuario_id
    ${where}
    ORDER BY a.data_hora DESC, a.id DESC
    LIMIT 200`).all(...valores);
}

module.exports = { registrar, listar };
