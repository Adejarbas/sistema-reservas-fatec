const { db } = require('../db');

function listar() {
  return db.prepare('SELECT chave, valor, descricao FROM parametro ORDER BY chave').all();
}

function buscar(chave) {
  return db.prepare('SELECT chave, valor, descricao FROM parametro WHERE chave = ?').get(chave);
}

function atualizar(chave, valor) {
  db.prepare('UPDATE parametro SET valor = ? WHERE chave = ?').run(valor, chave);
}

module.exports = { listar, buscar, atualizar };
