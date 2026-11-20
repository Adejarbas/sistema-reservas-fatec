const { describe, test, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

describe('Retirada e devolução de equipamentos', () => {
  let u;

  before(async () => {
    h.resetarBanco();
    u = await h.entrarComTodos();
  });
  beforeEach(() => h.resetarBanco());

  // Reserva 1 do seed: projetor PAT-0001 aprovado para a palestra (solicitação #1).
  const RESERVA_PROJETOR = 1;

  test('CA-10: retirada registra responsável e horário da entrega', async () => {
    const res = await u.equipamentos.post('/api/movimentacoes').send({
      reserva_equipamento_id: RESERVA_PROJETOR, tipo: 'retirada', condicao: 'ok'
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.tipo, 'retirada');
    assert.equal(res.body.responsavel, 'Júlio Pereira');
    assert.match(res.body.data_hora, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);

    const detalhe = await u.docente.get('/api/solicitacoes/1');
    assert.equal(detalhe.body.equipamentos[0].status, 'retirado');
    assert.equal(detalhe.body.historico.at(-1).acao, 'retirada');
  });

  test('CA-11: equipamento devolvido com avaria fica indisponível', async () => {
    await u.equipamentos.post('/api/movimentacoes').send({
      reserva_equipamento_id: RESERVA_PROJETOR, tipo: 'retirada', condicao: 'ok'
    });
    const devolucao = await u.equipamentos.post('/api/movimentacoes').send({
      reserva_equipamento_id: RESERVA_PROJETOR, tipo: 'devolucao', condicao: 'avariado', observacao: 'Lâmpada queimada.'
    });

    assert.equal(devolucao.status, 201);
    assert.equal(devolucao.body.condicao, 'avariado');

    const equipamento = await u.equipamentos.get(`/api/equipamentos/${h.idEquipamento('PAT-0001')}`);
    assert.equal(equipamento.body.situacao, 'avariado');

    const novaReserva = await u.aluno.post('/api/solicitacoes').send(h.novaSolicitacao({
      espaco_id: null,
      inicio: h.dataRelativa(12, '08:00'),
      fim: h.dataRelativa(12, '10:00'),
      equipamentos: [{ equipamento_id: h.idEquipamento('PAT-0001'), quantidade: 1 }]
    }));
    assert.equal(novaReserva.status, 409);
    assert.match(novaReserva.body.erro, /avariado/);
  });

  test('não é possível retirar equipamento que ainda não foi aprovado', async () => {
    // Reserva do notebook da solicitação #2 (pendente).
    const notebook = h.db.prepare('SELECT id FROM reserva_equipamento WHERE solicitacao_id = 2').get().id;
    const res = await u.equipamentos.post('/api/movimentacoes').send({
      reserva_equipamento_id: notebook, tipo: 'retirada', condicao: 'ok'
    });

    assert.equal(res.status, 409);
  });

  test('não é possível devolver o que não foi retirado nem retirar duas vezes', async () => {
    const devolverAntes = await u.equipamentos.post('/api/movimentacoes').send({
      reserva_equipamento_id: RESERVA_PROJETOR, tipo: 'devolucao', condicao: 'ok'
    });
    assert.equal(devolverAntes.status, 409);

    await u.equipamentos.post('/api/movimentacoes').send({ reserva_equipamento_id: RESERVA_PROJETOR, tipo: 'retirada', condicao: 'ok' });
    const retirarDeNovo = await u.equipamentos.post('/api/movimentacoes').send({
      reserva_equipamento_id: RESERVA_PROJETOR, tipo: 'retirada', condicao: 'ok'
    });
    assert.equal(retirarDeNovo.status, 409);
  });

  test('equipamento retirado e não devolvido continua ocupado depois do horário', async () => {
    await u.equipamentos.post('/api/movimentacoes').send({ reserva_equipamento_id: RESERVA_PROJETOR, tipo: 'retirada', condicao: 'ok' });

    // Pedido para o mesmo dia, depois do fim previsto (16h).
    const res = await u.aluno.post('/api/solicitacoes').send(h.novaSolicitacao({
      espaco_id: null,
      inicio: h.dataRelativa(3, '18:00'),
      fim: h.dataRelativa(3, '20:00'),
      equipamentos: [{ equipamento_id: h.idEquipamento('PAT-0001'), quantidade: 1 }]
    }));
    assert.equal(res.status, 409);
    assert.match(res.body.erro, /retirado e ainda não foi devolvido/);
  });

  test('não é possível cancelar com equipamento retirado sem devolução', async () => {
    await u.equipamentos.post('/api/movimentacoes').send({ reserva_equipamento_id: RESERVA_PROJETOR, tipo: 'retirada', condicao: 'ok' });
    const res = await u.docente.patch('/api/solicitacoes/1/cancelar').send({ motivo: 'Teste' });

    assert.equal(res.status, 409);
    assert.match(res.body.erro, /Registre a devolução/);
  });

  test('fluxo completo: solicitar, devolver p/ ajuste, reenviar, aprovar, retirar e devolver', async () => {
    const projetor = h.idEquipamento('PAT-0002');
    const corpo = {
      titulo: 'Semana de Tecnologia',
      espaco_id: h.idEspaco('Auditório'),
      publico_estimado: 110,
      inicio: h.dataRelativa(9, '09:00'),
      fim: h.dataRelativa(9, '11:00'),
      equipamentos: [{ equipamento_id: projetor, quantidade: 1 }]
    };

    const criada = await u.docente.post('/api/solicitacoes').send(h.novaSolicitacao(corpo));
    assert.equal(criada.status, 201);
    assert.equal(criada.body.status, 'pendente');
    const id = criada.body.id;

    const devolvida = await u.gestor.patch(`/api/solicitacoes/${id}/devolver`).send({ justificativa: 'Começar às 09:30.' });
    assert.equal(devolvida.body.status, 'em_ajustes');

    const reenviada = await u.docente.put(`/api/solicitacoes/${id}`).send(h.novaSolicitacao({
      ...corpo, inicio: h.dataRelativa(9, '09:30')
    }));
    assert.equal(reenviada.body.status, 'pendente');

    const aprovada = await u.gestor.patch(`/api/solicitacoes/${id}/aprovar`).send({});
    assert.equal(aprovada.body.status, 'aprovada');

    const reservaProjetor = aprovada.body.equipamentos[0].id;
    const equipAprovado = await u.equipamentos.patch(`/api/reservas-equipamento/${reservaProjetor}/aprovar`);
    assert.equal(equipAprovado.status, 200);

    const retirada = await u.equipamentos.post('/api/movimentacoes').send({
      reserva_equipamento_id: reservaProjetor, tipo: 'retirada', condicao: 'ok'
    });
    assert.equal(retirada.status, 201);

    const devolucao = await u.equipamentos.post('/api/movimentacoes').send({
      reserva_equipamento_id: reservaProjetor, tipo: 'devolucao', condicao: 'ok'
    });
    assert.equal(devolucao.status, 201);

    const final = await u.docente.get(`/api/solicitacoes/${id}`);
    assert.equal(final.body.equipamentos[0].status, 'devolvido');
    assert.equal(final.body.movimentacoes.length, 2);
    const acoes = final.body.historico.map((item) => item.acao);
    assert.deepEqual(acoes, ['criar', 'enviar', 'devolver', 'editar', 'reenviar', 'aprovar',
      'aprovar_equipamento', 'retirada', 'devolucao']);
  });
});
