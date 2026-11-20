const formEspaco = document.getElementById('form-espaco');
const mensagem = document.getElementById('mensagem');
let espacos = [];

function limparFormulario() {
  formEspaco.reset();
  formEspaco.editando_id.value = '';
  document.getElementById('titulo-form').textContent = 'Novo espaço';
  document.getElementById('campo-ativo').hidden = true;
  document.getElementById('botao-cancelar').hidden = true;
  marcarCamposInvalidos(formEspaco, []);
}

async function carregarLista() {
  espacos = await api.get('/espacos');
  document.getElementById('lista').innerHTML = espacos.map((e) => `
    <tr>
      <td data-label="Nome">${esc(e.nome)}</td>
      <td data-label="Localização">${esc(e.localizacao || '-')}</td>
      <td data-label="Capacidade">${e.capacidade}</td>
      <td data-label="Situação">${e.ativo ? badge('aprovada', { aprovada: 'Ativo' }) : badge('inativo', { inativo: 'Inativo' })}</td>
      <td class="td-acoes">
        <button type="button" class="botao botao-secundario botao-pequeno" data-editar="${e.id}">
          Editar<span class="visualmente-oculto"> ${esc(e.nome)}</span>
        </button>
      </td>
    </tr>`).join('');
}

document.getElementById('lista').addEventListener('click', (evento) => {
  const id = evento.target.closest('[data-editar]')?.dataset.editar;
  if (!id) return;
  const espaco = espacos.find((e) => e.id === Number(id));

  formEspaco.editando_id.value = espaco.id;
  formEspaco.nome.value = espaco.nome;
  formEspaco.localizacao.value = espaco.localizacao || '';
  formEspaco.capacidade.value = espaco.capacidade;
  formEspaco.ativo.checked = espaco.ativo === 1;
  document.getElementById('titulo-form').textContent = `Editar ${espaco.nome}`;
  document.getElementById('campo-ativo').hidden = false;
  document.getElementById('botao-cancelar').hidden = false;
  formEspaco.nome.focus();
});

document.getElementById('botao-cancelar').addEventListener('click', limparFormulario);

formEspaco.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  limparMensagem(mensagem);
  const dados = dadosDoFormulario(formEspaco);
  const corpo = { nome: dados.nome, localizacao: dados.localizacao, capacidade: dados.capacidade };

  const botao = evento.submitter;
  if (botao) botao.disabled = true;
  try {
    if (dados.editando_id) {
      corpo.ativo = formEspaco.ativo.checked;
      await api.put(`/espacos/${dados.editando_id}`, corpo);
    } else {
      await api.post('/espacos', corpo);
    }
    mostrarMensagem(mensagem, 'Espaço salvo com sucesso.', 'sucesso');
    limparFormulario();
    await carregarLista();
  } catch (erro) {
    mostrarMensagem(mensagem, erro.message);
    marcarCamposInvalidos(formEspaco, erro.campos);
  } finally {
    if (botao) botao.disabled = false;
  }
});

iniciarPagina().then(carregarLista).catch((erro) => mostrarMensagem(mensagem, erro.message));
