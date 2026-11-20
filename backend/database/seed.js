// Popula o banco com dados fictícios para teste e demonstração.
// Uso: npm run seed (apaga tudo e recria)
require('dotenv').config({ quiet: true });
const bcrypt = require('bcryptjs');
const { db, criarTabelas } = require('../src/db');
const { dataRelativa } = require('../src/utils/datas');

const SENHA_PADRAO = 'senha123';

// As datas são relativas ao dia de hoje para a demonstração sempre ter
// reservas futuras, independente de quando o seed for rodado.
const data = dataRelativa;

function inserir(sql, ...valores) {
  return db.prepare(sql).run(...valores).lastInsertRowid;
}

function historico(solicitacaoId, atorId, acao, anterior, novo, justificativa = null) {
  inserir(
    `INSERT INTO aprovacao_historico (solicitacao_id, ator_id, acao, status_anterior, status_novo, justificativa)
     VALUES (?, ?, ?, ?, ?, ?)`,
    solicitacaoId, atorId, acao, anterior, novo, justificativa
  );
}

function notificar(usuarioId, mensagem, link) {
  inserir('INSERT INTO notificacao (usuario_id, mensagem, link) VALUES (?, ?, ?)', usuarioId, mensagem, link);
}

function criarAtividade(titulo, tipo, descricao, responsavelId, publico, inicio, fim, status) {
  return inserir(
    `INSERT INTO atividade (titulo, tipo, descricao, responsavel_id, publico_estimado, inicio, fim, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    titulo, tipo, descricao, responsavelId, publico, inicio, fim, status
  );
}

function criarSolicitacao(atividadeId, solicitanteId, status, motivo) {
  return inserir(
    'INSERT INTO solicitacao (atividade_id, solicitante_id, status, motivo) VALUES (?, ?, ?, ?)',
    atividadeId, solicitanteId, status, motivo
  );
}

function reservarEspaco(solicitacaoId, espacoId, inicio, fim, status, justificativa = null) {
  return inserir(
    `INSERT INTO reserva_espaco (solicitacao_id, espaco_id, inicio, fim, status, justificativa)
     VALUES (?, ?, ?, ?, ?, ?)`,
    solicitacaoId, espacoId, inicio, fim, status, justificativa
  );
}

function reservarEquipamento(solicitacaoId, equipamentoId, inicio, fim, quantidade, status) {
  return inserir(
    `INSERT INTO reserva_equipamento (solicitacao_id, equipamento_id, inicio, fim, quantidade, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    solicitacaoId, equipamentoId, inicio, fim, quantidade, status
  );
}

function popular() {
  // Perfis e permissões
  const perfis = {
    solicitante: inserir('INSERT INTO perfil (nome, permissoes) VALUES (?, ?)',
      'Solicitante', 'solicitar'),
    gestor: inserir('INSERT INTO perfil (nome, permissoes) VALUES (?, ?)',
      'Gestor de Espaços', 'solicitar,ver_todas,gerenciar_espacos,decidir_espaco,bloquear'),
    equipamentos: inserir('INSERT INTO perfil (nome, permissoes) VALUES (?, ?)',
      'Responsável por Equipamentos', 'ver_todas,gerenciar_equipamentos,decidir_equipamento,movimentar,bloquear'),
    admin: inserir('INSERT INTO perfil (nome, permissoes) VALUES (?, ?)',
      'Administrador', 'solicitar,ver_todas,gerenciar_espacos,decidir_espaco,bloquear,' +
      'gerenciar_equipamentos,decidir_equipamento,movimentar,gerenciar_usuarios,parametros,auditoria')
  };

  // Usuários (todos com a mesma senha de teste)
  const hash = bcrypt.hashSync(SENHA_PADRAO, 10);
  const novoUsuario = (nome, email, perfilId, ativo = 1) =>
    inserir('INSERT INTO usuario (nome, email, senha_hash, perfil_id, ativo) VALUES (?, ?, ?, ?, ?)',
      nome, email, hash, perfilId, ativo);

  const admin = novoUsuario('Marta Souza', 'admin@exemplo.edu.br', perfis.admin);
  const gestor = novoUsuario('Roberto Lima', 'gestor@exemplo.edu.br', perfis.gestor);
  const respEquip = novoUsuario('Júlio Pereira', 'equipamentos@exemplo.edu.br', perfis.equipamentos);
  const docente = novoUsuario('Prof. Carlos Mendes', 'docente@exemplo.edu.br', perfis.solicitante);
  const aluno = novoUsuario('Ana Beatriz Rocha', 'aluno@exemplo.edu.br', perfis.solicitante);
  novoUsuario('Pedro Alves', 'inativo@exemplo.edu.br', perfis.solicitante, 0);

  // Parâmetros (valores de teste, não são regras oficiais)
  const parametros = [
    ['intervalo_tecnico_min', '0', 'Minutos de montagem/desmontagem entre duas reservas do mesmo recurso'],
    ['horario_abertura', '07:00', 'Horário em que a unidade abre'],
    ['horario_fechamento', '23:00', 'Horário em que a unidade fecha'],
    ['antecedencia_min_horas', '24', 'Antecedência mínima para enviar uma solicitação']
  ];
  for (const [chave, valor, descricao] of parametros) {
    inserir('INSERT INTO parametro (chave, valor, descricao) VALUES (?, ?, ?)', chave, valor, descricao);
  }

  // Espaços
  const auditorio = inserir('INSERT INTO espaco (nome, localizacao, capacidade) VALUES (?, ?, ?)',
    'Auditório', 'Bloco A - Térreo', 120);
  const sala101 = inserir('INSERT INTO espaco (nome, localizacao, capacidade) VALUES (?, ?, ?)',
    'Sala 101', 'Bloco A - 1º andar', 40);
  const lab3 = inserir('INSERT INTO espaco (nome, localizacao, capacidade) VALUES (?, ?, ?)',
    'Laboratório 3', 'Bloco B - 2º andar', 30);
  const salaReunioes = inserir('INSERT INTO espaco (nome, localizacao, capacidade) VALUES (?, ?, ?)',
    'Sala de Reuniões', 'Bloco C - Térreo', 12);

  // Categorias e equipamentos
  const cat = {};
  for (const nome of ['Projetor', 'Microfone', 'Notebook', 'Áudio', 'Cabos e acessórios']) {
    cat[nome] = inserir('INSERT INTO categoria (nome) VALUES (?)', nome);
  }

  const novoEquip = (codigo, nome, categoriaId, local, situacao = 'operacional', tipo = 'individual', qtd = 1) =>
    inserir(
      `INSERT INTO equipamento (codigo_patrimonio, nome, categoria_id, localizacao, situacao, tipo_controle, quantidade_total)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      codigo, nome, categoriaId, local, situacao, tipo, qtd
    );

  const projetor1 = novoEquip('PAT-0001', 'Projetor Epson PowerLite', cat['Projetor'], 'Almoxarifado');
  const projetor2 = novoEquip('PAT-0002', 'Projetor BenQ MX550', cat['Projetor'], 'Almoxarifado');
  novoEquip('PAT-0003', 'Projetor Epson X41', cat['Projetor'], 'Almoxarifado', 'avariado');
  const microfone1 = novoEquip('PAT-0101', 'Microfone sem fio Shure', cat['Microfone'], 'Secretaria');
  novoEquip('PAT-0102', 'Microfone sem fio Shure', cat['Microfone'], 'Secretaria');
  const notebook = novoEquip('PAT-0201', 'Notebook Dell Latitude', cat['Notebook'], 'Almoxarifado');
  novoEquip('PAT-0301', 'Caixa de som JBL', cat['Áudio'], 'Almoxarifado', 'manutencao');
  novoEquip('ACE-HDMI', 'Cabo HDMI 3m', cat['Cabos e acessórios'], 'Almoxarifado', 'operacional', 'quantidade', 10);
  novoEquip('ACE-EXT', 'Extensão elétrica 5m', cat['Cabos e acessórios'], 'Almoxarifado', 'operacional', 'quantidade', 5);

  // 1) Aprovada: palestra no auditório das 14h às 16h (usada no roteiro de demonstração)
  let ini = data(3, '14:00');
  let fim = data(3, '16:00');
  let atv = criarAtividade('Palestra: Carreira em TI', 'palestra',
    'Bate-papo com egressos sobre o mercado de trabalho.', docente, 100, ini, fim, 'confirmada');
  let sol = criarSolicitacao(atv, docente, 'aprovada', 'Evento aberto para todos os cursos.');
  reservarEspaco(sol, auditorio, ini, fim, 'aprovada');
  reservarEquipamento(sol, projetor1, ini, fim, 1, 'aprovada');
  reservarEquipamento(sol, microfone1, ini, fim, 1, 'aprovada');
  historico(sol, docente, 'criar', null, 'rascunho');
  historico(sol, docente, 'enviar', 'rascunho', 'pendente');
  historico(sol, gestor, 'aprovar', 'pendente', 'aprovada');
  historico(sol, respEquip, 'aprovar_equipamento', null, null, 'PAT-0001 aprovado');
  historico(sol, respEquip, 'aprovar_equipamento', null, null, 'PAT-0101 aprovado');
  notificar(docente, `Sua solicitação #${sol} (Palestra: Carreira em TI) foi aprovada.`, `solicitacao.html?id=${sol}`);

  // 2) Pendente: oficina na Sala 101 com notebook
  ini = data(5, '19:00');
  fim = data(5, '21:00');
  atv = criarAtividade('Oficina de Git e GitHub', 'oficina',
    'Oficina prática de versionamento para alunos do 1º semestre.', aluno, 30, ini, fim, 'planejada');
  sol = criarSolicitacao(atv, aluno, 'pendente', 'Oficina organizada pelo grupo de estudos.');
  reservarEspaco(sol, sala101, ini, fim, 'pendente');
  reservarEquipamento(sol, notebook, ini, fim, 1, 'pendente');
  historico(sol, aluno, 'criar', null, 'rascunho');
  historico(sol, aluno, 'enviar', 'rascunho', 'pendente');
  notificar(gestor, `Nova solicitação #${sol} aguardando análise.`, `solicitacao.html?id=${sol}`);

  // 3) Rascunho: ainda não enviada, não ocupa a agenda
  ini = data(7, '10:00');
  fim = data(7, '11:00');
  atv = criarAtividade('Reunião do projeto de extensão', 'reuniao',
    'Alinhamento das próximas ações do projeto.', aluno, 8, ini, fim, 'planejada');
  sol = criarSolicitacao(atv, aluno, 'rascunho', null);
  reservarEspaco(sol, salaReunioes, ini, fim, 'pendente');
  historico(sol, aluno, 'criar', null, 'rascunho');

  // 4) Em ajustes: devolvida pelo gestor
  ini = data(4, '08:00');
  fim = data(4, '12:00');
  atv = criarAtividade('Minicurso de Python', 'minicurso',
    'Introdução à linguagem Python com exercícios.', docente, 28, ini, fim, 'planejada');
  sol = criarSolicitacao(atv, docente, 'em_ajustes', null);
  reservarEspaco(sol, lab3, ini, fim, 'pendente');
  reservarEquipamento(sol, projetor2, ini, fim, 1, 'pendente');
  historico(sol, docente, 'criar', null, 'rascunho');
  historico(sol, docente, 'enviar', 'rascunho', 'pendente');
  historico(sol, gestor, 'devolver', 'pendente', 'em_ajustes',
    'O laboratório tem aula até 08:30. Favor começar às 09:00.');
  notificar(docente, `Sua solicitação #${sol} (Minicurso de Python) foi devolvida para ajustes.`, `solicitacao.html?id=${sol}`);

  // 5) Rejeitada: pediu o auditório em horário que conflita com a palestra
  ini = data(3, '15:00');
  fim = data(3, '17:00');
  atv = criarAtividade('Mostra cultural', 'cultural',
    'Apresentações musicais dos alunos.', aluno, 80, ini, fim, 'cancelada');
  sol = criarSolicitacao(atv, aluno, 'rejeitada', null);
  reservarEspaco(sol, auditorio, ini, fim, 'rejeitada', 'Auditório já reservado das 14:00 às 16:00.');
  historico(sol, aluno, 'criar', null, 'rascunho');
  historico(sol, aluno, 'enviar', 'rascunho', 'pendente');
  historico(sol, gestor, 'rejeitar', 'pendente', 'rejeitada',
    'Auditório já reservado das 14:00 às 16:00. Sugiro outro dia.');
  notificar(aluno, `Sua solicitação #${sol} (Mostra cultural) foi rejeitada.`, `solicitacao.html?id=${sol}`);

  // 6) Cancelada pelo solicitante
  ini = data(2, '19:00');
  fim = data(2, '22:00');
  atv = criarAtividade('Seminário de IoT', 'seminario',
    'Seminário sobre internet das coisas.', docente, 35, ini, fim, 'cancelada');
  sol = criarSolicitacao(atv, docente, 'cancelada', null);
  reservarEspaco(sol, sala101, ini, fim, 'cancelada');
  historico(sol, docente, 'criar', null, 'rascunho');
  historico(sol, docente, 'enviar', 'rascunho', 'pendente');
  historico(sol, gestor, 'aprovar', 'pendente', 'aprovada');
  historico(sol, docente, 'cancelar', 'aprovada', 'cancelada', 'O palestrante não poderá comparecer.');

  // 7) Concluída: atividade já realizada, com retirada e devolução do projetor
  ini = data(-5, '14:00');
  fim = data(-5, '17:00');
  atv = criarAtividade('Workshop de Linux', 'oficina',
    'Comandos básicos de terminal.', docente, 25, ini, fim, 'concluida');
  sol = criarSolicitacao(atv, docente, 'concluida', null);
  reservarEspaco(sol, lab3, ini, fim, 'concluida');
  const resProjetor = reservarEquipamento(sol, projetor2, ini, fim, 1, 'devolvido');
  inserir(`INSERT INTO movimentacao (reserva_equipamento_id, tipo, responsavel_id, data_hora, condicao)
           VALUES (?, 'retirada', ?, ?, 'ok')`, resProjetor, respEquip, data(-5, '13:40'));
  inserir(`INSERT INTO movimentacao (reserva_equipamento_id, tipo, responsavel_id, data_hora, condicao)
           VALUES (?, 'devolucao', ?, ?, 'ok')`, resProjetor, respEquip, data(-5, '17:10'));
  historico(sol, docente, 'criar', null, 'rascunho');
  historico(sol, docente, 'enviar', 'rascunho', 'pendente');
  historico(sol, gestor, 'aprovar', 'pendente', 'aprovada');
  historico(sol, gestor, 'concluir', 'aprovada', 'concluida');

  // Bloqueios
  inserir(`INSERT INTO bloqueio_recurso (espaco_id, inicio, fim, motivo, criado_por) VALUES (?, ?, ?, ?, ?)`,
    lab3, data(6, '07:00'), data(6, '23:00'), 'Manutenção do ar-condicionado', gestor);
  inserir(`INSERT INTO bloqueio_recurso (equipamento_id, inicio, fim, motivo, criado_por) VALUES (?, ?, ?, ?, ?)`,
    projetor2, data(10, '07:00'), data(10, '23:00'), 'Revisão preventiva', respEquip);

  inserir(`INSERT INTO auditoria (usuario_id, acao, entidade, detalhes) VALUES (?, ?, ?, ?)`,
    admin, 'seed', 'sistema', 'Banco criado com dados de demonstração');
}

function executarSeed() {
  criarTabelas();
  db.transaction(popular)();
}

if (require.main === module) {
  executarSeed();
  console.log('Banco criado e populado com sucesso.');
  console.log(`Senha de todos os usuários de teste: ${SENHA_PADRAO}`);
}

module.exports = { executarSeed, SENHA_PADRAO };
