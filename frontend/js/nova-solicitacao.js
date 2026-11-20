const form = document.getElementById('form-solicitacao');
const mensagem = document.getElementById('mensagem');
const idEdicao = parametroUrl('id');

let equipamentosDisponiveis = [];
let equipamentosEscolhidos = []; // [{ equipamento_id, quantidade }]
let statusAtual = null;

function nomeEquipamento(id) {
  const eq = equipamentosDisponiveis.find((e) => e.id === Number(id));
  return eq ? `${eq.nome} (${eq.codigo_patrimonio})` : `Equipamento ${id}`;
}

function desenharEquipamentos() {
  const corpo = document.getElementById('lista-equipamentos');
  if (equipamentosEscolhidos.length === 0) {
    corpo.innerHTML = '<tr><td colspan="3" class="vazio">Nenhum equipamento adicionado.</td></tr>';
    return;
  }
  corpo.innerHTML = equipamentosEscolhidos.map((item, indice) => `
    <tr>
      <td data-label="Equipamento">${esc(nomeEquipamento(item.equipamento_id))}</td>
      <td data-label="Quantidade">${item.quantidade}</td>
      <td class="td-acoes">
        <button type="button" class="botao botao-secundario botao-pequeno" data-remover="${indice}">
          Remover<span class="visualmente-oculto"> ${esc(nomeEquipamento(item.equipamento_id))}</span>
        </button>
      </td>
    </tr>`).join('');
}

document.getElementById('lista-equipamentos').addEventListener('click', (evento) => {
  const indice = evento.target.closest('[data-remover]')?.dataset.remover;
  if (indice === undefined) return;
  equipamentosEscolhidos.splice(Number(indice), 1);
  desenharEquipamentos();
  document.getElementById('equipamento').focus();
});

document.getElementById('botao-adicionar').addEventListener('click', () => {
  const id = Number(document.getElementById('equipamento').value);
  const quantidade = Number(document.getElementById('quantidade').value);
  if (!id) return;
  if (!Number.isInteger(quantidade) || quantidade < 1) {
    mostrarMensagem(mensagem, 'Informe uma quantidade válida.');
    return;
  }
  limparMensagem(mensagem);
  const existente = equipamentosEscolhidos.find((e) => e.equipamento_id === id);
  if (existente) existente.quantidade = quantidade;
  else equipamentosEscolhidos.push({ equipamento_id: id, quantidade });
  desenharEquipamentos();
});

// Quando o item é individual (patrimônio próprio), a quantidade é sempre 1.
document.getElementById('equipamento').addEventListener('change', (evento) => {
  const eq = equipamentosDisponiveis.find((e) => e.id === Number(evento.target.value));
  const campoQtd = document.getElementById('quantidade');
  campoQtd.value = 1;
  campoQtd.disabled = !eq || eq.tipo_controle === 'individual';
  campoQtd.max = eq ? eq.quantidade_total : '';
});

function montarCorpo(enviar) {
  const dados = dadosDoFormulario(form);
  return {
    titulo: dados.titulo,
    tipo: dados.tipo,
    descricao: dados.descricao,
    publico_estimado: dados.publico_estimado,
    inicio: dados.data && dados.hora_inicio ? `${dados.data}T${dados.hora_inicio}` : '',
    fim: dados.data && dados.hora_fim ? `${dados.data}T${dados.hora_fim}` : '',
    espaco_id: dados.espaco_id || null,
    equipamentos: equipamentosEscolhidos,
    motivo: dados.motivo,
    enviar
  };
}

// O servidor devolve "inicio"/"fim", mas na tela os campos são data + horas.
function traduzirCampos(campos) {
  return campos.flatMap((c) => {
    if (c === 'inicio') return ['data', 'hora_inicio'];
    if (c === 'fim') return ['hora_fim'];
    if (c === 'equipamentos') return ['equipamento'];
    return [c];
  });
}

async function salvar(enviar) {
  limparMensagem(mensagem);
  const corpo = montarCorpo(enviar);
  const botoes = form.querySelectorAll('.acoes button');
  botoes.forEach((b) => { b.disabled = true; });

  try {
    const solicitacao = idEdicao
      ? await api.put(`/solicitacoes/${idEdicao}`, corpo)
      : await api.post('/solicitacoes', corpo);
    window.location.href = `solicitacao.html?id=${solicitacao.id}`;
  } catch (erro) {
    mostrarMensagem(mensagem, erro.message);
    marcarCamposInvalidos(form, traduzirCampos(erro.campos));
    if (!erro.campos.length) mensagem.focus();
  } finally {
    botoes.forEach((b) => { b.disabled = false; });
  }
}

document.getElementById('botao-rascunho').addEventListener('click', () => salvar(false));
document.getElementById('botao-enviar').addEventListener('click', () => salvar(true));

// Consulta informativa: a verificação que vale é a do servidor no envio e na aprovação.
document.getElementById('botao-verificar').addEventListener('click', async () => {
  const corpo = montarCorpo(false);
  const area = document.getElementById('resultado-verificacao');
  if (!corpo.inicio || !corpo.fim) {
    area.innerHTML = '<p class="mensagem mensagem-aviso">Preencha a data e os horários primeiro.</p>';
    return;
  }

  const consultas = [];
  if (corpo.espaco_id) {
    const nome = form.espaco_id.selectedOptions[0].textContent;
    consultas.push({ nome, filtros: { espaco_id: corpo.espaco_id, publico: corpo.publico_estimado } });
  }
  for (const item of equipamentosEscolhidos) {
    consultas.push({ nome: nomeEquipamento(item.equipamento_id), filtros: item });
  }
  if (consultas.length === 0) {
    area.innerHTML = '<p class="mensagem mensagem-aviso">Escolha um espaço ou equipamento.</p>';
    return;
  }

  const linhas = [];
  for (const c of consultas) {
    try {
      const r = await api.get('/disponibilidade/verificar', { ...c.filtros, inicio: corpo.inicio, fim: corpo.fim });
      linhas.push(r.disponivel
        ? `<li><span class="etiqueta etiqueta-livre">Disponível</span> ${esc(c.nome)}</li>`
        : `<li><span class="etiqueta etiqueta-reserva">Indisponível</span> ${esc(r.motivo)}</li>`);
    } catch (erro) {
      linhas.push(`<li><span class="etiqueta etiqueta-reserva">Erro</span> ${esc(erro.message)}</li>`);
    }
  }
  area.innerHTML = `<div class="mensagem mensagem-aviso"><ul class="lista-faixas">${linhas.join('')}</ul></div>`;
});

async function carregarEdicao() {
  const s = await api.get(`/solicitacoes/${idEdicao}`);
  statusAtual = s.status;
  document.getElementById('titulo-pagina').textContent = `Editar solicitação #${s.id}`;
  document.title = `Editar solicitação #${s.id} - Reservas Fatec`;

  form.titulo.value = s.titulo;
  form.tipo.value = s.tipo;
  form.publico_estimado.value = s.publico_estimado;
  form.descricao.value = s.descricao;
  form.data.value = s.inicio.slice(0, 10);
  form.hora_inicio.value = horaDe(s.inicio);
  form.hora_fim.value = horaDe(s.fim);
  form.espaco_id.value = s.espacos[0] ? s.espacos[0].espaco_id : '';
  form.motivo.value = s.motivo || '';
  equipamentosEscolhidos = s.equipamentos.map((e) => ({ equipamento_id: e.equipamento_id, quantidade: e.quantidade }));

  const aviso = document.getElementById('aviso-edicao');
  if (s.status === 'aprovada') {
    mostrarMensagem(aviso, 'Esta solicitação já foi aprovada. Ao salvar, a disponibilidade será verificada de novo e ela voltará para análise.', 'aviso');
    document.getElementById('botao-rascunho').hidden = true;
    document.getElementById('botao-enviar').textContent = 'Salvar e enviar para nova análise';
  } else if (s.status === 'em_ajustes') {
    const devolucao = [...s.historico].reverse().find((h) => h.acao === 'devolver');
    mostrarMensagem(aviso, `Ajuste pedido: ${devolucao ? devolucao.justificativa : ''}`, 'aviso');
    document.getElementById('botao-rascunho').textContent = 'Salvar sem reenviar';
    document.getElementById('botao-enviar').textContent = 'Salvar e reenviar';
  } else if (s.status !== 'rascunho') {
    mostrarMensagem(aviso, `Uma solicitação "${STATUS_SOLICITACAO[s.status]}" não pode ser editada.`, 'erro');
    form.querySelectorAll('input, select, textarea, button').forEach((el) => { el.disabled = true; });
  }
}

iniciarPagina().then(async (usuario) => {
  const [espacos, equipamentos, parametros] = await Promise.all([
    api.get('/espacos', { ativo: 1 }),
    api.get('/equipamentos'),
    api.get('/parametros')
  ]);

  equipamentosDisponiveis = equipamentos;
  form.tipo.innerHTML = opcoesDeObjeto(TIPOS_ATIVIDADE, '', 'Selecione...');
  form.espaco_id.innerHTML = opcoesSelect(espacos, {
    texto: (e) => `${e.nome} (capacidade ${e.capacidade})`,
    vazio: 'Nenhum espaço (só equipamentos)'
  });
  // Só aparecem para escolha os equipamentos que estão operacionais.
  document.getElementById('equipamento').innerHTML = opcoesSelect(
    equipamentos.filter((e) => e.situacao === 'operacional'),
    {
      texto: (e) => `${e.nome} (${e.codigo_patrimonio})${e.tipo_controle === 'quantidade' ? ` - ${e.quantidade_total} un.` : ''}`,
      vazio: 'Selecione...'
    }
  );
  document.getElementById('quantidade').disabled = true;

  const p = Object.fromEntries(parametros.map((x) => [x.chave, x.valor]));
  document.getElementById('dica-funcionamento').textContent =
    `Funcionamento: ${p.horario_abertura} às ${p.horario_fechamento}. ` +
    `Envie com pelo menos ${p.antecedencia_min_horas} horas de antecedência.`;

  if (idEdicao) await carregarEdicao();
  else form.data.min = hojeISO();
  desenharEquipamentos();

  if (!temPermissao(usuario, 'solicitar')) {
    mostrarMensagem(mensagem, 'Seu perfil não pode criar solicitações.');
    form.hidden = true;
  }
}).catch((erro) => mostrarMensagem(mensagem, erro.message));
