const formFiltro = document.getElementById('form-filtro');
const mensagem = document.getElementById('mensagem');
let usuarioLogado = null;

function acoesDaReserva(r) {
  const podeDecidir = temPermissao(usuarioLogado, 'decidir_equipamento') && r.solicitante_id !== usuarioLogado.id;
  const podeMovimentar = temPermissao(usuarioLogado, 'movimentar');

  if (r.status === 'pendente' && podeDecidir) {
    return `
      <button type="button" class="botao botao-sucesso botao-pequeno" data-acao="aprovar" data-id="${r.id}">Aprovar</button>
      <button type="button" class="botao botao-secundario botao-pequeno" data-acao="abrir" data-id="${r.id}">Rejeitar</button>
      <div class="form-inline" id="form-${r.id}" hidden>
        <label for="just-${r.id}">Justificativa</label>
        <input type="text" id="just-${r.id}">
        <div class="acoes"><button type="button" class="botao botao-pequeno" data-acao="rejeitar" data-id="${r.id}">Confirmar rejeição</button></div>
      </div>`;
  }

  if (r.status === 'aprovada' && podeMovimentar) {
    if (r.status_solicitacao !== 'aprovada') return '<small>Aguardando aprovação da solicitação</small>';
    return `
      <button type="button" class="botao botao-pequeno" data-acao="abrir" data-id="${r.id}">Registrar retirada</button>
      <div class="form-inline" id="form-${r.id}" hidden>
        <label for="obs-${r.id}">Observação (opcional)</label>
        <input type="text" id="obs-${r.id}">
        <p class="dica">Entregue em condição OK por ${esc(usuarioLogado.nome)}.</p>
        <button type="button" class="botao botao-pequeno" data-acao="retirada" data-id="${r.id}">Confirmar retirada</button>
      </div>`;
  }

  if (r.status === 'retirado' && podeMovimentar) {
    const qtd = r.tipo_controle === 'quantidade'
      ? `<label for="qtd-${r.id}">Unidades avariadas</label>
         <input type="number" id="qtd-${r.id}" min="1" max="${r.quantidade}" value="${r.quantidade}">`
      : '';
    return `
      <button type="button" class="botao botao-pequeno" data-acao="abrir" data-id="${r.id}">Registrar devolução</button>
      <div class="form-inline" id="form-${r.id}" hidden>
        <label for="cond-${r.id}">Condição</label>
        <select id="cond-${r.id}">
          <option value="ok">OK</option>
          <option value="avariado">Avariado</option>
        </select>
        ${qtd}
        <label for="obs-${r.id}">Observação</label>
        <input type="text" id="obs-${r.id}">
        <div class="acoes"><button type="button" class="botao botao-pequeno" data-acao="devolucao" data-id="${r.id}">Confirmar devolução</button></div>
      </div>`;
  }
  return '-';
}

async function carregarLista() {
  limparMensagem(mensagem);
  try {
    const lista = await api.get('/reservas-equipamento', dadosDoFormulario(formFiltro));
    const agora = agoraISO();

    document.getElementById('lista').innerHTML = lista.length === 0
      ? '<tr><td colspan="6" class="vazio">Nenhuma reserva encontrada.</td></tr>'
      : lista.map((r) => `
        <tr>
          <td data-label="Equipamento"><strong>${esc(r.equipamento)}</strong><br>
            <small>${esc(r.codigo_patrimonio)}${r.tipo_controle === 'quantidade' ? `, ${r.quantidade} un.` : ''}</small></td>
          <td data-label="Atividade"><a href="solicitacao.html?id=${r.solicitacao_id}">#${r.solicitacao_id} ${esc(r.atividade)}</a></td>
          <td data-label="Solicitante">${esc(r.solicitante)}</td>
          <td data-label="Período">${periodoBR(r.inicio, r.fim)}
            ${r.status === 'retirado' && r.fim < agora ? '<br><span class="badge badge-rejeitada">Atrasado</span>' : ''}</td>
          <td data-label="Status">${badge(r.status, STATUS_RESERVA)}</td>
          <td class="td-acoes">${acoesDaReserva(r)}</td>
        </tr>`).join('');
  } catch (erro) {
    mostrarMensagem(mensagem, erro.message);
  }

  if (temPermissao(usuarioLogado, 'movimentar')) {
    const ultimas = await api.get('/movimentacoes');
    document.getElementById('ultimas').innerHTML = ultimas.length === 0
      ? '<li class="vazio">Nenhuma movimentação registrada.</li>'
      : ultimas.slice(0, 15).map((m) => `
        <li>
          <span class="horario">${dataHoraBR(m.data_hora)}</span>
          <span>${m.tipo === 'retirada' ? 'Retirada' : 'Devolução'}: ${esc(m.equipamento)} (${esc(m.codigo_patrimonio)}),
            ${esc(m.responsavel)}, condição <strong>${m.condicao === 'ok' ? 'OK' : 'Avariado'}</strong>
            ${m.observacao ? ` - ${esc(m.observacao)}` : ''}</span>
        </li>`).join('');
  }
}

async function executar(chamada, textoSucesso) {
  try {
    await chamada();
    await carregarLista();
    mostrarMensagem(mensagem, textoSucesso, 'sucesso');
  } catch (erro) {
    mostrarMensagem(mensagem, erro.message);
  }
  mensagem.focus();
}

document.getElementById('lista').addEventListener('click', (evento) => {
  const botao = evento.target.closest('[data-acao]');
  if (!botao) return;
  const id = botao.dataset.id;
  const valor = (prefixo) => document.getElementById(`${prefixo}-${id}`)?.value;

  switch (botao.dataset.acao) {
    case 'abrir': {
      const formInline = document.getElementById(`form-${id}`);
      formInline.hidden = false;
      formInline.querySelector('input, select').focus();
      break;
    }
    case 'aprovar':
      executar(() => api.patch(`/reservas-equipamento/${id}/aprovar`), 'Equipamento aprovado.');
      break;
    case 'rejeitar':
      executar(() => api.patch(`/reservas-equipamento/${id}/rejeitar`, { justificativa: valor('just') }), 'Equipamento rejeitado.');
      break;
    case 'retirada':
      executar(() => api.post('/movimentacoes', {
        reserva_equipamento_id: Number(id), tipo: 'retirada', condicao: 'ok', observacao: valor('obs')
      }), 'Retirada registrada.');
      break;
    case 'devolucao':
      executar(() => api.post('/movimentacoes', {
        reserva_equipamento_id: Number(id),
        tipo: 'devolucao',
        condicao: valor('cond'),
        quantidade_avariada: valor('qtd'),
        observacao: valor('obs')
      }), 'Devolução registrada.');
      break;
    default:
      break;
  }
});

formFiltro.addEventListener('submit', (evento) => {
  evento.preventDefault();
  carregarLista();
});

iniciarPagina().then((usuario) => {
  usuarioLogado = usuario;
  formFiltro.status.value = parametroUrl('status') || (temPermissao(usuario, 'movimentar') ? 'aprovada' : 'pendente');
  carregarLista();
});
