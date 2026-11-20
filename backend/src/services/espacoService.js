const AppError = require('../utils/AppError');
const { exigirCampos, inteiroPositivo, simOuNao, texto } = require('../utils/validacao');
const espacoModel = require('../models/espacoModel');
const auditoriaModel = require('../models/auditoriaModel');

function validar(dados, idAtual = 0) {
  exigirCampos(dados, ['nome', 'capacidade']);
  if (!inteiroPositivo(dados.capacidade)) {
    throw new AppError('A capacidade deve ser um número inteiro maior que zero.', 400, { campos: ['capacidade'] });
  }
  if (espacoModel.nomeEmUso(dados.nome, idAtual)) {
    throw new AppError('Já existe um espaço com esse nome.', 409, { campos: ['nome'] });
  }
}

function listar(filtros) {
  return espacoModel.listar(filtros);
}

function buscar(id) {
  const espaco = espacoModel.buscarPorId(id);
  if (!espaco) throw new AppError('Espaço não encontrado.', 404);
  return espaco;
}

function criar(dados, usuario) {
  const espaco = {
    nome: texto(dados.nome),
    localizacao: texto(dados.localizacao),
    capacidade: dados.capacidade
  };
  validar(espaco);
  espaco.capacidade = Number(espaco.capacidade);

  const id = espacoModel.criar(espaco);
  auditoriaModel.registrar(usuario.id, 'criar', 'espaco', id, `${espaco.nome} (capacidade ${espaco.capacidade})`);
  return buscar(id);
}

function atualizar(id, dados, usuario) {
  const atual = buscar(id);
  const espaco = {
    nome: dados.nome === undefined ? atual.nome : texto(dados.nome),
    localizacao: dados.localizacao === undefined ? atual.localizacao : texto(dados.localizacao),
    capacidade: dados.capacidade ?? atual.capacidade,
    ativo: simOuNao(dados.ativo, atual.ativo)
  };
  validar(espaco, id);
  espaco.capacidade = Number(espaco.capacidade);

  espacoModel.atualizar(id, espaco);
  auditoriaModel.registrar(usuario.id, 'editar', 'espaco', id,
    `${espaco.nome} (capacidade ${espaco.capacidade}, ${espaco.ativo ? 'ativo' : 'inativo'})`);
  return buscar(id);
}

module.exports = { listar, buscar, criar, atualizar };
