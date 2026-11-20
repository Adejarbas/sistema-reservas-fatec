const solicitacaoService = require('../services/solicitacaoService');
const { idValido } = require('../utils/validacao');

function listar(req, res) {
  res.json(solicitacaoService.listar(req.query, req.usuario));
}

function detalhar(req, res) {
  res.json(solicitacaoService.detalhar(idValido(req.params.id), req.usuario));
}

function criar(req, res) {
  res.status(201).json(solicitacaoService.criar(req.body, req.usuario));
}

function atualizar(req, res) {
  res.json(solicitacaoService.atualizar(idValido(req.params.id), req.body, req.usuario));
}

function enviar(req, res) {
  res.json(solicitacaoService.enviar(idValido(req.params.id), req.usuario));
}

function cancelar(req, res) {
  res.json(solicitacaoService.cancelar(idValido(req.params.id), req.usuario, req.body.motivo));
}

function aprovar(req, res) {
  res.json(solicitacaoService.aprovar(idValido(req.params.id), req.usuario, req.body.justificativa));
}

function rejeitar(req, res) {
  res.json(solicitacaoService.rejeitar(idValido(req.params.id), req.usuario, req.body.justificativa));
}

function devolver(req, res) {
  res.json(solicitacaoService.devolverParaAjustes(idValido(req.params.id), req.usuario, req.body.justificativa));
}

function concluir(req, res) {
  res.json(solicitacaoService.concluir(idValido(req.params.id), req.usuario));
}

function listarReservasEquipamento(req, res) {
  res.json(solicitacaoService.listarReservasEquipamento(req.query));
}

function aprovarEquipamento(req, res) {
  res.json(solicitacaoService.aprovarEquipamento(idValido(req.params.id), req.usuario));
}

function rejeitarEquipamento(req, res) {
  res.json(solicitacaoService.rejeitarEquipamento(idValido(req.params.id), req.usuario, req.body.justificativa));
}

module.exports = {
  listar,
  detalhar,
  criar,
  atualizar,
  enviar,
  cancelar,
  aprovar,
  rejeitar,
  devolver,
  concluir,
  listarReservasEquipamento,
  aprovarEquipamento,
  rejeitarEquipamento
};
