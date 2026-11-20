// Monta o topo e o menu lateral de acordo com as permissões do usuário logado.
// Esconder um item do menu é só para facilitar: quem barra o acesso é o servidor.

const ITENS_MENU = [
  { pagina: 'painel', href: 'painel.html', texto: 'Painel' },
  { pagina: 'agenda', href: 'agenda.html', texto: 'Agenda e disponibilidade' },
  { pagina: 'nova-solicitacao', href: 'nova-solicitacao.html', texto: 'Nova solicitação', permissoes: ['solicitar'] },
  { pagina: 'minhas', href: 'solicitacoes.html?minhas=1', texto: 'Minhas solicitações', permissoes: ['solicitar'] },
  { pagina: 'fila', href: 'solicitacoes.html?status=pendente', texto: 'Fila de aprovação',
    permissoes: ['decidir_espaco', 'decidir_equipamento'] },
  { pagina: 'todas', href: 'solicitacoes.html', texto: 'Todas as solicitações', permissoes: ['ver_todas'] },
  { pagina: 'movimentacoes', href: 'movimentacoes.html', texto: 'Retirada e devolução',
    permissoes: ['decidir_equipamento', 'movimentar'] },
  { pagina: 'espacos', href: 'espacos.html', texto: 'Espaços', permissoes: ['gerenciar_espacos'] },
  { pagina: 'equipamentos', href: 'equipamentos.html', texto: 'Equipamentos', permissoes: ['gerenciar_equipamentos'] },
  { pagina: 'bloqueios', href: 'bloqueios.html', texto: 'Bloqueios de período', permissoes: ['bloquear'] },
  { pagina: 'admin', href: 'admin.html', texto: 'Administração',
    permissoes: ['gerenciar_usuarios', 'parametros', 'auditoria'] },
  { pagina: 'notificacoes', href: 'notificacoes.html', texto: 'Notificações' }
];

function paginaAtual() {
  const pagina = document.body.dataset.pagina;
  if (pagina !== 'solicitacoes') return pagina;
  if (parametroUrl('minhas') === '1') return 'minhas';
  if (parametroUrl('status') === 'pendente') return 'fila';
  return 'todas';
}

function montarLayout(usuario) {
  const atual = paginaAtual();
  const itens = ITENS_MENU
    .filter((item) => !item.permissoes || temPermissao(usuario, ...item.permissoes))
    .map((item) => {
      const marcado = item.pagina === atual ? ' aria-current="page"' : '';
      return `<li><a href="${item.href}"${marcado}>${esc(item.texto)}</a></li>`;
    })
    .join('');

  document.body.classList.add('com-menu');
  document.body.insertAdjacentHTML('afterbegin', `
    <a class="pular-link" href="#conteudo">Pular para o conteúdo</a>
    <header class="topo">
      <button type="button" class="botao-menu" id="botao-menu" aria-controls="menu" aria-expanded="false">Menu</button>
      <a class="marca" href="painel.html">Reservas <span>Fatec</span></a>
      <div class="topo-usuario">
        <a class="link-notificacoes" href="notificacoes.html">
          Avisos <span class="contador" id="contador-notificacoes" hidden></span>
        </a>
        <span class="nome">${esc(usuario.nome)} <small>(${esc(usuario.perfil)})</small></span>
        <button type="button" class="botao-sair" id="botao-sair">Sair</button>
      </div>
    </header>
    <nav class="menu" id="menu" aria-label="Menu principal"><ul>${itens}</ul></nav>
  `);

  const botaoMenu = document.getElementById('botao-menu');
  const menu = document.getElementById('menu');
  botaoMenu.addEventListener('click', () => {
    const aberto = menu.classList.toggle('aberto');
    botaoMenu.setAttribute('aria-expanded', String(aberto));
  });
  // Esc fecha o menu no celular
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && menu.classList.contains('aberto')) {
      menu.classList.remove('aberto');
      botaoMenu.setAttribute('aria-expanded', 'false');
      botaoMenu.focus();
    }
  });

  document.getElementById('botao-sair').addEventListener('click', async () => {
    await api.post('/auth/logout');
    window.location.href = 'index.html';
  });
}

async function atualizarContadorNotificacoes() {
  try {
    const { naoLidas } = await api.get('/notificacoes', { nao_lidas: 1 });
    const contador = document.getElementById('contador-notificacoes');
    contador.textContent = naoLidas;
    contador.hidden = naoLidas === 0;
    contador.setAttribute('aria-label', `${naoLidas} não lidas`);
  } catch {
    // contador é só informativo; se falhar a página continua funcionando
  }
}

// Cada página chama iniciarPagina() e recebe o usuário logado.
async function iniciarPagina() {
  const { usuario } = await api.get('/auth/me');
  montarLayout(usuario);
  atualizarContadorNotificacoes();
  return usuario;
}
