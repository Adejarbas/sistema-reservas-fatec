const { db } = require('../db');
const AppError = require('../utils/AppError');
const { inteiroPositivo, texto } = require('../utils/validacao');
const { agora, descreverPeriodo } = require('../utils/datas');
const reservaModel = require('../models/reservaModel');
const movimentacaoModel = require('../models/movimentacaoModel');
const equipamentoModel = require('../models/equipamentoModel');
const historicoModel = require('../models/historicoModel');
const auditoriaModel = require('../models/auditoriaModel');
const notificacaoService = require('./notificacaoService');
const { avisarReservasFuturas } = require('./equipamentoService');

function minutosEntre(inicio, fim) {
  return Math.round((new Date(fim) - new Date(inicio)) / 60000);
}

// RN-15: retirada registra quem entregou, quando e em que condição.
function registrarRetirada(reserva, dados, usuario) {
  if (reserva.status !== 'aprovada' || reserva.status_solicitacao !== 'aprovada') {
    throw new AppError('Só é possível retirar equipamento aprovado de uma solicitação aprovada.', 409);
  }
  if (reserva.situacao !== 'operacional') {
    throw new AppError(`O equipamento ${reserva.equipamento} não está operacional e não pode ser entregue.`, 409);
  }
  if (dados.condicao !== 'ok') {
    throw new AppError('Equipamento com avaria não deve ser entregue. Registre a avaria no cadastro do equipamento.', 400,
      { campos: ['condicao'] });
  }

  const id = movimentacaoModel.criar({
    reservaId: reserva.id,
    tipo: 'retirada',
    responsavelId: usuario.id,
    condicao: 'ok',
    quantidadeAvariada: 0,
    observacao: texto(dados.observacao) || null
  });
  reservaModel.atualizarStatusEquipamento(reserva.id, 'retirado');
  historicoModel.registrar(reserva.solicitacao_id, usuario.id, 'retirada', null, null,
    `${reserva.equipamento} (${reserva.codigo_patrimonio}) entregue por ${usuario.nome}`);
  return id;
}

// RN-16: devolução registra quem recebeu, quando, a condição e se houve atraso.
function registrarDevolucao(reserva, dados, usuario) {
  if (reserva.status !== 'retirado') {
    throw new AppError('Este equipamento não está retirado, então não há o que devolver.', 409);
  }
  if (!['ok', 'avariado'].includes(dados.condicao)) {
    throw new AppError('Informe a condição do equipamento na devolução (ok ou avariado).', 400, { campos: ['condicao'] });
  }

  let quantidadeAvariada = 0;
  if (dados.condicao === 'avariado') {
    quantidadeAvariada = reserva.tipo_controle === 'individual' ? 1 : Number(dados.quantidade_avariada || reserva.quantidade);
    if (!inteiroPositivo(quantidadeAvariada) || quantidadeAvariada > reserva.quantidade) {
      throw new AppError(`A quantidade avariada deve ser entre 1 e ${reserva.quantidade}.`, 400, { campos: ['quantidade_avariada'] });
    }
  }

  const momento = agora();
  const atraso = momento > reserva.fim ? minutosEntre(reserva.fim, momento) : 0;
  const observacoes = [texto(dados.observacao)];
  if (atraso > 0) observacoes.push(`Devolvido com ${atraso} min de atraso.`);
  const observacao = observacoes.filter(Boolean).join(' ') || null;

  const id = movimentacaoModel.criar({
    reservaId: reserva.id,
    tipo: 'devolucao',
    responsavelId: usuario.id,
    condicao: dados.condicao,
    quantidadeAvariada,
    observacao
  });
  reservaModel.atualizarStatusEquipamento(reserva.id, 'devolvido');

  let resumo = `${reserva.equipamento} (${reserva.codigo_patrimonio}) devolvido a ${usuario.nome}, condição: ${dados.condicao}`;
  if (atraso > 0) resumo += `, ${atraso} min de atraso`;
  historicoModel.registrar(reserva.solicitacao_id, usuario.id, 'devolucao', null, null, resumo);

  if (dados.condicao === 'avariado') registrarAvaria(reserva, quantidadeAvariada, observacao, usuario);
  return id;
}

// Devolução com avaria deixa o equipamento indisponível (CA-11).
// Item por quantidade perde só as unidades avariadas.
function registrarAvaria(reserva, quantidadeAvariada, observacao, usuario) {
  const equipamento = equipamentoModel.buscarPorId(reserva.equipamento_id);

  if (equipamento.tipo_controle === 'individual') {
    equipamentoModel.atualizarSituacao(equipamento.id, 'avariado');
  } else {
    const restante = equipamento.quantidade_total - quantidadeAvariada;
    equipamentoModel.atualizarQuantidade(equipamento.id, Math.max(restante, 0));
    if (restante <= 0) equipamentoModel.atualizarSituacao(equipamento.id, 'avariado');
  }

  auditoriaModel.registrar(usuario.id, 'avaria', 'equipamento', equipamento.id,
    `${equipamento.codigo_patrimonio}: ${quantidadeAvariada} unidade(s) avariada(s) na devolução da reserva ${reserva.id}. ${observacao || ''}`.trim());

  if (equipamento.tipo_controle === 'individual') {
    avisarReservasFuturas(equipamento, 'avariado');
  }
  notificacaoService.notificarPorPermissao('gerenciar_equipamentos',
    `O equipamento ${equipamento.nome} (${equipamento.codigo_patrimonio}) foi devolvido com avaria.`,
    'equipamentos.html', usuario.id);
}

function registrar(dados, usuario) {
  if (!inteiroPositivo(dados.reserva_equipamento_id)) {
    throw new AppError('Informe a reserva de equipamento.', 400, { campos: ['reserva_equipamento_id'] });
  }
  if (!['retirada', 'devolucao'].includes(dados.tipo)) {
    throw new AppError('O tipo deve ser "retirada" ou "devolucao".', 400, { campos: ['tipo'] });
  }

  const id = db.transaction(() => {
    const reserva = reservaModel.buscarReservaEquipamento(Number(dados.reserva_equipamento_id));
    if (!reserva) throw new AppError('Reserva de equipamento não encontrada.', 404);

    const movimentacaoId = dados.tipo === 'retirada'
      ? registrarRetirada(reserva, dados, usuario)
      : registrarDevolucao(reserva, dados, usuario);

    const acao = dados.tipo === 'retirada' ? 'retirado' : 'devolvido';
    notificacaoService.notificar(reserva.solicitante_id,
      `O equipamento ${reserva.equipamento} da sua solicitação #${reserva.solicitacao_id} foi ${acao} ` +
      `(reserva ${descreverPeriodo(reserva.inicio, reserva.fim)}).`,
      `solicitacao.html?id=${reserva.solicitacao_id}`);
    return movimentacaoId;
  }).immediate();

  return movimentacaoModel.buscarPorId(id);
}

function listar(query) {
  return movimentacaoModel.listar({
    equipamentoId: query.equipamento_id,
    tipo: query.tipo,
    condicao: query.condicao
  });
}

module.exports = { registrar, listar };
