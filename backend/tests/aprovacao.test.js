const { describe, test, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');
const h = require('./helpers');

describe('Fluxo de análise e aprovação', () => {
  let u;

  before(async () => {
    h.resetarBanco();
    u = await h.entrarComTodos();
  });
  beforeEach(() => h.resetarBanco());

  test('CA-07: rejeição sem justificativa é bloqueada', async () => {
    const semJustificativa = await u.gestor.patch('/api/solicitacoes/2/rejeitar').send({ justificativa: '   ' });

    assert.equal(semJustificativa.status, 400);
    assert.match(semJustificativa.body.erro, /justificativa é obrigatória/);
    const ainda = await u.gestor.get('/api/solicitacoes/2');
    assert.equal(ainda.body.status, 'pendente');
  });

  test('CA-07: rejeição com justificativa encerra a solicitação e registra no histórico', async () => {
    const res = await u.gestor.patch('/api/solicitacoes/2/rejeitar').send({ justificativa: 'Sala reservada para a semana de provas.' });

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'rejeitada');
    const ultimo = res.body.historico.at(-1);
    assert.equal(ultimo.acao, 'rejeitar');
    assert.equal(ultimo.ator, 'Roberto Lima');
    assert.equal(ultimo.justificativa, 'Sala reservada para a semana de provas.');
    assert.ok(res.body.espacos.every((r) => r.status === 'rejeitada'));
  });

  test('devolver para ajustes exige motivo e volta para pendente após a correção', async () => {
    const semMotivo = await u.gestor.patch('/api/solicitacoes/2/devolver').send({});
    assert.equal(semMotivo.status, 400);

    const devolvida = await u.gestor.patch('/api/solicitacoes/2/devolver').send({ justificativa: 'Informe o público correto.' });
    assert.equal(devolvida.body.status, 'em_ajustes');

    const corrigida = await u.aluno.put('/api/solicitacoes/2').send(h.novaSolicitacao({
      titulo: 'Oficina de Git e GitHub',
      espaco_id: h.idEspaco('Sala 101'),
      publico_estimado: 35,
      inicio: h.dataRelativa(5, '19:00'),
      fim: h.dataRelativa(5, '21:00'),
      enviar: true
    }));
    assert.equal(corrigida.status, 200);
    assert.equal(corrigida.body.status, 'pendente');
    assert.equal(corrigida.body.publico_estimado, 35);

    const acoes = corrigida.body.historico.map((item) => item.acao);
    assert.deepEqual(acoes.slice(-3), ['devolver', 'editar', 'reenviar']);
  });

  test('RN-18: aprovar o evento não aprova os equipamentos automaticamente', async () => {
    const res = await u.gestor.patch('/api/solicitacoes/2/aprovar').send({});

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'aprovada');
    assert.equal(res.body.espacos[0].status, 'aprovada');
    assert.equal(res.body.equipamentos[0].status, 'pendente');

    const equip = await u.equipamentos.patch(`/api/reservas-equipamento/${res.body.equipamentos[0].id}/aprovar`);
    assert.equal(equip.status, 200);
    assert.equal(equip.body.status, 'aprovada');
  });

  test('o solicitante é notificado da decisão', async () => {
    await u.gestor.patch('/api/solicitacoes/2/aprovar').send({});
    const res = await u.aluno.get('/api/notificacoes');

    assert.match(res.body.notificacoes[0].mensagem, /#2 .* foi aprovada/);
    assert.ok(res.body.naoLidas >= 1);
  });

  test('CA-08 / RN-09: alterar reserva aprovada revalida e volta para análise', async () => {
    const alterada = await u.docente.put('/api/solicitacoes/1').send(h.novaSolicitacao({
      titulo: 'Palestra: Carreira em TI',
      publico_estimado: 100,
      inicio: h.dataRelativa(3, '15:00'),
      fim: h.dataRelativa(3, '17:00')
    }));

    assert.equal(alterada.status, 200);
    assert.equal(alterada.body.status, 'pendente');
    assert.equal(alterada.body.historico.at(-1).acao, 'alterar');
  });

  test('CA-08: se a alteração gerar conflito, nada muda e a reserva continua aprovada', async () => {
    // Outro evento aprovado logo depois da palestra (16h às 18h).
    const outro = await u.aluno.post('/api/solicitacoes').send(h.novaSolicitacao());
    await u.gestor.patch(`/api/solicitacoes/${outro.body.id}/aprovar`).send({});

    const alterada = await u.docente.put('/api/solicitacoes/1').send(h.novaSolicitacao({
      titulo: 'Palestra: Carreira em TI',
      publico_estimado: 100,
      inicio: h.dataRelativa(3, '15:00'),
      fim: h.dataRelativa(3, '17:00')
    }));
    assert.equal(alterada.status, 409);

    const original = await u.docente.get('/api/solicitacoes/1');
    assert.equal(original.body.status, 'aprovada');
    assert.equal(original.body.inicio, h.dataRelativa(3, '14:00'));
  });

  test('CA-09 / RN-10: cancelamento exige motivo, libera a agenda e fica registrado', async () => {
    const semMotivo = await u.docente.patch('/api/solicitacoes/1/cancelar').send({});
    assert.equal(semMotivo.status, 400);

    const cancelada = await u.docente.patch('/api/solicitacoes/1/cancelar').send({ motivo: 'Palestrante indisponível.' });
    assert.equal(cancelada.status, 200);
    assert.equal(cancelada.body.status, 'cancelada');
    assert.equal(cancelada.body.historico.at(-1).justificativa, 'Palestrante indisponível.');

    // O horário que estava ocupado agora pode ser pedido por outra pessoa.
    const novo = await u.aluno.post('/api/solicitacoes').send(h.novaSolicitacao({
      inicio: h.dataRelativa(3, '14:00'),
      fim: h.dataRelativa(3, '16:00')
    }));
    assert.equal(novo.status, 201);
  });

  test('não é possível cancelar a solicitação de outra pessoa', async () => {
    const res = await u.aluno.patch('/api/solicitacoes/1/cancelar').send({ motivo: 'teste' });
    assert.equal(res.status, 403);
  });

  test('conclusão só depois do término da atividade', async () => {
    const antes = await u.gestor.patch('/api/solicitacoes/1/concluir');
    assert.equal(antes.status, 409);

    // Simula que a palestra já aconteceu.
    const ontem = { inicio: h.dataRelativa(-1, '14:00'), fim: h.dataRelativa(-1, '16:00') };
    h.db.prepare('UPDATE atividade SET inicio = ?, fim = ? WHERE id = 1').run(ontem.inicio, ontem.fim);
    h.db.prepare('UPDATE reserva_espaco SET inicio = ?, fim = ? WHERE solicitacao_id = 1').run(ontem.inicio, ontem.fim);

    const depois = await u.gestor.patch('/api/solicitacoes/1/concluir');
    assert.equal(depois.status, 200);
    assert.equal(depois.body.status, 'concluida');
  });

  test('CA-12: duas aprovações simultâneas do mesmo recurso não duplicam a alocação', async () => {
    const sala = h.idEspaco('Sala 101');
    const corpo = { espaco_id: sala, publico_estimado: 20, inicio: h.dataRelativa(8, '14:00'), fim: h.dataRelativa(8, '16:00') };
    const a = await u.aluno.post('/api/solicitacoes').send(h.novaSolicitacao(corpo));
    const b = await u.docente.post('/api/solicitacoes').send(h.novaSolicitacao(corpo));

    // Gestor e administrador aprovam ao mesmo tempo, cada um uma solicitação.
    const respostas = await Promise.all([
      u.gestor.patch(`/api/solicitacoes/${a.body.id}/aprovar`).send({}),
      u.admin.patch(`/api/solicitacoes/${b.body.id}/aprovar`).send({})
    ]);

    const status = respostas.map((r) => r.status).sort();
    assert.deepEqual(status, [200, 409]);

    const aprovadas = h.db.prepare(`
      SELECT COUNT(*) AS total FROM reserva_espaco
      WHERE espaco_id = ? AND status = 'aprovada' AND inicio < ? AND ? < fim`).get(sala, corpo.fim, corpo.inicio);
    assert.equal(aprovadas.total, 1);
  });

  test('CA-12: com BEGIN IMMEDIATE uma segunda conexão não consegue gravar no meio da aprovação', () => {
    const arquivo = path.join(os.tmpdir(), `reservas-teste-${process.pid}.db`);
    const conexao1 = new Database(arquivo);
    const conexao2 = new Database(arquivo, { timeout: 0 });

    try {
      conexao1.exec('CREATE TABLE IF NOT EXISTS t (x INTEGER)');
      conexao1.exec('BEGIN IMMEDIATE');
      conexao1.exec('INSERT INTO t VALUES (1)');

      // Enquanto a primeira transação está aberta, a segunda é recusada (SQLITE_BUSY).
      assert.throws(() => conexao2.exec('BEGIN IMMEDIATE'), /database is locked/);

      conexao1.exec('COMMIT');
      conexao2.exec('BEGIN IMMEDIATE');
      conexao2.exec('COMMIT');
    } finally {
      conexao1.close();
      conexao2.close();
      fs.rmSync(arquivo, { force: true });
    }
  });
});
