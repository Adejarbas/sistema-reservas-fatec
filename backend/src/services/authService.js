const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');
const { exigirCampos } = require('../utils/validacao');
const usuarioModel = require('../models/usuarioModel');

function formatarUsuario(usuario) {
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    ativo: usuario.ativo === 1,
    perfil_id: usuario.perfil_id,
    perfil: usuario.perfil,
    permissoes: usuario.permissoes ? usuario.permissoes.split(',') : []
  };
}

function login(email, senha) {
  exigirCampos({ email, senha }, ['email', 'senha']);

  const registro = usuarioModel.buscarParaLogin(String(email).trim().toLowerCase());
  // Mesma mensagem para e-mail ou senha errados, para não revelar quais e-mails existem.
  if (!registro || !bcrypt.compareSync(String(senha), registro.senha_hash)) {
    throw new AppError('E-mail ou senha inválidos.', 401);
  }
  if (registro.ativo !== 1) {
    throw new AppError('Usuário inativo. Procure o administrador.', 403);
  }

  const token = jwt.sign({ id: registro.id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRA_EM || '8h'
  });
  const usuario = formatarUsuario(usuarioModel.buscarPorId(registro.id));
  return { token, usuario };
}

// O usuário é buscado de novo no banco a cada requisição, assim um usuário
// desativado ou que mudou de perfil perde o acesso na hora.
function usuarioDoToken(token) {
  let dados;
  try {
    dados = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new AppError('Sessão expirada. Faça login novamente.', 401);
  }

  const usuario = usuarioModel.buscarPorId(dados.id);
  if (!usuario || usuario.ativo !== 1) {
    throw new AppError('Usuário inativo ou inexistente.', 401);
  }
  return formatarUsuario(usuario);
}

module.exports = { login, usuarioDoToken, formatarUsuario };
