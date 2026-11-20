const equipamentoService = require('../services/equipamentoService');
const { idValido } = require('../utils/validacao');

function listar(req, res) {
  const { categoria_id, situacao, busca } = req.query;
  res.json(equipamentoService.listar({ categoriaId: categoria_id, situacao, busca }));
}

function buscar(req, res) {
  res.json(equipamentoService.buscar(idValido(req.params.id)));
}

function criar(req, res) {
  res.status(201).json(equipamentoService.criar(req.body, req.usuario));
}

function atualizar(req, res) {
  res.json(equipamentoService.atualizar(idValido(req.params.id), req.body, req.usuario));
}

function alterarSituacao(req, res) {
  const { situacao, motivo } = req.body;
  res.json(equipamentoService.alterarSituacao(idValido(req.params.id), situacao, motivo, req.usuario));
}

function listarCategorias(req, res) {
  res.json(equipamentoService.listarCategorias());
}

function criarCategoria(req, res) {
  res.status(201).json(equipamentoService.salvarCategoria(null, req.body, req.usuario));
}

function atualizarCategoria(req, res) {
  res.json(equipamentoService.salvarCategoria(idValido(req.params.id), req.body, req.usuario));
}

module.exports = {
  listar,
  buscar,
  criar,
  atualizar,
  alterarSituacao,
  listarCategorias,
  criarCategoria,
  atualizarCategoria
};
