const movimentacaoService = require('../services/movimentacaoService');

function registrar(req, res) {
  res.status(201).json(movimentacaoService.registrar(req.body, req.usuario));
}

function listar(req, res) {
  res.json(movimentacaoService.listar(req.query));
}

module.exports = { registrar, listar };
