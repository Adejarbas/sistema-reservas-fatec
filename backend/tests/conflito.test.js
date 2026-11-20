const { describe, test, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');
const { sobrepoe } = require('../src/services/disponibilidadeService');

describe('Conflito de horário (RN-04)', () => {
  let u;

  before(async () => {
    h.resetarBanco();
    u = await h.entrarComTodos();
  });
  beforeEach(() => h.resetarBanco());

  test('regra de sobreposição: inicioA < fimB e inicioB < fimA', () => {
    assert.equal(sobrepoe('2026-01-10T14:00', '2026-01-10T16:00', '2026-01-10T15:00', '2026-01-10T17:00'), true);
    assert.equal(sobrepoe('2026-01-10T14:00', '2026-01-10T16:00', '2026-01-10T13:00', '2026-01-10T14:30'), true);
    assert.equal(sobrepoe('2026-01-10T14:00', '2026-01-10T16:00', '2026-01-10T14:30', '2026-01-10T15:30'), true);
    assert.equal(sobrepoe('2026-01-10T14:00', '2026-01-10T16:00', '2026-01-10T16:00', '2026-01-10T18:00'), false);
    assert.equal(sobrepoe('2026-01-10T14:00', '2026-01-10T16:00', '2026-01-10T12:00', '2026-01-10T14:00'), false);
  });

  // No seed, o Auditório já está aprovado das 14:00 às 16:00 daqui a 3 dias.
  test('CA-01: auditório reservado das 14h às 16h bloqueia pedido das 15h às 17h', async () => {
    const res = await u.aluno.post('/api/solicitacoes').send(h.novaSolicitacao({
      inicio: h.dataRelativa(3, '15:00'),
      fim: h.dataRelativa(3, '17:00')
    }));

    assert.equal(res.status, 409);
    assert.match(res.body.erro, /Auditório já está reservado das 14:00 às 16:00/);
  });

  test('CA-01: sobreposição parcial no começo e pedido que engloba a reserva também são bloqueados', async () => {
    const comecoAntes = await u.aluno.post('/api/solicitacoes').send(h.novaSolicitacao({
      inicio: h.dataRelativa(3, '13:00'),
      fim: h.dataRelativa(3, '14:30')
    }));
    const engloba = await u.aluno.post('/api/solicitacoes').send(h.novaSolicitacao({
      inicio: h.dataRelativa(3, '13:00'),
      fim: h.dataRelativa(3, '18:00')
    }));

    assert.equal(comecoAntes.status, 409);
    assert.equal(engloba.status, 409);
  });

  test('CA-02: reserva encostada (16h às 18h) é permitida sem intervalo técnico', async () => {
    const res = await u.aluno.post('/api/solicitacoes').send(h.novaSolicitacao({
      inicio: h.dataRelativa(3, '16:00'),
      fim: h.dataRelativa(3, '18:00')
    }));

    assert.equal(res.status, 201);
    assert.equal(res.body.status, 'pendente');
  });

  test('com intervalo técnico de 30 min, a reserva encostada passa a conflitar', async () => {
    const param = await u.admin.put('/api/parametros/intervalo_tecnico_min').send({ valor: '30' });
    assert.equal(param.status, 200);

    const res = await u.aluno.post('/api/solicitacoes').send(h.novaSolicitacao({
      inicio: h.dataRelativa(3, '16:00'),
      fim: h.dataRelativa(3, '18:00')
    }));

    assert.equal(res.status, 409);
    assert.match(res.body.erro, /30 minutos de intervalo/);
  });

  test('a verificação é refeita na aprovação: o segundo pedido pendente do mesmo horário não é aprovado', async () => {
    const sala = h.idEspaco('Sala 101');
    const corpo = { espaco_id: sala, publico_estimado: 20, inicio: h.dataRelativa(8, '10:00'), fim: h.dataRelativa(8, '12:00') };

    const a = await u.aluno.post('/api/solicitacoes').send(h.novaSolicitacao(corpo));
    const b = await u.docente.post('/api/solicitacoes').send(h.novaSolicitacao({
      ...corpo, inicio: h.dataRelativa(8, '11:00'), fim: h.dataRelativa(8, '13:00')
    }));
    // Pendente não bloqueia a agenda, então os dois pedidos são aceitos.
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);

    const primeira = await u.gestor.patch(`/api/solicitacoes/${a.body.id}/aprovar`).send({});
    const segunda = await u.gestor.patch(`/api/solicitacoes/${b.body.id}/aprovar`).send({});

    assert.equal(primeira.status, 200);
    assert.equal(segunda.status, 409);
    assert.match(segunda.body.erro, /Sala 101 já está reservado das 10:00 às 12:00/);
  });

  test('RN-05: espaço com bloqueio no período não pode ser reservado', async () => {
    // No seed, o Laboratório 3 está bloqueado o dia todo daqui a 6 dias.
    const res = await u.aluno.post('/api/solicitacoes').send(h.novaSolicitacao({
      espaco_id: h.idEspaco('Laboratório 3'),
      publico_estimado: 20,
      inicio: h.dataRelativa(6, '10:00'),
      fim: h.dataRelativa(6, '12:00')
    }));

    assert.equal(res.status, 409);
    assert.match(res.body.erro, /bloqueado .*Manutenção do ar-condicionado/);
  });

  test('consulta de disponibilidade mostra ocupado e livre', async () => {
    const ocupado = await u.aluno.get('/api/disponibilidade/verificar').query({
      espaco_id: h.idEspaco('Auditório'), inicio: h.dataRelativa(3, '15:00'), fim: h.dataRelativa(3, '17:00')
    });
    const livre = await u.aluno.get('/api/disponibilidade/verificar').query({
      espaco_id: h.idEspaco('Auditório'), inicio: h.dataRelativa(3, '16:00'), fim: h.dataRelativa(3, '18:00')
    });

    assert.equal(ocupado.body.disponivel, false);
    assert.equal(livre.body.disponivel, true);
  });
});
