const AppError = require('../utils/AppError');
const authService = require('../services/authService');

// Exige um usuário logado. Coloca os dados dele em req.usuario.
function autenticar(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    throw new AppError('Faça login para continuar.', 401);
  }
  req.usuario = authService.usuarioDoToken(token);
  next();
}

// Libera a rota se o usuário tiver pelo menos uma das permissões informadas.
// É aqui que o controle de acesso acontece de verdade, não no front.
function permitir(...permissoes) {
  return (req, res, next) => {
    const temPermissao = permissoes.some((p) => req.usuario.permissoes.includes(p));
    if (!temPermissao) {
      throw new AppError('Você não tem permissão para acessar este recurso.', 403);
    }
    next();
  };
}

module.exports = { autenticar, permitir };
