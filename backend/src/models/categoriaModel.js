const { db } = require('../db');

function listar() {
  return db.prepare(`
    SELECT c.id, c.nome, COUNT(e.id) AS total_equipamentos
    FROM categoria c
    LEFT JOIN equipamento e ON e.categoria_id = c.id
    GROUP BY c.id
    ORDER BY c.nome`).all();
}

function buscarPorId(id) {
  return db.prepare('SELECT * FROM categoria WHERE id = ?').get(id);
}

function nomeEmUso(nome, ignorarId = 0) {
  return !!db.prepare('SELECT 1 FROM categoria WHERE nome = ? AND id <> ?').get(nome, ignorarId);
}

function criar(nome) {
  return db.prepare('INSERT INTO categoria (nome) VALUES (?)').run(nome).lastInsertRowid;
}

function atualizar(id, nome) {
  db.prepare('UPDATE categoria SET nome = ? WHERE id = ?').run(nome, id);
}

module.exports = { listar, buscarPorId, nomeEmUso, criar, atualizar };
