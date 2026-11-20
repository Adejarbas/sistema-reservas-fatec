const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const SCHEMA = path.join(__dirname, '..', 'database', 'schema.sql');

function caminhoDoBanco() {
  const valor = process.env.DB_PATH || 'database/reservas.db';
  if (valor === ':memory:') return valor;
  return path.resolve(__dirname, '..', valor);
}

const db = new Database(caminhoDoBanco());
db.pragma('foreign_keys = ON');
// Se outra conexão estiver no meio de uma transação, espera até 5s em vez de falhar na hora.
db.pragma('busy_timeout = 5000');

function criarTabelas() {
  db.exec(fs.readFileSync(SCHEMA, 'utf8'));
}

module.exports = { db, criarTabelas, caminhoDoBanco };
