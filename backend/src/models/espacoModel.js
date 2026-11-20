const { db } = require('../db');

function listar({ ativo, busca } = {}) {
  const condicoes = [];
  const valores = [];

  if (ativo === '0' || ativo === '1') {
    condicoes.push('ativo = ?');
    valores.push(Number(ativo));
  }
  if (busca) {
    condicoes.push('(nome LIKE ? OR localizacao LIKE ?)');
    valores.push(`%${busca}%`, `%${busca}%`);
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
  return db.prepare(`SELECT * FROM espaco ${where} ORDER BY nome`).all(...valores);
}

function buscarPorId(id) {
  return db.prepare('SELECT * FROM espaco WHERE id = ?').get(id);
}

function nomeEmUso(nome, ignorarId = 0) {
  return !!db.prepare('SELECT 1 FROM espaco WHERE nome = ? AND id <> ?').get(nome, ignorarId);
}

function criar({ nome, localizacao, capacidade }) {
  return db.prepare('INSERT INTO espaco (nome, localizacao, capacidade) VALUES (?, ?, ?)')
    .run(nome, localizacao, capacidade).lastInsertRowid;
}

function atualizar(id, { nome, localizacao, capacidade, ativo }) {
  db.prepare('UPDATE espaco SET nome = ?, localizacao = ?, capacidade = ?, ativo = ? WHERE id = ?')
    .run(nome, localizacao, capacidade, ativo, id);
}

module.exports = { listar, buscarPorId, nomeEmUso, criar, atualizar };
