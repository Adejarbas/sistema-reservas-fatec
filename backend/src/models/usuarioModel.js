const { db } = require('../db');

const SELECT_USUARIO = `
  SELECT u.id, u.nome, u.email, u.ativo, u.perfil_id, u.criado_em,
         p.nome AS perfil, p.permissoes
  FROM usuario u
  JOIN perfil p ON p.id = u.perfil_id`;

function buscarPorId(id) {
  return db.prepare(`${SELECT_USUARIO} WHERE u.id = ?`).get(id);
}

// Única consulta que devolve o hash da senha (usada só no login).
function buscarParaLogin(email) {
  return db.prepare(`
    SELECT u.id, u.senha_hash, u.ativo
    FROM usuario u
    WHERE u.email = ?`).get(email);
}

function listar({ perfilId, ativo, busca } = {}) {
  const condicoes = [];
  const valores = [];

  if (perfilId) {
    condicoes.push('u.perfil_id = ?');
    valores.push(perfilId);
  }
  if (ativo === '0' || ativo === '1') {
    condicoes.push('u.ativo = ?');
    valores.push(Number(ativo));
  }
  if (busca) {
    condicoes.push('(u.nome LIKE ? OR u.email LIKE ?)');
    valores.push(`%${busca}%`, `%${busca}%`);
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
  return db.prepare(`${SELECT_USUARIO} ${where} ORDER BY u.nome`).all(...valores);
}

function emailEmUso(email, ignorarId = 0) {
  return !!db.prepare('SELECT 1 FROM usuario WHERE email = ? AND id <> ?').get(email, ignorarId);
}

function criar({ nome, email, senhaHash, perfilId }) {
  const resultado = db.prepare(
    'INSERT INTO usuario (nome, email, senha_hash, perfil_id) VALUES (?, ?, ?, ?)'
  ).run(nome, email, senhaHash, perfilId);
  return resultado.lastInsertRowid;
}

function atualizar(id, { nome, email, perfilId, ativo }) {
  db.prepare('UPDATE usuario SET nome = ?, email = ?, perfil_id = ?, ativo = ? WHERE id = ?')
    .run(nome, email, perfilId, ativo, id);
}

function atualizarSenha(id, senhaHash) {
  db.prepare('UPDATE usuario SET senha_hash = ? WHERE id = ?').run(senhaHash, id);
}

module.exports = { buscarPorId, buscarParaLogin, listar, emailEmUso, criar, atualizar, atualizarSenha };
