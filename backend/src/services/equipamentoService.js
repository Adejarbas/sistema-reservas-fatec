const AppError = require('../utils/AppError');
const { exigirCampos, inteiroPositivo, texto } = require('../utils/validacao');
const { agora } = require('../utils/datas');
const equipamentoModel = require('../models/equipamentoModel');
const categoriaModel = require('../models/categoriaModel');
const reservaModel = require('../models/reservaModel');
const auditoriaModel = require('../models/auditoriaModel');
const notificacaoService = require('./notificacaoService');

const SITUACOES = {
  operacional: 'operacional',
  manutencao: 'em manutenção',
  avariado: 'avariado',
  inativo: 'inativo'
};

// ---------- Categorias ----------

function listarCategorias() {
  return categoriaModel.listar();
}

function salvarCategoria(id, dados, usuario) {
  const nome = texto(dados.nome);
  exigirCampos({ nome }, ['nome']);
  if (categoriaModel.nomeEmUso(nome, id || 0)) {
    throw new AppError('Já existe uma categoria com esse nome.', 409, { campos: ['nome'] });
  }

  if (id) {
    if (!categoriaModel.buscarPorId(id)) throw new AppError('Categoria não encontrada.', 404);
    categoriaModel.atualizar(id, nome);
    auditoriaModel.registrar(usuario.id, 'editar', 'categoria', id, nome);
    return categoriaModel.buscarPorId(id);
  }

  const novoId = categoriaModel.criar(nome);
  auditoriaModel.registrar(usuario.id, 'criar', 'categoria', novoId, nome);
  return categoriaModel.buscarPorId(novoId);
}

// ---------- Equipamentos ----------

function validar(dados, idAtual = 0) {
  exigirCampos(dados, ['codigo_patrimonio', 'nome', 'categoria_id']);

  if (equipamentoModel.codigoEmUso(dados.codigo_patrimonio, idAtual)) {
    throw new AppError('Já existe um equipamento com esse código/patrimônio.', 409, { campos: ['codigo_patrimonio'] });
  }
  if (!inteiroPositivo(dados.categoria_id) || !categoriaModel.buscarPorId(dados.categoria_id)) {
    throw new AppError('Categoria não encontrada.', 400, { campos: ['categoria_id'] });
  }
  if (!['individual', 'quantidade'].includes(dados.tipo_controle)) {
    throw new AppError('Tipo de controle inválido.', 400, { campos: ['tipo_controle'] });
  }
  if (!SITUACOES[dados.situacao]) {
    throw new AppError('Situação inválida.', 400, { campos: ['situacao'] });
  }
  if (dados.tipo_controle === 'quantidade' && !inteiroPositivo(dados.quantidade_total)) {
    throw new AppError('Informe a quantidade em estoque (maior que zero).', 400, { campos: ['quantidade_total'] });
  }
}

function montar(dados, atual = {}) {
  const valor = (campo, padrao) => (dados[campo] === undefined ? (atual[campo] ?? padrao) : dados[campo]);
  const equipamento = {
    codigo_patrimonio: texto(valor('codigo_patrimonio', '')).toUpperCase(),
    nome: texto(valor('nome', '')),
    categoria_id: valor('categoria_id'),
    tipo_controle: valor('tipo_controle', 'individual'),
    quantidade_total: valor('quantidade_total', 1),
    situacao: valor('situacao', 'operacional'),
    localizacao: texto(valor('localizacao', ''))
  };
  // Item individual (com patrimônio próprio) sempre tem quantidade 1.
  if (equipamento.tipo_controle === 'individual') equipamento.quantidade_total = 1;
  return equipamento;
}

function listar(filtros) {
  return equipamentoModel.listar(filtros);
}

function buscar(id) {
  const equipamento = equipamentoModel.buscarPorId(id);
  if (!equipamento) throw new AppError('Equipamento não encontrado.', 404);
  return equipamento;
}

function criar(dados, usuario) {
  const equipamento = montar(dados);
  validar(equipamento);
  equipamento.categoria_id = Number(equipamento.categoria_id);
  equipamento.quantidade_total = Number(equipamento.quantidade_total);

  const id = equipamentoModel.criar(equipamento);
  auditoriaModel.registrar(usuario.id, 'criar', 'equipamento', id,
    `${equipamento.codigo_patrimonio} - ${equipamento.nome}`);
  return buscar(id);
}

// A situação não muda por aqui: avaria/manutenção usa alterarSituacao, que exige motivo.
function atualizar(id, dados, usuario) {
  const atual = buscar(id);
  const equipamento = montar({ ...dados, situacao: atual.situacao }, atual);
  validar(equipamento, id);
  equipamento.categoria_id = Number(equipamento.categoria_id);
  equipamento.quantidade_total = Number(equipamento.quantidade_total);

  equipamentoModel.atualizar(id, equipamento);
  auditoriaModel.registrar(usuario.id, 'editar', 'equipamento', id,
    `${equipamento.codigo_patrimonio} - ${equipamento.nome}`);
  return buscar(id);
}

function alterarSituacao(id, situacao, motivo, usuario) {
  const equipamento = buscar(id);
  if (!SITUACOES[situacao]) {
    throw new AppError('Situação inválida.', 400, { campos: ['situacao'] });
  }
  if (situacao !== 'operacional' && !texto(motivo)) {
    throw new AppError('Informe o motivo da mudança de situação.', 400, { campos: ['motivo'] });
  }

  equipamentoModel.atualizarSituacao(id, situacao);
  auditoriaModel.registrar(usuario.id, 'situacao', 'equipamento', id,
    `${equipamento.codigo_patrimonio}: ${equipamento.situacao} -> ${situacao}. ${texto(motivo)}`.trim());

  const afetadas = situacao === 'operacional' ? [] : avisarReservasFuturas(equipamento, SITUACOES[situacao]);
  return { equipamento: buscar(id), reservasAfetadas: afetadas };
}

// Quando um item fica indisponível, avisa quem já tinha reserva aprovada dele.
function avisarReservasFuturas(equipamento, situacaoTexto) {
  const afetadas = reservaModel.futurasAprovadasDoEquipamento(equipamento.id, agora());
  for (const r of afetadas) {
    notificacaoService.notificar(r.solicitante_id,
      `O equipamento ${equipamento.nome} (${equipamento.codigo_patrimonio}) da sua solicitação #${r.solicitacao_id} ` +
      `ficou ${situacaoTexto}. Procure o responsável por equipamentos.`,
      `solicitacao.html?id=${r.solicitacao_id}`);
  }
  return afetadas;
}

module.exports = {
  SITUACOES,
  listarCategorias,
  salvarCategoria,
  listar,
  buscar,
  criar,
  atualizar,
  alterarSituacao,
  avisarReservasFuturas
};
