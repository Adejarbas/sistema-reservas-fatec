const formFiltro = document.getElementById('form-filtro');
const areaEventos = document.getElementById('eventos');

formFiltro.de.value = hojeISO();
formFiltro.ate.value = hojeISO(30);

async function carregarEventos() {
  const mensagem = document.getElementById('mensagem');
  limparMensagem(mensagem);

  // Essa rota é pública, então usa fetch direto (sem redirecionar para o login).
  const params = new URLSearchParams({ de: formFiltro.de.value, ate: formFiltro.ate.value });
  const resposta = await fetch(`/api/agenda?${params}`);
  const dados = await resposta.json();
  if (!resposta.ok) {
    mostrarMensagem(mensagem, dados.erro);
    return;
  }

  if (dados.length === 0) {
    areaEventos.innerHTML = '<p class="vazio">Nenhum evento aprovado nesse período.</p>';
    return;
  }

  // Agrupa os eventos por dia
  const porDia = {};
  for (const evento of dados) {
    const dia = evento.inicio.slice(0, 10);
    (porDia[dia] = porDia[dia] || []).push(evento);
  }

  areaEventos.innerHTML = Object.entries(porDia).map(([dia, eventos]) => `
    <section class="card">
      <h2>${dataBR(dia)}</h2>
      <ul class="lista-faixas">
        ${eventos.map((e) => `
          <li>
            <span class="horario">${horaDe(e.inicio)} às ${horaDe(e.fim)}</span>
            <span><strong>${esc(e.titulo)}</strong> (${esc(TIPOS_ATIVIDADE[e.tipo] || e.tipo)})
            ${e.local ? ` - ${esc(e.local)}` : ''}</span>
          </li>`).join('')}
      </ul>
    </section>`).join('');
}

formFiltro.addEventListener('submit', (evento) => {
  evento.preventDefault();
  carregarEventos();
});

carregarEventos();
