const AppError = require('../utils/AppError');
const { exigirCampos, inteiroPositivo, texto } = require('../utils/validacao');
const { dataValida, descreverPeriodo } = require('../utils/datas');
const bloqueioModel = require('../models/bloqueioModel');
const espacoModel = require('../models/espacoModel');
const equipamentoModel = require('../models/equipamentoModel');
const reservaModel = require('../models/reservaModel');
const auditoriaModel = require('../models/auditoriaModel');
const notificacaoService = require('./notificacaoService');

// Bloqueio de espaço é da secretaria; bloqueio de equipamento é do responsável por equipamentos.
function exigirPermissaoNoRecurso(tipo, usuario) {
  const permissao = tipo === 'espaco' ? 'gerenciar_espacos' : 'gerenciar_equipamentos';
  if (!usuario.permissoes.includes(permissao)) {
    throw new AppError('Você não tem permissão para bloquear este tipo de recurso.', 403);
  }
}

function listar(filtros) {
  return bloqueioModel.listar(filtros);
}

function criar(dados, usuario) {
  const espacoId = dados.espaco_id || null;
  const equipamentoId = dados.equipamento_id || null;
  if (!espacoId === !equipamentoId) {
    throw new AppError('Informe um espaço ou um equipamento (apenas um).', 400, { campos: ['espaco_id', 'equipamento_id'] });
  }

  const tipo = espacoId ? 'espaco' : 'equipamento';
  const recursoId = espacoId || equipamentoId;
  exigirPermissaoNoRecurso(tipo, usuario);

  const recurso = inteiroPositivo(recursoId) &&
    (tipo === 'espaco' ? espacoModel.buscarPorId(recursoId) : equipamentoModel.buscarPorId(recursoId));
  if (!recurso) throw new AppError('Recurso não encontrado.', 404);

  const motivo = texto(dados.motivo);
  exigirCampos({ inicio: dados.inicio, fim: dados.fim, motivo }, ['inicio', 'fim', 'motivo']);
  if (!dataValida(dados.inicio) || !dataValida(dados.fim)) {
    throw new AppError('Informe início e fim em um formato de data válido.', 400, { campos: ['inicio', 'fim'] });
  }
  if (dados.inicio >= dados.fim) {
    throw new AppError('O fim do bloqueio deve ser depois do início.', 400, { campos: ['fim'] });
  }

  const id = bloqueioModel.criar({
    espacoId, equipamentoId, inicio: dados.inicio, fim: dados.fim, motivo, criadoPor: usuario.id
  });
  auditoriaModel.registrar(usuario.id, 'criar', 'bloqueio', id,
    `${recurso.nome} bloqueado ${descreverPeriodo(dados.inicio, dados.fim)}: ${motivo}`);

  // O bloqueio é criado mesmo se já houver reservas aprovadas no período;
  // o sistema lista essas reservas e avisa os solicitantes para a secretaria resolver.
  const afetadas = reservaModel.aprovadasNoPeriodo(tipo, recursoId, dados.inicio, dados.fim);
  for (const r of afetadas) {
    notificacaoService.notificar(r.solicitante_id,
      `${recurso.nome} foi bloqueado ${descreverPeriodo(dados.inicio, dados.fim)} (${motivo}). ` +
      `Sua solicitação #${r.solicitacao_id} pode ser afetada; aguarde contato.`,
      `solicitacao.html?id=${r.solicitacao_id}`);
  }

  return {
    bloqueio: bloqueioModel.buscarPorId(id),
    reservasAfetadas: afetadas,
    aviso: afetadas.length
      ? `Atenção: ${afetadas.length} reserva(s) aprovada(s) neste período. Os solicitantes foram notificados.`
      : null
  };
}

function remover(id, usuario) {
  const bloqueio = bloqueioModel.buscarPorId(id);
  if (!bloqueio) throw new AppError('Bloqueio não encontrado.', 404);
  exigirPermissaoNoRecurso(bloqueio.espaco_id ? 'espaco' : 'equipamento', usuario);

  bloqueioModel.remover(id);
  auditoriaModel.registrar(usuario.id, 'remover', 'bloqueio', id,
    `${bloqueio.espaco || bloqueio.equipamento} ${descreverPeriodo(bloqueio.inicio, bloqueio.fim)}: ${bloqueio.motivo}`);
}

module.exports = { listar, criar, remover };
