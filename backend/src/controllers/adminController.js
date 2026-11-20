const perfilService = require('../services/perfilService');
const parametroService = require('../services/parametroService');
const auditoriaModel = require('../models/auditoriaModel');
const { PERMISSOES } = require('../utils/permissoes');
const { idValido } = require('../utils/validacao');

function listarPerfis(req, res) {
  res.json({ perfis: perfilService.listar(), permissoesDisponiveis: PERMISSOES });
}

function atualizarPerfil(req, res) {
  res.json(perfilService.atualizarPermissoes(idValido(req.params.id), req.body.permissoes, req.usuario.id));
}

function listarParametros(req, res) {
  res.json(parametroService.listar());
}

function atualizarParametro(req, res) {
  res.json(parametroService.atualizar(req.params.chave, req.body.valor, req.usuario.id));
}

function listarAuditoria(req, res) {
  const { entidade, usuario_id, de, ate } = req.query;
  res.json(auditoriaModel.listar({ entidade, usuarioId: usuario_id, de, ate }));
}

module.exports = { listarPerfis, atualizarPerfil, listarParametros, atualizarParametro, listarAuditoria };
