const AppError = require('../utils/AppError');
const { inteiroPositivo } = require('../utils/validacao');
const { dataValida, diaValido, somarMinutos, agora, hora, descreverPeriodo } = require('../utils/datas');
const espacoModel = require('../models/espacoModel');
const equipamentoModel = require('../models/equipamentoModel');
const bloqueioModel = require('../models/bloqueioModel');
const reservaModel = require('../models/reservaModel');
const parametroService = require('./parametroService');
const { SITUACOES } = require('./equipamentoService');

// Regra de conflito: os intervalos [inicioA, fimA) e [inicioB, fimB) se sobrepõem
// quando inicioA < fimB e inicioB < fimA. Reservas "encostadas" (uma termina às 16h
// e a outra começa às 16h) não conflitam. As consultas SQL usam a mesma regra.
function sobrepoe(inicioA, fimA, inicioB, fimB) {
  return inicioA < fimB && inicioB < fimA;
}

// RN-03 e RN-07: formato, duração positiva, mesmo dia, horário de funcionamento e antecedência.
function validarPeriodo(inicio, fim, { exigirAntecedencia = false } = {}) {
  if (!dataValida(inicio) || !dataValida(fim)) {
    throw new AppError('Informe data e horário de início e fim válidos.', 400, { campos: ['inicio', 'fim'] });
  }
  if (inicio >= fim) {
    throw new AppError('O horário final deve ser posterior ao inicial.', 400, { campos: ['fim'] });
  }
  if (inicio.slice(0, 10) !== fim.slice(0, 10)) {
    throw new AppError('A reserva deve começar e terminar no mesmo dia.', 400, { campos: ['fim'] });
  }

  const regras = parametroService.regrasDeReserva();
  if (hora(inicio) < regras.horarioAbertura || hora(fim) > regras.horarioFechamento) {
    throw new AppError(
      `Fora do horário de funcionamento (${regras.horarioAbertura} às ${regras.horarioFechamento}).`,
      400, { campos: ['inicio', 'fim'] });
  }
  if (exigirAntecedencia && inicio < somarMinutos(agora(), regras.antecedenciaMinHoras * 60)) {
    throw new AppError(
      `As solicitações devem ser enviadas com pelo menos ${regras.antecedenciaMinHoras} horas de antecedência.`,
      400, { campos: ['inicio'] });
  }
}

// RN-04, RN-05 e RN-06. Lança erro com a mensagem do motivo se não puder reservar.
function verificarEspaco(espacoId, inicio, fim, publico, ignorarSolicitacaoId = 0) {
  const espaco = inteiroPositivo(espacoId) && espacoModel.buscarPorId(espacoId);
  if (!espaco) throw new AppError('Espaço não encontrado.', 404);
  if (!espaco.ativo) throw new AppError(`O espaço ${espaco.nome} está inativo e não pode ser reservado.`, 409);

  if (publico && Number(publico) > espaco.capacidade) {
    throw new AppError(
      `O público estimado (${publico} pessoas) é maior que a capacidade do espaço ${espaco.nome} (${espaco.capacidade} pessoas).`,
      409, { campos: ['publico_estimado'] });
  }

  const bloqueio = bloqueioModel.buscarConflito('espaco_id', espaco.id, inicio, fim);
  if (bloqueio) {
    throw new AppError(
      `O espaço ${espaco.nome} está bloqueado ${descreverPeriodo(bloqueio.inicio, bloqueio.fim)} (${bloqueio.motivo}).`, 409);
  }

  // Intervalo técnico (montagem/desmontagem): amplia o período pedido para os dois lados.
  const { intervaloTecnicoMin } = parametroService.regrasDeReserva();
  const inicioComIntervalo = somarMinutos(inicio, -intervaloTecnicoMin);
  const fimComIntervalo = somarMinutos(fim, intervaloTecnicoMin);

  const conflito = reservaModel.conflitoEspaco(espaco.id, inicioComIntervalo, fimComIntervalo, ignorarSolicitacaoId);
  if (conflito) {
    const extra = intervaloTecnicoMin > 0 ? ` É preciso respeitar ${intervaloTecnicoMin} minutos de intervalo entre reservas.` : '';
    throw new AppError(
      `O espaço ${espaco.nome} já está reservado ${descreverPeriodo(conflito.inicio, conflito.fim)}.${extra}`, 409);
  }
  return espaco;
}

// RN-12, RN-13 e RN-14.
function verificarEquipamento(equipamentoId, quantidade, inicio, fim, ignorarSolicitacaoId = 0) {
  const equipamento = inteiroPositivo(equipamentoId) && equipamentoModel.buscarPorId(equipamentoId);
  if (!equipamento) throw new AppError('Equipamento não encontrado.', 404);
  const nome = `${equipamento.nome} (${equipamento.codigo_patrimonio})`;

  if (equipamento.situacao !== 'operacional') {
    throw new AppError(`O equipamento ${nome} está ${SITUACOES[equipamento.situacao]} e não pode ser reservado.`, 409);
  }
  if (!inteiroPositivo(quantidade)) {
    throw new AppError(`Quantidade inválida para ${nome}.`, 400);
  }
  quantidade = Number(quantidade);
  if (equipamento.tipo_controle === 'individual' && quantidade !== 1) {
    throw new AppError(`O equipamento ${nome} é individual: a quantidade deve ser 1.`, 400);
  }
  if (quantidade > equipamento.quantidade_total) {
    throw new AppError(`Existem apenas ${equipamento.quantidade_total} unidade(s) de ${equipamento.nome} cadastradas.`, 409);
  }

  const bloqueio = bloqueioModel.buscarConflito('equipamento_id', equipamento.id, inicio, fim);
  if (bloqueio) {
    throw new AppError(
      `O equipamento ${nome} está bloqueado ${descreverPeriodo(bloqueio.inicio, bloqueio.fim)} (${bloqueio.motivo}).`, 409);
  }

  const ocupacoes = reservaModel.ocupacoesEquipamento(equipamento.id, inicio, fim, ignorarSolicitacaoId);

  if (equipamento.tipo_controle === 'individual') {
    const ocupacao = ocupacoes[0];
    if (ocupacao && ocupacao.status === 'retirado' && ocupacao.fim <= inicio) {
      throw new AppError(`O equipamento ${nome} foi retirado e ainda não foi devolvido.`, 409);
    }
    if (ocupacao) {
      throw new AppError(`O equipamento ${nome} já está reservado ${descreverPeriodo(ocupacao.inicio, ocupacao.fim)}.`, 409);
    }
    return equipamento;
  }

  // Item por quantidade: o saldo no período não pode ficar negativo.
  // Soma tudo o que se sobrepõe ao período pedido (cálculo conservador).
  const emUso = ocupacoes.reduce((total, o) => total + o.quantidade, 0);
  const saldo = equipamento.quantidade_total - emUso;
  if (quantidade > saldo) {
    throw new AppError(
      `Só há ${Math.max(saldo, 0)} unidade(s) de ${equipamento.nome} disponível(is) nesse período (pedido: ${quantidade}).`, 409);
  }
  return equipamento;
}

// Usado pelo formulário para avisar o usuário antes de enviar (a validação definitiva é no envio e na aprovação).
function consultar({ espaco_id, equipamento_id, inicio, fim, publico, quantidade }) {
  try {
    validarPeriodo(inicio, fim);
    if (espaco_id) verificarEspaco(espaco_id, inicio, fim, publico);
    if (equipamento_id) verificarEquipamento(equipamento_id, quantidade || 1, inicio, fim);
    return { disponivel: true };
  } catch (err) {
    if (err instanceof AppError && err.status !== 404) return { disponivel: false, motivo: err.message };
    throw err;
  }
}

// Monta a agenda de um dia: para cada recurso, as reservas aprovadas e os bloqueios.
function agendaDoDia(dia, tipo = 'espaco') {
  if (!diaValido(dia)) throw new AppError('Informe a data no formato AAAA-MM-DD.', 400);
  if (!['espaco', 'equipamento'].includes(tipo)) throw new AppError('Tipo de recurso inválido.', 400);

  const regras = parametroService.regrasDeReserva();
  const recursos = tipo === 'espaco'
    ? espacoModel.listar({ ativo: '1' })
    : equipamentoModel.listar();
  const reservas = reservaModel.ocupacoesDoDia(tipo, dia);
  const bloqueios = bloqueioModel.listar({ de: dia, ate: dia });
  const coluna = tipo === 'espaco' ? 'espaco_id' : 'equipamento_id';

  return {
    data: dia,
    abertura: regras.horarioAbertura,
    fechamento: regras.horarioFechamento,
    recursos: recursos.map((r) => ({
      id: r.id,
      nome: r.nome,
      capacidade: r.capacidade,
      codigo_patrimonio: r.codigo_patrimonio,
      tipo_controle: r.tipo_controle,
      quantidade_total: r.quantidade_total,
      situacao: r.situacao,
      ocupacoes: [
        ...reservas.filter((o) => o.recurso_id === r.id).map((o) => ({
          tipo: o.status === 'retirado' ? 'retirado' : 'reserva',
          inicio: o.inicio,
          fim: o.fim,
          quantidade: o.quantidade,
          descricao: o.descricao,
          solicitacao_id: o.solicitacao_id
        })),
        ...bloqueios.filter((b) => b[coluna] === r.id).map((b) => ({
          tipo: 'bloqueio',
          inicio: b.inicio,
          fim: b.fim,
          descricao: b.motivo
        }))
      ].sort((a, b) => (a.inicio < b.inicio ? -1 : 1))
    }))
  };
}

module.exports = { sobrepoe, validarPeriodo, verificarEspaco, verificarEquipamento, consultar, agendaDoDia };
