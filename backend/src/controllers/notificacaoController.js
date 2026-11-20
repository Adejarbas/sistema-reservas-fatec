const notificacaoService = require('../services/notificacaoService');
const { idValido } = require('../utils/validacao');

function listar(req, res) {
  res.json(notificacaoService.listar(req.usuario.id, req.query.nao_lidas === '1'));
}

function marcarLida(req, res) {
  notificacaoService.marcarLida(idValido(req.params.id), req.usuario.id);
  res.status(204).end();
}

function marcarTodasLidas(req, res) {
  notificacaoService.marcarTodasLidas(req.usuario.id);
  res.status(204).end();
}

module.exports = { listar, marcarLida, marcarTodasLidas };
