const { db } = require('../db');

function listar() {
  return db.prepare('SELECT id, nome, permissoes FROM perfil ORDER BY id').all();
}

function buscarPorId(id) {
  return db.prepare('SELECT id, nome, permissoes FROM perfil WHERE id = ?').get(id);
}

function atualizarPermissoes(id, permissoes) {
  db.prepare('UPDATE perfil SET permissoes = ? WHERE id = ?').run(permissoes, id);
}

module.exports = { listar, buscarPorId, atualizarPermissoes };
