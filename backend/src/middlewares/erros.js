const AppError = require('../utils/AppError');

function rotaNaoEncontrada(req, res) {
  res.status(404).json({ erro: 'Rota não encontrada.' });
}

// Todo erro lançado nas rotas cai aqui e vira uma resposta JSON padronizada.
function tratarErros(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ erro: err.message, ...err.extras });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido no corpo da requisição.' });
  }

  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({ erro: 'Erro interno no servidor. Tente novamente mais tarde.' });
}

module.exports = { rotaNaoEncontrada, tratarErros };
