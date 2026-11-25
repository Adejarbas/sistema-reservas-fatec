require('dotenv').config({ quiet: true });

if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('Defina JWT_SECRET no arquivo .env (veja o .env.example).');
    process.exit(1);
  }
  // Facilita rodar o projeto pela primeira vez; em produção a chave é obrigatória.
  process.env.JWT_SECRET = 'chave-de-desenvolvimento';
  console.warn('Aviso: arquivo .env não encontrado, usando uma chave de desenvolvimento.');
}

const { db } = require('./db');
const app = require('./app');

const tabelaExiste = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'usuario'").get();
if (!tabelaExiste) {
  console.error('Banco de dados vazio. Rode "npm run seed" antes de iniciar o servidor.');
  process.exit(1);
}

const porta = process.env.PORT || 3000;
app.listen(porta, () => {
  console.log(`Servidor rodando em http://localhost:${porta}`);
});
