const authService = require('../services/authService');

const OPCOES_COOKIE = {
  httpOnly: true, // o JavaScript da página não consegue ler o token (protege contra XSS)
  sameSite: 'strict', // o navegador não envia o cookie em requisições vindas de outros sites
  secure: process.env.NODE_ENV === 'production'
};

function login(req, res) {
  const { email, senha } = req.body;
  const { token, usuario } = authService.login(email, senha);
  res.cookie('token', token, OPCOES_COOKIE);
  res.json({ usuario });
}

function logout(req, res) {
  res.clearCookie('token', OPCOES_COOKIE);
  res.status(204).end();
}

function usuarioLogado(req, res) {
  res.json({ usuario: req.usuario });
}

module.exports = { login, logout, usuarioLogado };
