const idSolicitacao = parametroUrl('id');
const mensagem = document.getElementById('mensagem');
let usuarioLogado = null;
let solicitacao = null;

function desenharDados(s) {
  document.getElementById('titulo-pagina').textContent = `#${s.id} - ${s.titulo}`;
  document.title = `Solicitação #${s.id} - Reservas Fatec`;
  document.getElementById('status-solicitacao').innerHTML = badge(s.status);

  const campos = [
    ['Tipo', TIPOS_ATIVIDADE[s.tipo] || s.tipo],
    ['Data e horário', periodoBR(s.inicio, s.fim)],
    ['Público estimado', `${s.publico_estimado} pessoas`],
    ['Solicitante', s.solicitante],
    ['Descrição', s.descricao],
    ['Observações', s.motivo || '-'],
    ['Criada em', dataHoraBR(s.criada_em)],
    ['Última atualização', dataHoraBR(s.atualizada_em)]
  ];
  document.getElementById('dados').innerHTML = campos
    .map(([rotulo, valor]) => `<div><dt>${rotulo}</dt><dd>${esc(valor)}</dd></div>`).join('');
}

function podeDecidirEquipamentos(s) {
  return temPermissao(usuarioLogado, 'decidir_equipamento')
    && s.solicitante_id !== usuarioLogado.id
    && ['pendente', 'aprovada'].includes(s.status);
}

function desenharRecursos(s) {
  const linhas = s.espacos.map((r) => `
    <tr>
      <td data-label="Recurso"><strong>${esc(r.espaco)}</strong><br><small>Espaço, capacidade ${r.capacidade}</small></td>
      <td data-label="Período">${periodoBR(r.inicio, r.fim)}</td>
      <td data-label="Status">${badge(r.status, STATUS_RESERVA)}</td>
      <td data-label="Observação">${esc(r.justificativa || '-')}</td>
      <td class="td-acoes"></td>
    </tr>`);

  const decide = podeDecidirEquipamentos(s);
  for (const r of s.equipamentos) {
    let acoes = '';
    if (decide && r.status === 'pendente') {
      acoes += `<button type="button" class="botao botao-sucesso botao-pequeno" data-acao="aprovar-equip" data-id="${r.id}">Aprovar</button> `;
    }
    if (decide && ['pendente', 'aprovada'].includes(r.status)) {
      acoes += `
        <button type="button" class="botao botao-secundario botao-pequeno" data-acao="mostrar-rejeitar-equip" data-id="${r.id}">Rejeitar</button>
        <div class="form-inline" id="rejeitar-equip-${r.id}" hidden>
          <label for="just-equip-${r.id}">Justificativa</label>
          <input type="text" id="just-equip-${r.id}">
          <div class="acoes">
            <button type="button" class="botao botao-pequeno" data-acao="rejeitar-equip" data-id="${r.id}">Confirmar rejeição</button>
          </div>
        </div>`;
    }
    linhas.push(`
      <tr>
        <td data-label="Recurso"><strong>${esc(r.equipamento)}</strong><br>
          <small>${esc(r.codigo_patrimonio)}${r.tipo_controle === 'quantidade' ? `, ${r.quantidade} un.` : ''}</small></td>
        <td data-label="Período">${periodoBR(r.inicio, r.fim)}</td>
        <td data-label="Status">${badge(r.status, STATUS_RESERVA)}</td>
        <td data-label="Observação">${esc(r.justificativa || '-')}</td>
        <td class="td-acoes">${acoes}</td>
      </tr>`);
  }

  document.getElementById('recursos').innerHTML = linhas.join('')
    || '<tr><td colspan="5" class="vazio">Nenhum recurso.</td></tr>';
}

function desenharAcoes(s) {
  const ehDono = s.solicitante_id === usuarioLogado.id;
  const temEspaco = s.espacos.length > 0;
  const ehAnalista = temPermissao(usuarioLogado, 'decidir_espaco', 'decidir_equipamento');
  const podeDecidir = !ehDono && temPermissao(usuarioLogado, temEspaco ? 'decidir_espaco' : 'decidir_equipamento');
  const temRetirada = s.equipamentos.some((e) => ['retirado', 'devolvido'].includes(e.status));
  const blocos = [];

  if (ehDono) {
    const botoes = [];
    if (['rascunho', 'em_ajustes', 'aprovada'].includes(s.status) && !temRetirada) {
      botoes.push(`<a class="botao botao-secundario" href="nova-solicitacao.html?id=${s.id}">Editar</a>`);
    }
    if (['rascunho', 'em_ajustes'].includes(s.status)) {
      botoes.push('<button type="button" class="botao" data-acao="enviar">Enviar para análise</button>');
    }
    if (botoes.length) blocos.push(`<div class="acoes">${botoes.join('')}</div>`);
  }

  if (podeDecidir && s.status === 'pendente') {
    blocos.push(`
      <div class="form-inline">
        <h3>Análise da solicitação</h3>
        <div class="campo">
          <label for="justificativa">Justificativa <span class="dica">Obrigatória para rejeitar ou devolver</span></label>
          <textarea id="justificativa"></textarea>
        </div>
        <div class="acoes">
          <button type="button" class="botao botao-sucesso" data-acao="aprovar">Aprovar</button>
          <button type="button" class="botao botao-secundario" data-acao="devolver">Devolver para ajustes</button>
          <button type="button" class="botao" data-acao="rejeitar">Rejeitar</button>
        </div>
      </div>`);
  }

  if (ehAnalista && !ehDono && s.status === 'aprovada' && agoraISO() >= s.fim) {
    blocos.push('<div class="acoes"><button type="button" class="botao botao-escuro" data-acao="concluir">Marcar como concluída</button></div>');
  }

  const podeCancelar = (ehDono || ehAnalista) && ['rascunho', 'pendente', 'em_ajustes', 'aprovada'].includes(s.status);
  if (podeCancelar) {
    blocos.push(`
      <div class="acoes"><button type="button" class="botao botao-secundario" data-acao="mostrar-cancelar">Cancelar solicitação</button></div>
      <div class="form-inline" id="form-cancelar" hidden>
        <div class="campo">
          <label for="motivo-cancelamento">Motivo do cancelamento</label>
          <textarea id="motivo-cancelamento"></textarea>
        </div>
        <button type="button" class="botao" data-acao="cancelar">Confirmar cancelamento</button>
      </div>`);
  }

  if (s.status === 'pendente' && ehDono) {
    blocos.push('<p class="subtitulo">Aguardando análise. Você será notificado quando houver uma decisão.</p>');
  }

  document.getElementById('secao-acoes').hidden = blocos.length === 0;
  document.getElementById('acoes').innerHTML = blocos.join('');
}

function desenharHistorico(s) {
  document.getElementById('historico').innerHTML = s.historico.map((h) => {
    const mudanca = h.status_novo && h.status_anterior !== h.status_novo
      ? ` ${h.status_anterior ? `${badge(h.status_anterior)} → ` : ''}${badge(h.status_novo)}`
      : '';
    return `
      <li>
        <time datetime="${esc(h.data_hora)}">${dataHoraBR(h.data_hora)}</time><br>
        <strong>${esc(h.ator)}</strong> ${esc(ACOES_HISTORICO[h.acao] || h.acao)}${mudanca}
        ${h.justificativa ? `<br><em>"${esc(h.justificativa)}"</em>` : ''}
      </li>`;
  }).join('');

  const movs = s.movimentacoes;
  document.getElementById('secao-movimentacoes').hidden = movs.length === 0;
  document.getElementById('movimentacoes').innerHTML = movs.map((m) => `
    <li>
      <span class="horario">${dataHoraBR(m.data_hora)}</span>
      <span>${m.tipo === 'retirada' ? 'Retirada' : 'Devolução'} de ${esc(m.equipamento)} (${esc(m.codigo_patrimonio)})
        por ${esc(m.responsavel)}, condição: <strong>${m.condicao === 'ok' ? 'OK' : 'Avariado'}</strong>
        ${m.observacao ? ` - ${esc(m.observacao)}` : ''}</span>
    </li>`).join('');
}

async function carregar() {
  solicitacao = await api.get(`/solicitacoes/${idSolicitacao}`);
  desenharDados(solicitacao);
  desenharRecursos(solicitacao);
  desenharAcoes(solicitacao);
  desenharHistorico(solicitacao);
}

async function executar(chamada, textoSucesso) {
  limparMensagem(mensagem);
  try {
    await chamada();
    await carregar();
    mostrarMensagem(mensagem, textoSucesso, 'sucesso');
  } catch (erro) {
    mostrarMensagem(mensagem, erro.message);
  }
  mensagem.focus();
}

document.querySelector('main').addEventListener('click', (evento) => {
  const botao = evento.target.closest('[data-acao]');
  if (!botao) return;
  const id = botao.dataset.id;
  const justificativa = () => document.getElementById('justificativa').value;

  switch (botao.dataset.acao) {
    case 'enviar':
      executar(() => api.patch(`/solicitacoes/${idSolicitacao}/enviar`), 'Solicitação enviada para análise.');
      break;
    case 'aprovar':
      executar(() => api.patch(`/solicitacoes/${idSolicitacao}/aprovar`, { justificativa: justificativa() }),
        'Solicitação aprovada.');
      break;
    case 'devolver':
      executar(() => api.patch(`/solicitacoes/${idSolicitacao}/devolver`, { justificativa: justificativa() }),
        'Solicitação devolvida para ajustes.');
      break;
    case 'rejeitar':
      executar(() => api.patch(`/solicitacoes/${idSolicitacao}/rejeitar`, { justificativa: justificativa() }),
        'Solicitação rejeitada.');
      break;
    case 'concluir':
      executar(() => api.patch(`/solicitacoes/${idSolicitacao}/concluir`), 'Solicitação concluída.');
      break;
    case 'mostrar-cancelar':
      document.getElementById('form-cancelar').hidden = false;
      document.getElementById('motivo-cancelamento').focus();
      break;
    case 'cancelar':
      executar(() => api.patch(`/solicitacoes/${idSolicitacao}/cancelar`, {
        motivo: document.getElementById('motivo-cancelamento').value
      }), 'Solicitação cancelada. A agenda foi liberada.');
      break;
    case 'aprovar-equip':
      executar(() => api.patch(`/reservas-equipamento/${id}/aprovar`), 'Equipamento aprovado.');
      break;
    case 'mostrar-rejeitar-equip':
      document.getElementById(`rejeitar-equip-${id}`).hidden = false;
      document.getElementById(`just-equip-${id}`).focus();
      break;
    case 'rejeitar-equip':
      executar(() => api.patch(`/reservas-equipamento/${id}/rejeitar`, {
        justificativa: document.getElementById(`just-equip-${id}`).value
      }), 'Equipamento rejeitado.');
      break;
    default:
      break;
  }
});

iniciarPagina().then((usuario) => {
  usuarioLogado = usuario;
  if (!idSolicitacao) throw new Error('Solicitação não informada.');
  return carregar();
}).catch((erro) => mostrarMensagem(mensagem, erro.message));
