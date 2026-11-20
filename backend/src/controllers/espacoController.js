const espacoService = require('../services/espacoService');
const { idValido } = require('../utils/validacao');

function listar(req, res) {
  const { ativo, busca } = req.query;
  res.json(espacoService.listar({ ativo, busca }));
}

function buscar(req, res) {
  res.json(espacoService.buscar(idValido(req.params.id)));
}

function criar(req, res) {
  res.status(201).json(espacoService.criar(req.body, req.usuario));
}

function atualizar(req, res) {
  res.json(espacoService.atualizar(idValido(req.params.id), req.body, req.usuario));
}

module.exports = { listar, buscar, criar, atualizar };
