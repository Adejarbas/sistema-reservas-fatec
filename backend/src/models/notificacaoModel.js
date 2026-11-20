const { db } = require('../db');

function criar(usuarioId, mensagem, link = null) {
  db.prepare('INSERT INTO notificacao (usuario_id, mensagem, link) VALUES (?, ?, ?)').run(usuarioId, mensagem, link);
}

function listar(usuarioId, apenasNaoLidas = false) {
  const filtro = apenasNaoLidas ? 'AND lida = 0' : '';
  return db.prepare(`
    SELECT * FROM notificacao
    WHERE usuario_id = ? ${filtro}
    ORDER BY criada_em DESC, id DESC
    LIMIT 50`).all(usuarioId);
}

function contarNaoLidas(usuarioId) {
  return db.prepare('SELECT COUNT(*) AS total FROM notificacao WHERE usuario_id = ? AND lida = 0').get(usuarioId).total;
}

function marcarLida(id, usuarioId) {
  return db.prepare('UPDATE notificacao SET lida = 1 WHERE id = ? AND usuario_id = ?').run(id, usuarioId).changes;
}

function marcarTodasLidas(usuarioId) {
  db.prepare('UPDATE notificacao SET lida = 1 WHERE usuario_id = ?').run(usuarioId);
}

// Usuários ativos cujo perfil tem a permissão (permissões ficam separadas por vírgula).
function usuariosComPermissao(permissao) {
  return db.prepare(`
    SELECT u.id FROM usuario u
    JOIN perfil p ON p.id = u.perfil_id
    WHERE u.ativo = 1 AND (',' || p.permissoes || ',') LIKE ?`).all(`%,${permissao},%`).map((u) => u.id);
}

module.exports = { criar, listar, contarNaoLidas, marcarLida, marcarTodasLidas, usuariosComPermissao };
