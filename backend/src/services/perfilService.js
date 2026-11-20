const AppError = require('../utils/AppError');
const { PERMISSOES } = require('../utils/permissoes');
const perfilModel = require('../models/perfilModel');
const auditoriaModel = require('../models/auditoriaModel');

function formatar(perfil) {
  return { ...perfil, permissoes: perfil.permissoes ? perfil.permissoes.split(',') : [] };
}

function listar() {
  return perfilModel.listar().map(formatar);
}

function atualizarPermissoes(id, permissoes, adminId) {
  const perfil = perfilModel.buscarPorId(id);
  if (!perfil) throw new AppError('Perfil não encontrado.', 404);

  if (!Array.isArray(permissoes)) {
    throw new AppError('Envie as permissões em uma lista.', 400);
  }
  const invalidas = permissoes.filter((p) => !PERMISSOES[p]);
  if (invalidas.length > 0) {
    throw new AppError(`Permissões inválidas: ${invalidas.join(', ')}.`, 400);
  }

  const unicas = [...new Set(permissoes)].join(',');
  perfilModel.atualizarPermissoes(id, unicas);
  auditoriaModel.registrar(adminId, 'editar', 'perfil', id, `Permissões: ${unicas || '(nenhuma)'}`);
  return formatar(perfilModel.buscarPorId(id));
}

module.exports = { listar, atualizarPermissoes };
