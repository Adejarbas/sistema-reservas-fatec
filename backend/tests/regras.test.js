const { describe, test, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

describe('Validações da solicitação', () => {
  let u;

  before(async () => {
    h.resetarBanco();
    u = await h.entrarComTodos();
  });
  beforeEach(() => h.resetarBanco());

  test('CA-03: público acima da capacidade do espaço é bloqueado', async () => {
    const res = await u.aluno.post('/api/solicitacoes').send(h.novaSolicitacao({ publico_estimado: 150 }));

    assert.equal(res.status, 409);
    assert.match(res.body.erro, /público estimado \(150 pessoas\) é maior que a capacidade .*Auditório \(120 pessoas\)/);
  });

  test('dados obrigatórios ausentes impedem o envio e indicam os campos', async () => {
    const res = await u.aluno.post('/api/solicitacoes').send(h.novaSolicitacao({ titulo: '', descricao: '' }));

    assert.equal(res.status, 400);
    assert.deepEqual(res.body.campos, ['titulo', 'descricao']);
  });

  test('RN-03: horário final igual ou anterior ao inicial é recusado', async () => {
    const res = await u.aluno.post('/api/solicitacoes').send(h.novaSolicitacao({
      inicio: h.dataRelativa(3, '18:00'),
      fim: h.dataRelativa(3, '18:00')
    }));

    assert.equal(res.status, 400);
    assert.match(res.body.erro, /posterior ao inicial/);
  });

  test('RN-07: fora do horário de funcionamento e sem antecedência mínima', async () => {
    const madrugada = await u.aluno.post('/api/solicitacoes').send(h.novaSolicitacao({
      inicio: h.dataRelativa(3, '05:00'),
      fim: h.dataRelativa(3, '06:00')
    }));
    const hoje = await u.aluno.post('/api/solicitacoes').send(h.novaSolicitacao({
      inicio: h.dataRelativa(0, '22:00'),
      fim: h.dataRelativa(0, '23:00')
    }));

    assert.equal(madrugada.status, 400);
    assert.match(madrugada.body.erro, /horário de funcionamento/);
    assert.equal(hoje.status, 400);
    assert.match(hoje.body.erro, /antecedência/);
  });

  test('rascunho é salvo sem checar conflito; a verificação acontece no envio', async () => {
    const rascunho = await u.aluno.post('/api/solicitacoes').send(h.novaSolicitacao({
      inicio: h.dataRelativa(3, '15:00'),
      fim: h.dataRelativa(3, '17:00'),
      enviar: false
    }));

    assert.equal(rascunho.status, 201);
    assert.equal(rascunho.body.status, 'rascunho');

    // O rascunho só é verificado quando for enviado.
    const envio = await u.aluno.patch(`/api/solicitacoes/${rascunho.body.id}/enviar`);
    assert.equal(envio.status, 409);
  });

  test('CA-04 / RN-14: equipamento em manutenção ou avariado não pode ser reservado', async () => {
    const manutencao = await u.aluno.post('/api/solicitacoes').send(h.novaSolicitacao({
      equipamentos: [{ equipamento_id: h.idEquipamento('PAT-0301'), quantidade: 1 }]
    }));
    const avariado = await u.aluno.post('/api/solicitacoes').send(h.novaSolicitacao({
      equipamentos: [{ equipamento_id: h.idEquipamento('PAT-0003'), quantidade: 1 }]
    }));

    assert.equal(manutencao.status, 409);
    assert.match(manutencao.body.erro, /está em manutenção e não pode ser reservado/);
    assert.equal(avariado.status, 409);
    assert.match(avariado.body.erro, /está avariado e não pode ser reservado/);
  });

  test('RN-12: equipamento individual não pode ter reservas sobrepostas', async () => {
    // O projetor PAT-0001 está aprovado das 14h às 16h daqui a 3 dias.
    const res = await u.aluno.post('/api/solicitacoes').send(h.novaSolicitacao({
      espaco_id: null,
      inicio: h.dataRelativa(3, '15:00'),
      fim: h.dataRelativa(3, '17:00'),
      equipamentos: [{ equipamento_id: h.idEquipamento('PAT-0001'), quantidade: 1 }]
    }));

    assert.equal(res.status, 409);
    assert.match(res.body.erro, /PAT-0001\) já está reservado/);
  });

  test('RN-13: item por quantidade não pode ficar com saldo negativo', async () => {
    const cabo = h.idEquipamento('ACE-HDMI'); // 10 unidades
    const periodo = { espaco_id: null, inicio: h.dataRelativa(9, '08:00'), fim: h.dataRelativa(9, '10:00') };

    const primeiro = await u.aluno.post('/api/solicitacoes').send(h.novaSolicitacao({
      ...periodo, equipamentos: [{ equipamento_id: cabo, quantidade: 8 }]
    }));
    const aprovacao = await u.equipamentos.patch(`/api/solicitacoes/${primeiro.body.id}/aprovar`).send({});
    assert.equal(aprovacao.status, 200);

    const segundo = await u.docente.post('/api/solicitacoes').send(h.novaSolicitacao({
      ...periodo, equipamentos: [{ equipamento_id: cabo, quantidade: 5 }]
    }));
    assert.equal(segundo.status, 409);
    assert.match(segundo.body.erro, /Só há 2 unidade\(s\) de Cabo HDMI/);

    const cabem = await u.docente.post('/api/solicitacoes').send(h.novaSolicitacao({
      ...periodo, equipamentos: [{ equipamento_id: cabo, quantidade: 2 }]
    }));
    assert.equal(cabem.status, 201);
  });

  test('transições inválidas são recusadas', async () => {
    // Seed: #3 está em rascunho e #5 está rejeitada.
    const aprovarRascunho = await u.gestor.patch('/api/solicitacoes/3/aprovar').send({});
    const aprovarRejeitada = await u.gestor.patch('/api/solicitacoes/5/aprovar').send({});
    const enviarPendente = await u.aluno.patch('/api/solicitacoes/2/enviar');

    assert.equal(aprovarRascunho.status, 409);
    assert.match(aprovarRascunho.body.erro, /de "Rascunho" para "Aprovada"/);
    assert.equal(aprovarRejeitada.status, 409);
    assert.equal(enviarPendente.status, 409);
  });
});
