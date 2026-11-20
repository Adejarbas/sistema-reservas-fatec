const formEquip = document.getElementById('form-equipamento');
const formFiltro = document.getElementById('form-filtro');
const formCategoria = document.getElementById('form-categoria');
const mensagem = document.getElementById('mensagem');
let equipamentos = [];
let categorias = [];

function aviso(texto, tipo = 'erro') {
  mostrarMensagem(mensagem, texto, tipo);
  mensagem.focus();
}

function ajustarQuantidade() {
  const porQuantidade = formEquip.tipo_controle.value === 'quantidade';
  formEquip.quantidade_total.disabled = !porQuantidade;
  if (!porQuantidade) formEquip.quantidade_total.value = 1;
}

formEquip.tipo_controle.addEventListener('change', ajustarQuantidade);

function limparFormulario() {
  formEquip.reset();
  formEquip.editando_id.value = '';
  document.getElementById('titulo-form').textContent = 'Novo equipamento';
  document.getElementById('botao-cancelar').hidden = true;
  ajustarQuantidade();
  marcarCamposInvalidos(formEquip, []);
}

async function carregarCategorias() {
  categorias = await api.get('/categorias');
  formEquip.categoria_id.innerHTML = opcoesSelect(categorias, { vazio: 'Selecione...' });
  const filtroAtual = formFiltro.categoria_id.value;
  formFiltro.categoria_id.innerHTML = opcoesSelect(categorias, { vazio: 'Todas', selecionado: filtroAtual });
  document.getElementById('lista-categorias').innerHTML = categorias
    .map((c) => `<li>${esc(c.nome)} <small>(${c.total_equipamentos} equipamento(s))</small></li>`).join('');
}

async function carregarLista() {
  equipamentos = await api.get('/equipamentos', dadosDoFormulario(formFiltro));
  document.getElementById('lista').innerHTML = equipamentos.length === 0
    ? '<tr><td colspan="6" class="vazio">Nenhum equipamento encontrado.</td></tr>'
    : equipamentos.map((e) => `
      <tr>
        <td data-label="Patrimônio">${esc(e.codigo_patrimonio)}</td>
        <td data-label="Nome">${esc(e.nome)}<br><small>${esc(e.localizacao || '')}</small></td>
        <td data-label="Categoria">${esc(e.categoria)}</td>
        <td data-label="Qtd.">${e.tipo_controle === 'quantidade' ? e.quantidade_total : '1 (individual)'}</td>
        <td data-label="Situação">${badge(e.situacao, SITUACAO_EQUIPAMENTO)}</td>
        <td class="td-acoes">
          <button type="button" class="botao botao-secundario botao-pequeno" data-acao="editar" data-id="${e.id}">Editar</button>
          <button type="button" class="botao botao-escuro botao-pequeno" data-acao="abrir-situacao" data-id="${e.id}">Alterar situação</button>
          <div class="form-inline" id="situacao-${e.id}" hidden>
            <label for="nova-situacao-${e.id}">Nova situação</label>
            <select id="nova-situacao-${e.id}">${opcoesDeObjeto(SITUACAO_EQUIPAMENTO, e.situacao)}</select>
            <label for="motivo-${e.id}">Motivo</label>
            <input type="text" id="motivo-${e.id}" placeholder="Ex.: lâmpada queimada">
            <div class="acoes">
              <button type="button" class="botao botao-pequeno" data-acao="salvar-situacao" data-id="${e.id}">Salvar situação</button>
            </div>
          </div>
        </td>
      </tr>`).join('');
}

document.getElementById('lista').addEventListener('click', async (evento) => {
  const botao = evento.target.closest('[data-acao]');
  if (!botao) return;
  const id = Number(botao.dataset.id);

  if (botao.dataset.acao === 'editar') {
    const e = equipamentos.find((x) => x.id === id);
    formEquip.editando_id.value = e.id;
    formEquip.codigo_patrimonio.value = e.codigo_patrimonio;
    formEquip.nome.value = e.nome;
    formEquip.categoria_id.value = e.categoria_id;
    formEquip.localizacao.value = e.localizacao || '';
    formEquip.tipo_controle.value = e.tipo_controle;
    ajustarQuantidade();
    formEquip.quantidade_total.value = e.quantidade_total;
    document.getElementById('titulo-form').textContent = `Editar ${e.codigo_patrimonio}`;
    document.getElementById('botao-cancelar').hidden = false;
    formEquip.codigo_patrimonio.focus();
  }

  if (botao.dataset.acao === 'abrir-situacao') {
    document.getElementById(`situacao-${id}`).hidden = false;
    document.getElementById(`nova-situacao-${id}`).focus();
  }

  if (botao.dataset.acao === 'salvar-situacao') {
    try {
      const resultado = await api.patch(`/equipamentos/${id}/situacao`, {
        situacao: document.getElementById(`nova-situacao-${id}`).value,
        motivo: document.getElementById(`motivo-${id}`).value
      });
      await carregarLista();
      const afetadas = resultado.reservasAfetadas.length;
      aviso(afetadas
        ? `Situação alterada. ${afetadas} reserva(s) futura(s) deste equipamento foram avisadas.`
        : 'Situação alterada.', afetadas ? 'aviso' : 'sucesso');
    } catch (erro) {
      aviso(erro.message);
    }
  }
});

document.getElementById('botao-cancelar').addEventListener('click', limparFormulario);

formEquip.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  limparMensagem(mensagem);
  const dados = dadosDoFormulario(formEquip);
  dados.quantidade_total = formEquip.quantidade_total.value;

  const botao = evento.submitter;
  if (botao) botao.disabled = true;
  try {
    if (dados.editando_id) await api.put(`/equipamentos/${dados.editando_id}`, dados);
    else await api.post('/equipamentos', dados);
    limparFormulario();
    await Promise.all([carregarLista(), carregarCategorias()]);
    aviso('Equipamento salvo com sucesso.', 'sucesso');
  } catch (erro) {
    mostrarMensagem(mensagem, erro.message);
    marcarCamposInvalidos(formEquip, erro.campos);
  } finally {
    if (botao) botao.disabled = false;
  }
});

formFiltro.addEventListener('submit', (evento) => {
  evento.preventDefault();
  carregarLista();
});

formCategoria.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  try {
    await api.post('/categorias', { nome: formCategoria.nome.value });
    formCategoria.reset();
    await carregarCategorias();
    aviso('Categoria adicionada.', 'sucesso');
  } catch (erro) {
    aviso(erro.message);
  }
});

iniciarPagina().then(async () => {
  formFiltro.situacao.innerHTML = opcoesDeObjeto(SITUACAO_EQUIPAMENTO, '', 'Todas');
  await carregarCategorias();
  await carregarLista();
}).catch((erro) => aviso(erro.message));
