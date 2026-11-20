const formBloqueio = document.getElementById('form-bloqueio');
const formFiltro = document.getElementById('form-filtro');
const mensagem = document.getElementById('mensagem');
const recursos = { espaco: [], equipamento: [] };
let usuarioLogado = null;

function aviso(texto, tipo = 'erro') {
  mostrarMensagem(mensagem, texto, tipo);
  mensagem.focus();
}

function preencherRecursos() {
  const tipo = formBloqueio.tipo.value;
  formBloqueio.recurso.innerHTML = opcoesSelect(recursos[tipo], {
    texto: (r) => (tipo === 'espaco' ? r.nome : `${r.nome} (${r.codigo_patrimonio})`),
    vazio: 'Selecione...'
  });
}

formBloqueio.tipo.addEventListener('change', preencherRecursos);

async function carregarLista() {
  const lista = await api.get('/bloqueios', dadosDoFormulario(formFiltro));
  document.getElementById('lista').innerHTML = lista.length === 0
    ? '<tr><td colspan="5" class="vazio">Nenhum bloqueio no período.</td></tr>'
    : lista.map((b) => {
      const tipo = b.espaco_id ? 'espaco' : 'equipamento';
      const podeRemover = temPermissao(usuarioLogado, tipo === 'espaco' ? 'gerenciar_espacos' : 'gerenciar_equipamentos');
      return `
        <tr>
          <td data-label="Recurso">${esc(b.espaco || `${b.equipamento} (${b.codigo_patrimonio})`)}</td>
          <td data-label="Período">${periodoBR(b.inicio, b.fim)}</td>
          <td data-label="Motivo">${esc(b.motivo)}</td>
          <td data-label="Criado por">${esc(b.criado_por_nome)}</td>
          <td class="td-acoes">
            ${podeRemover ? `
              <button type="button" class="botao botao-secundario botao-pequeno" data-acao="perguntar" data-id="${b.id}">Remover</button>
              <span id="confirmar-${b.id}" hidden>
                Remover este bloqueio?
                <button type="button" class="botao botao-pequeno" data-acao="remover" data-id="${b.id}">Sim, remover</button>
              </span>` : ''}
          </td>
        </tr>`;
    }).join('');
}

document.getElementById('lista').addEventListener('click', async (evento) => {
  const botao = evento.target.closest('[data-acao]');
  if (!botao) return;
  const id = botao.dataset.id;

  if (botao.dataset.acao === 'perguntar') {
    document.getElementById(`confirmar-${id}`).hidden = false;
    document.querySelector(`#confirmar-${id} button`).focus();
  }
  if (botao.dataset.acao === 'remover') {
    try {
      await api.delete(`/bloqueios/${id}`);
      await carregarLista();
      aviso('Bloqueio removido.', 'sucesso');
    } catch (erro) {
      aviso(erro.message);
    }
  }
});

formBloqueio.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const dados = dadosDoFormulario(formBloqueio);
  const corpo = { inicio: dados.inicio, fim: dados.fim, motivo: dados.motivo };
  corpo[dados.tipo === 'espaco' ? 'espaco_id' : 'equipamento_id'] = dados.recurso || null;

  try {
    const resultado = await api.post('/bloqueios', corpo);
    formBloqueio.reset();
    preencherRecursos();
    await carregarLista();
    if (resultado.aviso) {
      const lista = resultado.reservasAfetadas
        .map((r) => `#${r.solicitacao_id} ${r.atividade} (${periodoBR(r.inicio, r.fim)})`).join('; ');
      aviso(`${resultado.aviso} Reservas: ${lista}`, 'aviso');
    } else {
      aviso('Período bloqueado.', 'sucesso');
    }
  } catch (erro) {
    aviso(erro.message);
    marcarCamposInvalidos(formBloqueio, (erro.campos || []).map((c) => (c.endsWith('_id') ? 'recurso' : c)));
  }
});

formFiltro.addEventListener('submit', (evento) => {
  evento.preventDefault();
  carregarLista();
});

iniciarPagina().then(async (usuario) => {
  usuarioLogado = usuario;
  const tipos = {};
  if (temPermissao(usuario, 'gerenciar_espacos')) {
    tipos.espaco = 'Espaço';
    recursos.espaco = await api.get('/espacos');
  }
  if (temPermissao(usuario, 'gerenciar_equipamentos')) {
    tipos.equipamento = 'Equipamento';
    recursos.equipamento = await api.get('/equipamentos');
  }
  formBloqueio.tipo.innerHTML = opcoesDeObjeto(tipos);
  preencherRecursos();

  formFiltro.de.value = hojeISO();
  await carregarLista();
}).catch((erro) => aviso(erro.message));
