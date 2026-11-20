const usuarioService = require('../services/usuarioService');
const { idValido } = require('../utils/validacao');

function listar(req, res) {
  const { perfil_id, ativo, busca } = req.query;
  res.json(usuarioService.listar({ perfilId: perfil_id, ativo, busca }));
}

function buscar(req, res) {
  res.json(usuarioService.buscar(idValido(req.params.id)));
}

function criar(req, res) {
  res.status(201).json(usuarioService.criar(req.body, req.usuario.id));
}

function atualizar(req, res) {
  res.json(usuarioService.atualizar(idValido(req.params.id), req.body, req.usuario.id));
}

module.exports = { listar, buscar, criar, atualizar };
