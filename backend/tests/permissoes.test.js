const { describe, test, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

describe('Autenticação e controle de acesso', () => {
  let u;

  before(async () => {
    h.resetarBanco();
    u = await h.entrarComTodos();
  });
  beforeEach(() => h.resetarBanco());

  test('login com senha errada e usuário inativo são recusados', async () => {
    const errada = await h.request(h.app).post('/api/auth/login').send({ email: 'aluno@exemplo.edu.br', senha: 'xxx' });
    const inativo = await h.request(h.app).post('/api/auth/login').send({ email: 'inativo@exemplo.edu.br', senha: 'senha123' });

    assert.equal(errada.status, 401);
    assert.equal(inativo.status, 403);
  });

  test('rotas protegidas sem login retornam 401', async () => {
    const res = await h.request(h.app).get('/api/solicitacoes');
    assert.equal(res.status, 401);
  });

  test('o cookie de sessão é httpOnly', async () => {
    const res = await h.request(h.app).post('/api/auth/login').send({ email: 'aluno@exemplo.edu.br', senha: 'senha123' });
    assert.match(res.headers['set-cookie'][0], /HttpOnly/);
  });

  test('usuário comum que tenta a URL de aprovação recebe 403', async () => {
    const res = await u.aluno.patch('/api/solicitacoes/2/aprovar').send({});

    assert.equal(res.status, 403);
    const solicitacao = await u.gestor.get('/api/solicitacoes/2');
    assert.equal(solicitacao.body.status, 'pendente');
  });

  test('usuário sem permissão recebe 403 nas rotas restritas', async () => {
    const tentativas = [
      u.aluno.get('/api/usuarios'),
      u.aluno.post('/api/espacos').send({ nome: 'Sala X', capacidade: 10 }),
      u.aluno.post('/api/equipamentos').send({ codigo_patrimonio: 'X1', nome: 'X', categoria_id: 1 }),
      u.aluno.post('/api/bloqueios').send({}),
      u.aluno.post('/api/movimentacoes').send({}),
      u.aluno.patch('/api/solicitacoes/2/rejeitar').send({ justificativa: 'x' }),
      u.aluno.get('/api/auditoria'),
      u.docente.patch('/api/reservas-equipamento/4/aprovar'),
      u.gestor.post('/api/movimentacoes').send({}),
      u.equipamentos.post('/api/espacos').send({ nome: 'Sala Y', capacidade: 10 })
    ];

    for (const res of await Promise.all(tentativas)) {
      assert.equal(res.status, 403, `${res.req.method} ${res.req.path} deveria ser 403`);
    }
  });

  test('solicitante não vê solicitação de outra pessoa', async () => {
    const res = await u.aluno.get('/api/solicitacoes/1'); // é do docente
    assert.equal(res.status, 403);

    const lista = await u.aluno.get('/api/solicitacoes');
    assert.ok(lista.body.every((s) => s.solicitante === 'Ana Beatriz Rocha'));
  });

  test('RNF-03: gestor não pode aprovar a própria solicitação', async () => {
    const propria = await u.gestor.post('/api/solicitacoes').send(h.novaSolicitacao({ publico_estimado: 10 }));
    assert.equal(propria.status, 201);

    const res = await u.gestor.patch(`/api/solicitacoes/${propria.body.id}/aprovar`).send({});
    assert.equal(res.status, 403);
    assert.match(res.body.erro, /própria solicitação/);
  });

  test('cadastro de espaço e equipamento pelos perfis responsáveis', async () => {
    const espaco = await u.gestor.post('/api/espacos').send({ nome: 'Sala 202', localizacao: 'Bloco A', capacidade: 45 });
    assert.equal(espaco.status, 201);

    const equipamento = await u.equipamentos.post('/api/equipamentos').send({
      codigo_patrimonio: 'pat-0500', nome: 'Webcam Logitech', categoria_id: 1
    });
    assert.equal(equipamento.status, 201);
    assert.equal(equipamento.body.codigo_patrimonio, 'PAT-0500');
    assert.equal(equipamento.body.situacao, 'operacional');

    const duplicado = await u.equipamentos.post('/api/equipamentos').send({
      codigo_patrimonio: 'PAT-0500', nome: 'Outra', categoria_id: 1
    });
    assert.equal(duplicado.status, 409);
  });

  test('bloqueio sobre reserva aprovada avisa as reservas afetadas', async () => {
    const res = await u.gestor.post('/api/bloqueios').send({
      espaco_id: h.idEspaco('Auditório'),
      inicio: h.dataRelativa(3, '07:00'),
      fim: h.dataRelativa(3, '23:00'),
      motivo: 'Dedetização'
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.reservasAfetadas.length, 1);
    assert.match(res.body.aviso, /1 reserva\(s\) aprovada\(s\)/);
  });

  test('alterações administrativas ficam na auditoria', async () => {
    await u.gestor.post('/api/espacos').send({ nome: 'Sala 303', capacidade: 30 });
    const res = await u.admin.get('/api/auditoria').query({ entidade: 'espaco' });

    assert.equal(res.status, 200);
    assert.equal(res.body[0].acao, 'criar');
    assert.equal(res.body[0].usuario, 'Roberto Lima');
  });
});
