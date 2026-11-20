async function carregarNotificacoes() {
  const { notificacoes } = await api.get('/notificacoes');
  document.getElementById('lista').innerHTML = notificacoes.length === 0
    ? '<li class="vazio">Nenhuma notificação.</li>'
    : notificacoes.map((n) => `
      <li class="${n.lida ? '' : 'nao-lida'}">
        ${n.lida ? '' : '<span class="visualmente-oculto">Não lida: </span>'}
        ${esc(n.mensagem)}<br>
        <small>${dataHoraBR(n.criada_em)}</small>
        ${n.link ? ` · <a href="${esc(n.link)}" data-id="${n.id}">Abrir</a>` : ''}
      </li>`).join('');
  atualizarContadorNotificacoes();
}

// Ao abrir o link, marca como lida antes de sair da página.
document.getElementById('lista').addEventListener('click', async (evento) => {
  const link = evento.target.closest('a[data-id]');
  if (!link) return;
  evento.preventDefault();
  await api.patch(`/notificacoes/${link.dataset.id}/lida`).catch(() => {});
  window.location.href = link.getAttribute('href');
});

document.getElementById('botao-todas').addEventListener('click', async () => {
  await api.patch('/notificacoes/lidas');
  await carregarNotificacoes();
  mostrarMensagem(document.getElementById('mensagem'), 'Todas as notificações foram marcadas como lidas.', 'sucesso');
});

iniciarPagina()
  .then(carregarNotificacoes)
  .catch((erro) => mostrarMensagem(document.getElementById('mensagem'), erro.message));
