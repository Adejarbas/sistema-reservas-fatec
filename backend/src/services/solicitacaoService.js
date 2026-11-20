const { db } = require('../db');
const AppError = require('../utils/AppError');
const { exigirCampos, inteiroPositivo, texto } = require('../utils/validacao');
const { agora, diaValido } = require('../utils/datas');
const solicitacaoModel = require('../models/solicitacaoModel');
const reservaModel = require('../models/reservaModel');
const historicoModel = require('../models/historicoModel');
const movimentacaoModel = require('../models/movimentacaoModel');
const espacoModel = require('../models/espacoModel');
const equipamentoModel = require('../models/equipamentoModel');
const disponibilidade = require('./disponibilidadeService');
const notificacaoService = require('./notificacaoService');

const STATUS = {
  rascunho: 'Rascunho',
  pendente: 'Pendente',
  em_ajustes: 'Em ajustes',
  aprovada: 'Aprovada',
  rejeitada: 'Rejeitada',
  cancelada: 'Cancelada',
  concluida: 'Concluída'
};

// Transições permitidas. Qualquer outra é recusada pelo servidor.
const TRANSICOES = {
  rascunho: ['pendente', 'cancelada'],
  pendente: ['aprovada', 'rejeitada', 'em_ajustes', 'cancelada'],
  em_ajustes: ['pendente', 'cancelada'],
  aprovada: ['pendente', 'cancelada', 'concluida'], // 'pendente' quando é alterada depois de aprovada
  rejeitada: [],
  cancelada: [],
  concluida: []
};

const TIPOS_ATIVIDADE = ['palestra', 'oficina', 'minicurso', 'seminario', 'reuniao', 'cultural', 'extensao', 'outro'];

// ---------- Funções de apoio ----------

function link(id) {
  return `solicitacao.html?id=${id}`;
}

function carregar(id) {
  const solicitacao = solicitacaoModel.buscarPorId(id);
  if (!solicitacao) throw new AppError('Solicitação não encontrada.', 404);
  return solicitacao;
}

function validarTransicao(atual, novo) {
  if (!TRANSICOES[atual].includes(novo)) {
    throw new AppError(
      `Não é possível mudar a solicitação de "${STATUS[atual]}" para "${STATUS[novo]}".`, 409);
  }
}

// Toda mudança de status passa por aqui e fica registrada no histórico.
function mudarStatus(solicitacao, novo, atorId, acao, justificativa = null) {
  validarTransicao(solicitacao.status, novo);
  solicitacaoModel.atualizarStatus(solicitacao.id, novo);
  historicoModel.registrar(solicitacao.id, atorId, acao, solicitacao.status, novo, justificativa);
}

function exigirDono(solicitacao, usuario) {
  if (solicitacao.solicitante_id !== usuario.id) {
    throw new AppError('Apenas o solicitante pode fazer isso.', 403);
  }
}

// Solicitação com espaço é decidida pela secretaria; só com equipamentos, pelo responsável por equipamentos.
function exigirPodeDecidir(solicitacao, usuario) {
  const temEspaco = reservaModel.listarEspacosDaSolicitacao(solicitacao.id).length > 0;
  const permissao = temEspaco ? 'decidir_espaco' : 'decidir_equipamento';
  if (!usuario.permissoes.includes(permissao)) {
    throw new AppError('Você não tem permissão para decidir esta solicitação.', 403);
  }
  if (solicitacao.solicitante_id === usuario.id) {
    throw new AppError('Você não pode decidir sobre a sua própria solicitação.', 403);
  }
  return temEspaco;
}

function avisarAnalistas(solicitacaoId, mensagem, excetoId) {
  const permissoes = [];
  if (reservaModel.listarEspacosDaSolicitacao(solicitacaoId).length) permissoes.push('decidir_espaco');
  if (reservaModel.listarEquipamentosDaSolicitacao(solicitacaoId).length) permissoes.push('decidir_equipamento');
  notificacaoService.notificarPorPermissao(permissoes, mensagem, link(solicitacaoId), excetoId);
}

function montarDados(dados) {
  const equipamentos = Array.isArray(dados.equipamentos) ? dados.equipamentos : [];
  return {
    titulo: texto(dados.titulo),
    tipo: texto(dados.tipo),
    descricao: texto(dados.descricao),
    publico_estimado: dados.publico_estimado,
    inicio: texto(dados.inicio),
    fim: texto(dados.fim),
    espaco_id: dados.espaco_id ? Number(dados.espaco_id) : null,
    equipamentos: equipamentos.map((e) => ({
      equipamento_id: Number(e.equipamento_id),
      quantidade: Number(e.quantidade || 1)
    })),
    motivo: texto(dados.motivo) || null
  };
}

// RN-02 e RN-03: campos obrigatórios e período válido.
function validarDados(dados) {
  exigirCampos(dados, ['titulo', 'tipo', 'descricao', 'publico_estimado', 'inicio', 'fim']);

  if (!TIPOS_ATIVIDADE.includes(dados.tipo)) {
    throw new AppError('Tipo de atividade inválido.', 400, { campos: ['tipo'] });
  }
  if (!inteiroPositivo(dados.publico_estimado)) {
    throw new AppError('O público estimado deve ser um número inteiro maior que zero.', 400, { campos: ['publico_estimado'] });
  }
  dados.publico_estimado = Number(dados.publico_estimado);

  disponibilidade.validarPeriodo(dados.inicio, dados.fim);

  if (!dados.espaco_id && dados.equipamentos.length === 0) {
    throw new AppError('Selecione um espaço ou pelo menos um equipamento.', 400, { campos: ['espaco_id', 'equipamentos'] });
  }
  if (dados.espaco_id && !espacoModel.buscarPorId(dados.espaco_id)) {
    throw new AppError('Espaço não encontrado.', 400, { campos: ['espaco_id'] });
  }

  const usados = new Set();
  for (const item of dados.equipamentos) {
    if (!inteiroPositivo(item.equipamento_id) || !equipamentoModel.buscarPorId(item.equipamento_id)) {
      throw new AppError('Equipamento não encontrado.', 400, { campos: ['equipamentos'] });
    }
    if (!inteiroPositivo(item.quantidade)) {
      throw new AppError('Quantidade de equipamento inválida.', 400, { campos: ['equipamentos'] });
    }
    if (usados.has(item.equipamento_id)) {
      throw new AppError('O mesmo equipamento foi adicionado mais de uma vez.', 400, { campos: ['equipamentos'] });
    }
    usados.add(item.equipamento_id);
  }
}

// Confere todos os recursos da solicitação contra as reservas aprovadas e bloqueios.
function verificarRecursos(solicitacao) {
  for (const r of reservaModel.listarEspacosDaSolicitacao(solicitacao.id)) {
    disponibilidade.verificarEspaco(r.espaco_id, r.inicio, r.fim, solicitacao.publico_estimado, solicitacao.id);
  }
  for (const r of reservaModel.listarEquipamentosDaSolicitacao(solicitacao.id)) {
    disponibilidade.verificarEquipamento(r.equipamento_id, r.quantidade, r.inicio, r.fim, solicitacao.id);
  }
}

function salvarReservas(solicitacaoId, dados) {
  reservaModel.substituirReservas(solicitacaoId, {
    espacoId: dados.espaco_id,
    equipamentos: dados.equipamentos,
    inicio: dados.inicio,
    fim: dados.fim
  });
}

// ---------- Consultas ----------

function listar(query, usuario) {
  if (query.status && !STATUS[query.status]) throw new AppError('Status inválido.', 400);
  if ((query.de && !diaValido(query.de)) || (query.ate && !diaValido(query.ate))) {
    throw new AppError('Informe as datas do filtro no formato AAAA-MM-DD.', 400);
  }

  const filtros = {
    status: query.status,
    de: query.de,
    ate: query.ate,
    espacoId: query.espaco_id,
    equipamentoId: query.equipamento_id,
    solicitante: query.solicitante
  };
  // Quem não tem "ver_todas" só enxerga as próprias solicitações.
  if (!usuario.permissoes.includes('ver_todas') || query.minhas === '1') {
    filtros.solicitanteId = usuario.id;
  } else {
    filtros.ocultarRascunhosDeOutros = usuario.id;
  }
  return solicitacaoModel.listar(filtros);
}

function detalhar(id, usuario) {
  const solicitacao = carregar(id);
  if (solicitacao.solicitante_id !== usuario.id && !usuario.permissoes.includes('ver_todas')) {
    throw new AppError('Você não tem permissão para ver esta solicitação.', 403);
  }
  return {
    ...solicitacao,
    espacos: reservaModel.listarEspacosDaSolicitacao(id),
    equipamentos: reservaModel.listarEquipamentosDaSolicitacao(id),
    historico: historicoModel.listarDaSolicitacao(id),
    movimentacoes: movimentacaoModel.listarDaSolicitacao(id)
  };
}

// ---------- Ações do solicitante ----------

function criar(dados, usuario) {
  const novos = montarDados(dados);
  validarDados(novos);

  const id = db.transaction(() => {
    const atividadeId = solicitacaoModel.criarAtividade(novos, usuario.id);
    const solicitacaoId = solicitacaoModel.criar(atividadeId, usuario.id, novos.motivo);
    salvarReservas(solicitacaoId, novos);
    historicoModel.registrar(solicitacaoId, usuario.id, 'criar', null, 'rascunho');

    // Se o envio falhar (ex.: conflito), a transação desfaz tudo e nada é gravado.
    if (dados.enviar) enviarNaTransacao(solicitacaoId, usuario);
    return solicitacaoId;
  }).immediate();

  return detalhar(id, usuario);
}

function enviarNaTransacao(id, usuario) {
  const solicitacao = carregar(id);
  exigirDono(solicitacao, usuario);
  validarTransicao(solicitacao.status, 'pendente');

  disponibilidade.validarPeriodo(solicitacao.inicio, solicitacao.fim, { exigirAntecedencia: true });
  verificarRecursos(solicitacao);

  reservaModel.atualizarStatusEspacos(id, ['pendente', 'aprovada', 'rejeitada'], 'pendente');
  reservaModel.atualizarStatusEquipamentos(id, ['pendente', 'aprovada', 'rejeitada'], 'pendente');
  mudarStatus(solicitacao, 'pendente', usuario.id, solicitacao.status === 'rascunho' ? 'enviar' : 'reenviar');

  avisarAnalistas(id, `Nova solicitação #${id} (${solicitacao.titulo}) aguardando análise.`, usuario.id);
}

function enviar(id, usuario) {
  db.transaction(() => enviarNaTransacao(id, usuario)).immediate();
  return detalhar(id, usuario);
}

function atualizar(id, dados, usuario) {
  const novos = montarDados(dados);

  db.transaction(() => {
    const solicitacao = carregar(id);
    exigirDono(solicitacao, usuario);
    if (!['rascunho', 'em_ajustes', 'aprovada'].includes(solicitacao.status)) {
      throw new AppError(`Uma solicitação "${STATUS[solicitacao.status]}" não pode ser editada.`, 409);
    }
    const jaRetirado = reservaModel.listarEquipamentosDaSolicitacao(id)
      .some((e) => ['retirado', 'devolvido'].includes(e.status));
    if (jaRetirado) {
      throw new AppError('Não é possível alterar: já existe equipamento retirado nesta solicitação.', 409);
    }

    validarDados(novos);
    solicitacaoModel.atualizarAtividade(solicitacao.atividade_id, novos);
    solicitacaoModel.atualizarMotivo(id, novos.motivo);
    salvarReservas(id, novos);

    if (solicitacao.status === 'aprovada') {
      // RN-09: alterou depois de aprovada -> nova verificação de disponibilidade e nova análise.
      const atualizada = carregar(id);
      disponibilidade.validarPeriodo(atualizada.inicio, atualizada.fim, { exigirAntecedencia: true });
      verificarRecursos(atualizada);
      mudarStatus(solicitacao, 'pendente', usuario.id, 'alterar', 'Alterada após a aprovação: precisa de nova análise.');
      solicitacaoModel.atualizarStatusAtividade(solicitacao.atividade_id, 'planejada');
      avisarAnalistas(id, `A solicitação #${id} (${novos.titulo}) foi alterada após a aprovação e precisa de nova análise.`, usuario.id);
    } else {
      historicoModel.registrar(id, usuario.id, 'editar', solicitacao.status, solicitacao.status);
      if (dados.enviar) enviarNaTransacao(id, usuario);
    }
  }).immediate();

  return detalhar(id, usuario);
}

function cancelar(id, usuario, motivo) {
  db.transaction(() => {
    const solicitacao = carregar(id);
    const ehDono = solicitacao.solicitante_id === usuario.id;
    const ehAnalista = usuario.permissoes.includes('decidir_espaco') || usuario.permissoes.includes('decidir_equipamento');
    if (!ehDono && !ehAnalista) {
      throw new AppError('Você só pode cancelar as suas próprias solicitações.', 403);
    }

    const justificativa = texto(motivo);
    if (solicitacao.status !== 'rascunho' && !justificativa) {
      throw new AppError('Informe o motivo do cancelamento.', 400, { campos: ['motivo'] });
    }
    validarTransicao(solicitacao.status, 'cancelada');

    const retirado = reservaModel.listarEquipamentosDaSolicitacao(id).some((e) => e.status === 'retirado');
    if (retirado) {
      throw new AppError('Há equipamento retirado nesta solicitação. Registre a devolução antes de cancelar.', 409);
    }

    // RN-10: as reservas deixam de ser "aprovada", então a agenda fica livre na hora.
    reservaModel.atualizarStatusEspacos(id, ['pendente', 'aprovada'], 'cancelada', justificativa || null);
    reservaModel.atualizarStatusEquipamentos(id, ['pendente', 'aprovada'], 'cancelada', justificativa || null);
    mudarStatus(solicitacao, 'cancelada', usuario.id, 'cancelar', justificativa || null);
    solicitacaoModel.atualizarStatusAtividade(solicitacao.atividade_id, 'cancelada');

    if (!ehDono) {
      notificacaoService.notificar(solicitacao.solicitante_id,
        `Sua solicitação #${id} (${solicitacao.titulo}) foi cancelada por ${usuario.nome}. Motivo: ${justificativa}`, link(id));
    }
    if (solicitacao.status === 'aprovada' || solicitacao.status === 'pendente') {
      avisarAnalistas(id, `A solicitação #${id} (${solicitacao.titulo}) foi cancelada.`, usuario.id);
    }
  }).immediate();

  return detalhar(id, usuario);
}

// ---------- Decisões da secretaria / responsável por equipamentos ----------

function aprovar(id, usuario, justificativa) {
  // .immediate() abre a transação com BEGIN IMMEDIATE: o banco fica travado para escrita
  // até o COMMIT. Assim, duas aprovações ao mesmo tempo não conseguem alocar o mesmo
  // recurso: a segunda espera a primeira terminar e, ao verificar de novo, encontra o conflito (CA-12).
  db.transaction(() => {
    const solicitacao = carregar(id);
    const temEspaco = exigirPodeDecidir(solicitacao, usuario);
    validarTransicao(solicitacao.status, 'aprovada');

    const equipamentos = reservaModel.listarEquipamentosDaSolicitacao(id);
    let aviso = '';

    if (temEspaco) {
      // A disponibilidade mostrada na tela é só informativa: aqui ela é verificada de novo.
      for (const r of reservaModel.listarEspacosDaSolicitacao(id)) {
        disponibilidade.verificarEspaco(r.espaco_id, r.inicio, r.fim, solicitacao.publico_estimado, id);
      }
      reservaModel.atualizarStatusEspacos(id, ['pendente'], 'aprovada');

      // RN-18: aprovar o evento não aprova os equipamentos automaticamente.
      if (equipamentos.some((e) => e.status === 'pendente')) {
        aviso = ' Os equipamentos ainda serão analisados pelo responsável.';
        notificacaoService.notificarPorPermissao('decidir_equipamento',
          `Solicitação #${id} (${solicitacao.titulo}) aprovada pela secretaria: há equipamentos aguardando análise.`,
          link(id), usuario.id);
      }
    } else {
      // Solicitação só de equipamentos: aprova os itens que ainda estão pendentes.
      const ativos = equipamentos.filter((e) => ['pendente', 'aprovada'].includes(e.status));
      if (ativos.length === 0) {
        throw new AppError('Todos os equipamentos foram rejeitados. Rejeite a solicitação ou devolva para ajustes.', 409);
      }
      for (const r of ativos.filter((e) => e.status === 'pendente')) {
        disponibilidade.verificarEquipamento(r.equipamento_id, r.quantidade, r.inicio, r.fim, id);
        reservaModel.atualizarStatusEquipamento(r.id, 'aprovada');
      }
    }

    mudarStatus(solicitacao, 'aprovada', usuario.id, 'aprovar', texto(justificativa) || null);
    solicitacaoModel.atualizarStatusAtividade(solicitacao.atividade_id, 'confirmada');
    notificacaoService.notificar(solicitacao.solicitante_id,
      `Sua solicitação #${id} (${solicitacao.titulo}) foi aprovada.${aviso}`, link(id));
  }).immediate();

  return detalhar(id, usuario);
}

function rejeitar(id, usuario, justificativa) {
  const motivo = texto(justificativa);
  if (!motivo) {
    throw new AppError('A justificativa é obrigatória para rejeitar a solicitação.', 400, { campos: ['justificativa'] });
  }

  db.transaction(() => {
    const solicitacao = carregar(id);
    exigirPodeDecidir(solicitacao, usuario);
    validarTransicao(solicitacao.status, 'rejeitada');

    reservaModel.atualizarStatusEspacos(id, ['pendente', 'aprovada'], 'rejeitada', motivo);
    reservaModel.atualizarStatusEquipamentos(id, ['pendente', 'aprovada'], 'rejeitada', motivo);
    mudarStatus(solicitacao, 'rejeitada', usuario.id, 'rejeitar', motivo);
    solicitacaoModel.atualizarStatusAtividade(solicitacao.atividade_id, 'cancelada');
    notificacaoService.notificar(solicitacao.solicitante_id,
      `Sua solicitação #${id} (${solicitacao.titulo}) foi rejeitada. Motivo: ${motivo}`, link(id));
  }).immediate();

  return detalhar(id, usuario);
}

function devolverParaAjustes(id, usuario, justificativa) {
  const motivo = texto(justificativa);
  if (!motivo) {
    throw new AppError('Informe o que precisa ser ajustado.', 400, { campos: ['justificativa'] });
  }

  db.transaction(() => {
    const solicitacao = carregar(id);
    exigirPodeDecidir(solicitacao, usuario);
    validarTransicao(solicitacao.status, 'em_ajustes');

    // Volta tudo para pendente: depois da correção, os recursos são analisados de novo.
    reservaModel.atualizarStatusEspacos(id, ['aprovada', 'rejeitada'], 'pendente');
    reservaModel.atualizarStatusEquipamentos(id, ['aprovada', 'rejeitada'], 'pendente');
    mudarStatus(solicitacao, 'em_ajustes', usuario.id, 'devolver', motivo);
    notificacaoService.notificar(solicitacao.solicitante_id,
      `Sua solicitação #${id} (${solicitacao.titulo}) foi devolvida para ajustes: ${motivo}`, link(id));
  }).immediate();

  return detalhar(id, usuario);
}

function concluir(id, usuario) {
  db.transaction(() => {
    const solicitacao = carregar(id);
    validarTransicao(solicitacao.status, 'concluida');

    if (agora() < solicitacao.fim) {
      throw new AppError('A atividade só pode ser concluída depois do horário de término.', 409);
    }
    const retirado = reservaModel.listarEquipamentosDaSolicitacao(id).some((e) => e.status === 'retirado');
    if (retirado) {
      throw new AppError('Ainda há equipamento retirado sem devolução nesta solicitação.', 409);
    }

    reservaModel.atualizarStatusEspacos(id, ['aprovada'], 'concluida');
    reservaModel.atualizarStatusEquipamentos(id, ['pendente'], 'cancelada', 'Não analisado antes da conclusão.');
    mudarStatus(solicitacao, 'concluida', usuario.id, 'concluir');
    solicitacaoModel.atualizarStatusAtividade(solicitacao.atividade_id, 'concluida');
  }).immediate();

  return detalhar(id, usuario);
}

// ---------- Decisão por equipamento (RN-18) ----------

function carregarReservaEquipamento(id) {
  const reserva = reservaModel.buscarReservaEquipamento(id);
  if (!reserva) throw new AppError('Reserva de equipamento não encontrada.', 404);
  return reserva;
}

function exigirPodeDecidirEquipamento(reserva, usuario) {
  if (reserva.solicitante_id === usuario.id) {
    throw new AppError('Você não pode decidir sobre a sua própria solicitação.', 403);
  }
  if (!['pendente', 'aprovada'].includes(reserva.status_solicitacao)) {
    throw new AppError('Só é possível analisar equipamentos de solicitações pendentes ou aprovadas.', 409);
  }
}

function aprovarEquipamento(reservaId, usuario) {
  db.transaction(() => {
    const reserva = carregarReservaEquipamento(reservaId);
    exigirPodeDecidirEquipamento(reserva, usuario);
    if (reserva.status !== 'pendente') {
      throw new AppError('Este equipamento já foi analisado.', 409);
    }

    // Verificação refeita dentro da transação, igual à aprovação da solicitação.
    disponibilidade.verificarEquipamento(reserva.equipamento_id, reserva.quantidade, reserva.inicio, reserva.fim,
      reserva.solicitacao_id);
    reservaModel.atualizarStatusEquipamento(reserva.id, 'aprovada');

    const nome = `${reserva.equipamento} (${reserva.codigo_patrimonio})`;
    historicoModel.registrar(reserva.solicitacao_id, usuario.id, 'aprovar_equipamento', null, null, `${nome} aprovado`);
    notificacaoService.notificar(reserva.solicitante_id,
      `O equipamento ${nome} da sua solicitação #${reserva.solicitacao_id} foi aprovado.`, link(reserva.solicitacao_id));
  }).immediate();

  return reservaModel.buscarReservaEquipamento(reservaId);
}

function rejeitarEquipamento(reservaId, usuario, justificativa) {
  const motivo = texto(justificativa);
  if (!motivo) {
    throw new AppError('A justificativa é obrigatória para rejeitar o equipamento.', 400, { campos: ['justificativa'] });
  }

  db.transaction(() => {
    const reserva = carregarReservaEquipamento(reservaId);
    exigirPodeDecidirEquipamento(reserva, usuario);
    if (!['pendente', 'aprovada'].includes(reserva.status)) {
      throw new AppError('Este equipamento não pode mais ser rejeitado.', 409);
    }

    reservaModel.atualizarStatusEquipamento(reserva.id, 'rejeitada', motivo);
    const nome = `${reserva.equipamento} (${reserva.codigo_patrimonio})`;
    historicoModel.registrar(reserva.solicitacao_id, usuario.id, 'rejeitar_equipamento', null, null, `${nome}: ${motivo}`);
    notificacaoService.notificar(reserva.solicitante_id,
      `O equipamento ${nome} da sua solicitação #${reserva.solicitacao_id} foi rejeitado. Motivo: ${motivo}`,
      link(reserva.solicitacao_id));
  }).immediate();

  return reservaModel.buscarReservaEquipamento(reservaId);
}

function listarReservasEquipamento(query) {
  if (query.data && !diaValido(query.data)) throw new AppError('Informe a data no formato AAAA-MM-DD.', 400);
  return reservaModel.listarReservasEquipamento({
    status: query.status,
    data: query.data,
    equipamentoId: query.equipamento_id
  });
}

module.exports = {
  STATUS,
  TRANSICOES,
  TIPOS_ATIVIDADE,
  listar,
  detalhar,
  criar,
  enviar,
  atualizar,
  cancelar,
  aprovar,
  rejeitar,
  devolverParaAjustes,
  concluir,
  aprovarEquipamento,
  rejeitarEquipamento,
  listarReservasEquipamento
};
