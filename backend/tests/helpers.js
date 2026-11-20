// Configuração comum dos testes: banco em memória, recriado pelo seed.
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'segredo-usado-so-nos-testes';

const request = require('supertest');
const app = require('../src/app');
const { db } = require('../src/db');
const { executarSeed, SENHA_PADRAO } = require('../database/seed');
const { dataRelativa } = require('../src/utils/datas');

const EMAILS = {
  admin: 'admin@exemplo.edu.br',
  gestor: 'gestor@exemplo.edu.br',
  equipamentos: 'equipamentos@exemplo.edu.br',
  docente: 'docente@exemplo.edu.br',
  aluno: 'aluno@exemplo.edu.br'
};

function resetarBanco() {
  executarSeed();
}

// O agent do supertest guarda o cookie do login, como um navegador.
async function entrar(email) {
  const agente = request.agent(app);
  const res = await agente.post('/api/auth/login').send({ email, senha: SENHA_PADRAO });
  if (res.status !== 200) throw new Error(`Falha no login de ${email}: ${res.body.erro}`);
  return agente;
}

async function entrarComTodos() {
  const usuarios = {};
  for (const [perfil, email] of Object.entries(EMAILS)) {
    usuarios[perfil] = await entrar(email);
  }
  return usuarios;
}

function idEspaco(nome) {
  return db.prepare('SELECT id FROM espaco WHERE nome = ?').get(nome).id;
}

function idEquipamento(codigo) {
  return db.prepare('SELECT id FROM equipamento WHERE codigo_patrimonio = ?').get(codigo).id;
}

// Corpo padrão de uma solicitação; cada teste muda só o que precisa.
function novaSolicitacao(dados = {}) {
  return {
    titulo: 'Evento de teste',
    tipo: 'palestra',
    descricao: 'Descrição do evento de teste',
    publico_estimado: 50,
    inicio: dataRelativa(3, '16:00'),
    fim: dataRelativa(3, '18:00'),
    espaco_id: idEspaco('Auditório'),
    equipamentos: [],
    enviar: true,
    ...dados
  };
}

module.exports = {
  app,
  db,
  request,
  dataRelativa,
  resetarBanco,
  entrar,
  entrarComTodos,
  idEspaco,
  idEquipamento,
  novaSolicitacao
};
