// Erro "esperado" da aplicação: já carrega o status HTTP e a mensagem para o usuário.
class AppError extends Error {
  constructor(mensagem, status = 400, extras = {}) {
    super(mensagem);
    this.status = status;
    this.extras = extras;
  }
}

module.exports = AppError;
