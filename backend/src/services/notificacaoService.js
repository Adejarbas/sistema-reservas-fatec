const AppError = require('../utils/AppError');
const notificacaoModel = require('../models/notificacaoModel');

function notificar(usuarioId, mensagem, link) {
  notificacaoModel.criar(usuarioId, mensagem, link);
}

// Avisa todo mundo que tem alguma das permissões (ex.: todos os gestores), menos quem fez a ação.
// O Set evita mandar a mesma notificação duas vezes para quem tem as duas permissões.
function notificarPorPermissao(permissoes, mensagem, link, excetoId = 0) {
  const destinatarios = new Set();
  for (const permissao of [].concat(permissoes)) {
    for (const id of notificacaoModel.usuariosComPermissao(permissao)) destinatarios.add(id);
  }
  destinatarios.delete(excetoId);
  for (const id of destinatarios) notificacaoModel.criar(id, mensagem, link);
}

function listar(usuarioId, apenasNaoLidas) {
  return {
    naoLidas: notificacaoModel.contarNaoLidas(usuarioId),
    notificacoes: notificacaoModel.listar(usuarioId, apenasNaoLidas)
  };
}

function marcarLida(id, usuarioId) {
  // O WHERE usuario_id garante que ninguém marca a notificação de outra pessoa.
  if (notificacaoModel.marcarLida(id, usuarioId) === 0) {
    throw new AppError('Notificação não encontrada.', 404);
  }
}

function marcarTodasLidas(usuarioId) {
  notificacaoModel.marcarTodasLidas(usuarioId);
}

module.exports = { notificar, notificarPorPermissao, listar, marcarLida, marcarTodasLidas };
