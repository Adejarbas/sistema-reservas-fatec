function indicador(titulo, valor, link) {
  return `<a class="indicador" href="${link}"><strong>${valor}</strong>${esc(titulo)}</a>`;
}

async function carregarPainel(usuario) {
  // Primeiro nome, pulando títulos como "Prof."
  const primeiroNome = usuario.nome.split(' ').find((parte) => !parte.endsWith('.')) || usuario.nome;
  document.getElementById('saudacao').textContent = `Olá, ${primeiroNome}`;
  const indicadores = [];
  const tarefas = [];

  if (temPermissao(usuario, 'solicitar')) {
    const minhas = await api.get('/solicitacoes', { minhas: 1 });
    const contar = (status) => minhas.filter((s) => s.status === status).length;
    indicadores.push(
      indicador('Pendentes', contar('pendente'), 'solicitacoes.html?minhas=1'),
      indicador('Aprovadas', contar('aprovada'), 'solicitacoes.html?minhas=1'),
      indicador('Em ajustes', contar('em_ajustes'), 'solicitacoes.html?minhas=1'),
      indicador('Rascunhos', contar('rascunho'), 'solicitacoes.html?minhas=1')
    );

    const agora = agoraISO();
    const proximas = minhas
      .filter((s) => s.status === 'aprovada' && s.fim >= agora)
      .sort((a, b) => (a.inicio < b.inicio ? -1 : 1))
      .slice(0, 5);
    document.getElementById('secao-proximas').hidden = false;
    document.getElementById('proximas').innerHTML = proximas.length === 0
      ? '<p class="vazio">Nenhuma reserva aprovada nos próximos dias.</p>'
      : `<ul class="lista-faixas">${proximas.map((s) => `
          <li>
            <span class="horario">${periodoBR(s.inicio, s.fim)}</span>
            <a href="solicitacao.html?id=${s.id}">${esc(s.titulo)}</a>
            <span>${esc(s.espacos || 'Somente equipamentos')}</span>
          </li>`).join('')}</ul>`;

    const emAjustes = contar('em_ajustes');
    if (emAjustes) tarefas.push(`<a href="solicitacoes.html?minhas=1">${emAjustes} solicitação(ões) aguardando seus ajustes</a>`);
  }

  if (temPermissao(usuario, 'decidir_espaco', 'decidir_equipamento')) {
    const fila = await api.get('/solicitacoes', { status: 'pendente' });
    // Com espaço quem decide é a secretaria; só com equipamentos, o responsável por equipamentos.
    const paraAnalisar = fila.filter((s) => s.solicitante_id !== usuario.id
      && temPermissao(usuario, s.espacos ? 'decidir_espaco' : 'decidir_equipamento')).length;
    indicadores.push(indicador('Aguardando análise', paraAnalisar, 'solicitacoes.html?status=pendente'));
    if (paraAnalisar) tarefas.push(`<a href="solicitacoes.html?status=pendente">${paraAnalisar} solicitação(ões) para analisar</a>`);
  }

  if (temPermissao(usuario, 'decidir_equipamento', 'movimentar')) {
    const pendentes = await api.get('/reservas-equipamento', { status: 'pendente' });
    const hoje = await api.get('/reservas-equipamento', { status: 'aprovada', data: hojeISO() });
    const retirados = await api.get('/reservas-equipamento', { status: 'retirado' });
    indicadores.push(indicador('Equipamentos retirados', retirados.length, 'movimentacoes.html?status=retirado'));
    if (pendentes.length) tarefas.push(`<a href="movimentacoes.html?status=pendente">${pendentes.length} equipamento(s) aguardando análise</a>`);
    if (hoje.length) tarefas.push(`<a href="movimentacoes.html?status=aprovada">${hoje.length} retirada(s) prevista(s) para hoje</a>`);
    const atrasados = retirados.filter((r) => r.fim < agoraISO()).length;
    if (atrasados) tarefas.push(`<a href="movimentacoes.html?status=retirado">${atrasados} equipamento(s) com devolução atrasada</a>`);
  }

  document.getElementById('indicadores').innerHTML = indicadores.slice(0, 8).join('');
  if (tarefas.length) {
    document.getElementById('secao-tarefas').hidden = false;
    document.getElementById('tarefas').innerHTML = tarefas.map((t) => `<li>${t}</li>`).join('');
  }

  const { notificacoes } = await api.get('/notificacoes');
  document.getElementById('notificacoes').innerHTML = notificacoes.length === 0
    ? '<li class="vazio">Nenhuma notificação.</li>'
    : notificacoes.slice(0, 5).map((n) => `
        <li class="${n.lida ? '' : 'nao-lida'}">
          ${esc(n.mensagem)}<br><small>${dataHoraBR(n.criada_em)}</small>
        </li>`).join('');
}

iniciarPagina()
  .then(carregarPainel)
  .catch((erro) => mostrarMensagem(document.getElementById('mensagem'), erro.message));
