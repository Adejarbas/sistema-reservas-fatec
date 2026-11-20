const bcrypt = require('bcryptjs');
const AppError = require('../utils/AppError');
const { exigirCampos, emailValido, inteiroPositivo } = require('../utils/validacao');
const usuarioModel = require('../models/usuarioModel');
const perfilModel = require('../models/perfilModel');
const auditoriaModel = require('../models/auditoriaModel');
const { formatarUsuario } = require('./authService');

const TAMANHO_MINIMO_SENHA = 6;

function validarDados({ nome, email, perfil_id }, idAtual = 0) {
  exigirCampos({ nome, email, perfil_id }, ['nome', 'email', 'perfil_id']);

  if (!emailValido(email)) {
    throw new AppError('Informe um e-mail válido.', 400, { campos: ['email'] });
  }
  if (usuarioModel.emailEmUso(email, idAtual)) {
    throw new AppError('Já existe um usuário com esse e-mail.', 409, { campos: ['email'] });
  }
  if (!inteiroPositivo(perfil_id) || !perfilModel.buscarPorId(perfil_id)) {
    throw new AppError('Perfil não encontrado.', 400, { campos: ['perfil_id'] });
  }
}

function validarSenha(senha) {
  if (!senha || String(senha).length < TAMANHO_MINIMO_SENHA) {
    throw new AppError(`A senha deve ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.`, 400, { campos: ['senha'] });
  }
}

function listar(filtros) {
  return usuarioModel.listar(filtros).map(formatarUsuario);
}

function buscar(id) {
  const usuario = usuarioModel.buscarPorId(id);
  if (!usuario) throw new AppError('Usuário não encontrado.', 404);
  return formatarUsuario(usuario);
}

function criar(dados, adminId) {
  const nome = String(dados.nome || '').trim();
  const email = String(dados.email || '').trim().toLowerCase();
  validarDados({ nome, email, perfil_id: dados.perfil_id });
  validarSenha(dados.senha);

  const id = usuarioModel.criar({
    nome,
    email,
    senhaHash: bcrypt.hashSync(String(dados.senha), 10),
    perfilId: Number(dados.perfil_id)
  });
  auditoriaModel.registrar(adminId, 'criar', 'usuario', id, `Usuário ${email} criado`);
  return buscar(id);
}

function atualizar(id, dados, adminId) {
  const atual = buscar(id);
  const nome = String(dados.nome ?? atual.nome).trim();
  const email = String(dados.email ?? atual.email).trim().toLowerCase();
  const perfilId = dados.perfil_id ?? atual.perfil_id;
  const ativo = dados.ativo === undefined ? atual.ativo : [true, 1, '1', 'true'].includes(dados.ativo);

  validarDados({ nome, email, perfil_id: perfilId }, id);
  if (dados.senha) validarSenha(dados.senha);

  // Evita que o administrador perca o próprio acesso sem querer.
  if (id === adminId && !ativo) {
    throw new AppError('Você não pode desativar o seu próprio usuário.', 400);
  }

  usuarioModel.atualizar(id, { nome, email, perfilId: Number(perfilId), ativo: ativo ? 1 : 0 });
  if (dados.senha) {
    usuarioModel.atualizarSenha(id, bcrypt.hashSync(String(dados.senha), 10));
  }

  auditoriaModel.registrar(adminId, 'editar', 'usuario', id,
    `Usuário ${email} alterado (perfil ${perfilId}, ${ativo ? 'ativo' : 'inativo'})`);
  return buscar(id);
}

module.exports = { listar, buscar, criar, atualizar };
