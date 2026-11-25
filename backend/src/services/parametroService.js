const AppError = require('../utils/AppError');
const parametroModel = require('../models/parametroModel');
const auditoriaModel = require('../models/auditoriaModel');

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

// Regra de validação de cada parâmetro.
const VALIDADORES = {
  intervalo_tecnico_min: (v) => /^\d+$/.test(v) && Number(v) <= 240,
  antecedencia_min_horas: (v) => /^\d+$/.test(v) && Number(v) <= 720,
  horario_abertura: (v) => HORA.test(v),
  horario_fechamento: (v) => HORA.test(v)
};

const MENSAGENS = {
  intervalo_tecnico_min: 'Informe o intervalo técnico em minutos (de 0 a 240).',
  antecedencia_min_horas: 'Informe a antecedência em horas (de 0 a 720).',
  horario_abertura: 'Informe o horário de abertura no formato HH:MM (ex.: 07:00).',
  horario_fechamento: 'Informe o horário de fechamento no formato HH:MM (ex.: 23:00).'
};

function listar() {
  return parametroModel.listar();
}

function atualizar(chave, valor, adminId) {
  const atual = parametroModel.buscar(chave);
  if (!atual) throw new AppError('Parâmetro não encontrado.', 404);

  const texto = String(valor ?? '').trim();
  if (!VALIDADORES[chave](texto)) {
    throw new AppError(MENSAGENS[chave], 400);
  }

  const config = { ...obterConfiguracao(), [chave]: texto };
  if (config.horario_abertura >= config.horario_fechamento) {
    throw new AppError('O horário de abertura deve ser antes do horário de fechamento.', 400);
  }

  parametroModel.atualizar(chave, texto);
  auditoriaModel.registrar(adminId, 'editar', 'parametro', null, `${chave}: ${atual.valor} -> ${texto}`);
  return parametroModel.buscar(chave);
}

function obterConfiguracao() {
  const config = {};
  for (const p of parametroModel.listar()) config[p.chave] = p.valor;
  return config;
}

// Versão já convertida, usada pelas regras de reserva.
function regrasDeReserva() {
  const c = obterConfiguracao();
  return {
    intervaloTecnicoMin: Number(c.intervalo_tecnico_min || 0),
    antecedenciaMinHoras: Number(c.antecedencia_min_horas || 0),
    horarioAbertura: c.horario_abertura || '00:00',
    horarioFechamento: c.horario_fechamento || '23:59'
  };
}

module.exports = { listar, atualizar, regrasDeReserva };
