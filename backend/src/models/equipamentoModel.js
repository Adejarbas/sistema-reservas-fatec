const { db } = require('../db');

const SELECT_EQUIPAMENTO = `
  SELECT e.*, c.nome AS categoria
  FROM equipamento e
  JOIN categoria c ON c.id = e.categoria_id`;

function listar({ categoriaId, situacao, busca } = {}) {
  const condicoes = [];
  const valores = [];

  if (categoriaId) {
    condicoes.push('e.categoria_id = ?');
    valores.push(categoriaId);
  }
  if (situacao) {
    condicoes.push('e.situacao = ?');
    valores.push(situacao);
  }
  if (busca) {
    condicoes.push('(e.nome LIKE ? OR e.codigo_patrimonio LIKE ?)');
    valores.push(`%${busca}%`, `%${busca}%`);
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
  return db.prepare(`${SELECT_EQUIPAMENTO} ${where} ORDER BY c.nome, e.nome, e.codigo_patrimonio`).all(...valores);
}

function buscarPorId(id) {
  return db.prepare(`${SELECT_EQUIPAMENTO} WHERE e.id = ?`).get(id);
}

function codigoEmUso(codigo, ignorarId = 0) {
  return !!db.prepare('SELECT 1 FROM equipamento WHERE codigo_patrimonio = ? AND id <> ?').get(codigo, ignorarId);
}

function criar(dados) {
  return db.prepare(`
    INSERT INTO equipamento (codigo_patrimonio, nome, categoria_id, tipo_controle, quantidade_total, situacao, localizacao)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    dados.codigo_patrimonio, dados.nome, dados.categoria_id, dados.tipo_controle,
    dados.quantidade_total, dados.situacao, dados.localizacao
  ).lastInsertRowid;
}

function atualizar(id, dados) {
  db.prepare(`
    UPDATE equipamento
    SET codigo_patrimonio = ?, nome = ?, categoria_id = ?, tipo_controle = ?,
        quantidade_total = ?, situacao = ?, localizacao = ?
    WHERE id = ?`).run(
    dados.codigo_patrimonio, dados.nome, dados.categoria_id, dados.tipo_controle,
    dados.quantidade_total, dados.situacao, dados.localizacao, id
  );
}

function atualizarSituacao(id, situacao) {
  db.prepare('UPDATE equipamento SET situacao = ? WHERE id = ?').run(situacao, id);
}

function atualizarQuantidade(id, quantidade) {
  db.prepare('UPDATE equipamento SET quantidade_total = ? WHERE id = ?').run(quantidade, id);
}

module.exports = { listar, buscarPorId, codigoEmUso, criar, atualizar, atualizarSituacao, atualizarQuantidade };
