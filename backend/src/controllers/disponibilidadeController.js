const disponibilidadeService = require('../services/disponibilidadeService');
const solicitacaoModel = require('../models/solicitacaoModel');
const AppError = require('../utils/AppError');
const { diaValido } = require('../utils/datas');

// Agenda de um dia por recurso (livre / ocupado / bloqueado).
function agendaDoDia(req, res) {
  res.json(disponibilidadeService.agendaDoDia(req.query.data, req.query.tipo));
}

// Pergunta rápida do formulário: "esse recurso está livre nesse horário?"
function verificar(req, res) {
  res.json(disponibilidadeService.consultar(req.query));
}

// Agenda pública: só eventos aprovados, sem dados pessoais (não exige login).
function agendaPublica(req, res) {
  const { de, ate } = req.query;
  if (!diaValido(de) || !diaValido(ate)) {
    throw new AppError('Informe "de" e "ate" no formato AAAA-MM-DD.', 400);
  }
  res.json(solicitacaoModel.agendaPublica(de, ate));
}

module.exports = { agendaDoDia, verificar, agendaPublica };
