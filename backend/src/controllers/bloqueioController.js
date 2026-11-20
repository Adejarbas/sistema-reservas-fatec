const bloqueioService = require('../services/bloqueioService');
const { idValido } = require('../utils/validacao');

function listar(req, res) {
  const { de, ate, espaco_id, equipamento_id } = req.query;
  res.json(bloqueioService.listar({ de, ate, espacoId: espaco_id, equipamentoId: equipamento_id }));
}

function criar(req, res) {
  res.status(201).json(bloqueioService.criar(req.body, req.usuario));
}

function remover(req, res) {
  bloqueioService.remover(idValido(req.params.id), req.usuario);
  res.status(204).end();
}

module.exports = { listar, criar, remover };
