const formAgenda = document.getElementById('form-filtro');
const areaAgenda = document.getElementById('agenda');

const ROTULOS_FAIXA = { livre: 'Livre', reserva: 'Ocupado', bloqueio: 'Bloqueado', retirado: 'Retirado (não devolvido)' };

function minutosDoDia(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// Recorta as ocupações para o horário de funcionamento do dia e calcula os intervalos livres.
function montarFaixas(ocupacoes, dia, abertura, fechamento) {
  const inicioDia = `${dia}T${abertura}`;
  const fimDia = `${dia}T${fechamento}`;
  const faixas = [];
  let cursor = inicioDia;

  const recortadas = ocupacoes
    .map((o) => ({
      ...o,
      inicio: o.inicio < inicioDia ? inicioDia : o.inicio,
      // equipamento retirado e não devolvido fica ocupado até o fim do dia
      fim: o.tipo === 'retirado' || o.fim > fimDia ? fimDia : o.fim
    }))
    .filter((o) => o.inicio < o.fim);

  for (const o of recortadas) {
    if (o.inicio > cursor) faixas.push({ tipo: 'livre', inicio: cursor, fim: o.inicio });
    faixas.push(o);
    if (o.fim > cursor) cursor = o.fim;
  }
  if (cursor < fimDia) faixas.push({ tipo: 'livre', inicio: cursor, fim: fimDia });
  return faixas;
}

function desenharRecurso(recurso, dados, tipo) {
  const faixas = montarFaixas(recurso.ocupacoes, dados.data, dados.abertura, dados.fechamento);
  const total = minutosDoDia(dados.fechamento) - minutosDoDia(dados.abertura);
  const posicao = (texto) => ((minutosDoDia(horaDe(texto)) - minutosDoDia(dados.abertura)) / total) * 100;

  const barra = faixas
    .filter((f) => f.tipo !== 'livre')
    .map((f) => `<span class="faixa-${f.tipo}" style="left:${posicao(f.inicio)}%; width:${posicao(f.fim) - posicao(f.inicio)}%"></span>`)
    .join('');

  const detalhe = tipo === 'espaco'
    ? `capacidade ${recurso.capacidade}`
    : `${esc(recurso.codigo_patrimonio)}${recurso.tipo_controle === 'quantidade' ? `, ${recurso.quantidade_total} unidades` : ''}`;

  const indisponivel = tipo === 'equipamento' && recurso.situacao !== 'operacional'
    ? `<p class="mensagem mensagem-aviso">Equipamento ${esc(SITUACAO_EQUIPAMENTO[recurso.situacao].toLowerCase())}: indisponível para reserva.</p>`
    : '';

  const itens = faixas.map((f) => {
    let texto = '';
    if (f.descricao) texto = esc(f.descricao);
    if (f.quantidade && recurso.tipo_controle === 'quantidade') texto += ` (${f.quantidade} un.)`;
    return `
      <li>
        <span class="horario">${horaDe(f.inicio)} - ${horaDe(f.fim)}</span>
        <span class="etiqueta etiqueta-${f.tipo}">${ROTULOS_FAIXA[f.tipo]}</span>
        <span>${texto}</span>
      </li>`;
  }).join('');

  return `
    <section class="card agenda-recurso">
      <h2>${esc(recurso.nome)} <small>(${detalhe})</small>
        ${tipo === 'equipamento' ? badge(recurso.situacao, SITUACAO_EQUIPAMENTO) : ''}</h2>
      ${indisponivel}
      <div class="barra-dia" aria-hidden="true">${barra}</div>
      <ul class="lista-faixas">${itens}</ul>
    </section>`;
}

async function carregarAgenda() {
  const mensagem = document.getElementById('mensagem');
  limparMensagem(mensagem);
  const tipo = formAgenda.tipo.value;

  try {
    const dados = await api.get('/disponibilidade', { data: formAgenda.data.value, tipo });
    areaAgenda.innerHTML = dados.recursos.length === 0
      ? '<p class="vazio">Nenhum recurso cadastrado.</p>'
      : dados.recursos.map((r) => desenharRecurso(r, dados, tipo)).join('');
  } catch (erro) {
    mostrarMensagem(mensagem, erro.message);
  }
}

formAgenda.addEventListener('submit', (evento) => {
  evento.preventDefault();
  carregarAgenda();
});

iniciarPagina().then(() => {
  formAgenda.data.value = parametroUrl('data') || hojeISO();
  carregarAgenda();
});
