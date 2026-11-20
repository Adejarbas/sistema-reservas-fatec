const formFiltro = document.getElementById('form-filtro');
const apenasMinhas = parametroUrl('minhas') === '1';
let mostrarSolicitante = false;

async function carregarLista() {
  const mensagem = document.getElementById('mensagem');
  limparMensagem(mensagem);

  const filtros = dadosDoFormulario(formFiltro);
  if (apenasMinhas) filtros.minhas = 1;

  try {
    const lista = await api.get('/solicitacoes', filtros);
    document.getElementById('total').textContent = `${lista.length} solicitação(ões) encontrada(s).`;

    document.getElementById('lista').innerHTML = lista.length === 0
      ? '<tr><td colspan="7" class="vazio">Nenhuma solicitação encontrada.</td></tr>'
      : lista.map((s) => {
        const recursos = [s.espacos, s.total_equipamentos ? `${s.total_equipamentos} equipamento(s)` : '']
          .filter(Boolean).join(' + ');
        return `
          <tr>
            <td data-label="#">${s.id}</td>
            <td data-label="Atividade">${esc(s.titulo)}<br><small>${esc(TIPOS_ATIVIDADE[s.tipo] || s.tipo)}</small></td>
            <td data-label="Data">${periodoBR(s.inicio, s.fim)}</td>
            <td data-label="Recursos">${esc(recursos)}</td>
            ${mostrarSolicitante ? `<td data-label="Solicitante">${esc(s.solicitante)}</td>` : ''}
            <td data-label="Status">${badge(s.status)}</td>
            <td class="td-acoes">
              <a class="botao botao-secundario botao-pequeno" href="solicitacao.html?id=${s.id}">
                Ver<span class="visualmente-oculto"> solicitação ${s.id}</span>
              </a>
            </td>
          </tr>`;
      }).join('');
  } catch (erro) {
    mostrarMensagem(mensagem, erro.message);
  }
}

formFiltro.addEventListener('submit', (evento) => {
  evento.preventDefault();
  carregarLista();
});

iniciarPagina().then(async (usuario) => {
  const [espacos, equipamentos] = await Promise.all([api.get('/espacos'), api.get('/equipamentos')]);

  formFiltro.status.innerHTML = opcoesDeObjeto(STATUS_SOLICITACAO, parametroUrl('status') || '', 'Todos');
  formFiltro.espaco_id.innerHTML = opcoesSelect(espacos, { vazio: 'Todos' });
  formFiltro.equipamento_id.innerHTML = opcoesSelect(equipamentos, {
    texto: (e) => `${e.nome} (${e.codigo_patrimonio})`, vazio: 'Todos'
  });

  mostrarSolicitante = !apenasMinhas && temPermissao(usuario, 'ver_todas');
  document.getElementById('campo-solicitante').hidden = !mostrarSolicitante;
  document.querySelector('.col-solicitante').hidden = !mostrarSolicitante;
  document.getElementById('link-nova').hidden = !temPermissao(usuario, 'solicitar');

  let titulo = 'Solicitações';
  if (apenasMinhas || !temPermissao(usuario, 'ver_todas')) titulo = 'Minhas solicitações';
  else if (parametroUrl('status') === 'pendente') titulo = 'Fila de aprovação';
  document.getElementById('titulo-pagina').textContent = titulo;
  document.title = `${titulo} - Reservas Fatec`;

  carregarLista();
});
