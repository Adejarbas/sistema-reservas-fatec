const mensagem = document.getElementById('mensagem');
const formUsuario = document.getElementById('form-usuario');
const formAuditoria = document.getElementById('form-auditoria');
let usuarios = [];
let perfis = [];

function aviso(texto, tipo = 'erro') {
  mostrarMensagem(mensagem, texto, tipo);
  mensagem.focus();
}

// ---------- Abas ----------

function abrirAba(aba) {
  document.querySelectorAll('[role="tab"]').forEach((b) => {
    const selecionada = b === aba;
    b.setAttribute('aria-selected', String(selecionada));
    b.tabIndex = selecionada ? 0 : -1;
    document.getElementById(b.getAttribute('aria-controls')).hidden = !selecionada;
  });
  limparMensagem(mensagem);
  // A auditoria muda a cada ação, então recarrega sempre que a aba é aberta.
  if (aba.id === 'aba-auditoria') carregarAuditoria().catch((erro) => aviso(erro.message));
}

// Setas esquerda/direita trocam de aba (padrão de acessibilidade para abas).
document.querySelector('.abas').addEventListener('keydown', (evento) => {
  if (!['ArrowLeft', 'ArrowRight'].includes(evento.key)) return;
  const abas = [...document.querySelectorAll('[role="tab"]:not([hidden])')];
  const atual = abas.indexOf(document.activeElement);
  const proxima = abas[(atual + (evento.key === 'ArrowRight' ? 1 : -1) + abas.length) % abas.length];
  proxima.focus();
  abrirAba(proxima);
});

document.querySelector('.abas').addEventListener('click', (evento) => {
  const aba = evento.target.closest('[role="tab"]');
  if (aba) abrirAba(aba);
});

// ---------- Usuários ----------

function limparFormUsuario() {
  formUsuario.reset();
  formUsuario.editando_id.value = '';
  document.getElementById('titulo-form-usuario').textContent = 'Novo usuário';
  document.getElementById('dica-senha').textContent = 'Mínimo de 6 caracteres';
  document.getElementById('campo-usuario-ativo').hidden = true;
  document.getElementById('cancelar-usuario').hidden = true;
  marcarCamposInvalidos(formUsuario, []);
}

async function carregarUsuarios() {
  usuarios = await api.get('/usuarios');
  document.getElementById('lista-usuarios').innerHTML = usuarios.map((u) => `
    <tr>
      <td data-label="Nome">${esc(u.nome)}</td>
      <td data-label="E-mail">${esc(u.email)}</td>
      <td data-label="Perfil">${esc(u.perfil)}</td>
      <td data-label="Situação">${u.ativo ? badge('aprovada', { aprovada: 'Ativo' }) : badge('inativo', { inativo: 'Inativo' })}</td>
      <td class="td-acoes">
        <button type="button" class="botao botao-secundario botao-pequeno" data-editar="${u.id}">
          Editar<span class="visualmente-oculto"> ${esc(u.nome)}</span>
        </button>
      </td>
    </tr>`).join('');
}

document.getElementById('lista-usuarios').addEventListener('click', (evento) => {
  const id = evento.target.closest('[data-editar]')?.dataset.editar;
  if (!id) return;
  const u = usuarios.find((x) => x.id === Number(id));
  formUsuario.editando_id.value = u.id;
  formUsuario.nome.value = u.nome;
  formUsuario.email.value = u.email;
  formUsuario.perfil_id.value = u.perfil_id;
  formUsuario.ativo.checked = u.ativo;
  formUsuario.senha.value = '';
  document.getElementById('titulo-form-usuario').textContent = `Editar ${u.nome}`;
  document.getElementById('dica-senha').textContent = 'Deixe em branco para manter a senha atual';
  document.getElementById('campo-usuario-ativo').hidden = false;
  document.getElementById('cancelar-usuario').hidden = false;
  formUsuario.nome.focus();
});

document.getElementById('cancelar-usuario').addEventListener('click', limparFormUsuario);

formUsuario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const dados = dadosDoFormulario(formUsuario);
  const corpo = { nome: dados.nome, email: dados.email, perfil_id: dados.perfil_id };
  if (dados.senha) corpo.senha = dados.senha;

  const botao = evento.submitter;
  if (botao) botao.disabled = true;
  try {
    if (dados.editando_id) {
      corpo.ativo = formUsuario.ativo.checked;
      await api.put(`/usuarios/${dados.editando_id}`, corpo);
    } else {
      corpo.senha = dados.senha;
      await api.post('/usuarios', corpo);
    }
    limparFormUsuario();
    await carregarUsuarios();
    aviso('Usuário salvo com sucesso.', 'sucesso');
  } catch (erro) {
    mostrarMensagem(mensagem, erro.message);
    marcarCamposInvalidos(formUsuario, erro.campos);
  } finally {
    if (botao) botao.disabled = false;
  }
});

// ---------- Perfis ----------

async function carregarPerfis() {
  const dados = await api.get('/perfis');
  perfis = dados.perfis;
  formUsuario.perfil_id.innerHTML = opcoesSelect(perfis, { vazio: 'Selecione...' });

  document.getElementById('lista-perfis').innerHTML = perfis.map((p) => `
    <form class="card" data-perfil="${p.id}">
      <fieldset style="border: 0; padding: 0; margin: 0">
        <legend><h2 style="margin: 0">${esc(p.nome)}</h2></legend>
        <div class="lista-checkbox">
          ${Object.entries(dados.permissoesDisponiveis).map(([chave, descricao]) => `
            <label class="checkbox-linha">
              <input type="checkbox" name="permissoes" value="${chave}" ${p.permissoes.includes(chave) ? 'checked' : ''}>
              ${esc(descricao)}
            </label>`).join('')}
        </div>
      </fieldset>
      <button type="submit" class="botao">Salvar permissões</button>
    </form>`).join('');
}

document.getElementById('lista-perfis').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const form = evento.target;
  const permissoes = [...form.querySelectorAll('input:checked')].map((c) => c.value);
  try {
    await api.put(`/perfis/${form.dataset.perfil}`, { permissoes });
    await carregarPerfis();
    aviso('Permissões atualizadas. Valem a partir da próxima ação de cada usuário.', 'sucesso');
  } catch (erro) {
    aviso(erro.message);
  }
});

// ---------- Parâmetros ----------

async function carregarParametros() {
  const parametros = await api.get('/parametros');
  document.getElementById('lista-parametros').innerHTML = parametros.map((p) => `
    <form class="filtros" data-chave="${esc(p.chave)}" style="margin-bottom: 0.5rem">
      <div class="campo" style="grid-column: span 2">
        <label for="param-${esc(p.chave)}">${esc(p.descricao || p.chave)}</label>
        <input type="text" id="param-${esc(p.chave)}" name="valor" value="${esc(p.valor)}">
      </div>
      <div class="campo">
        <button type="submit" class="botao botao-secundario">Salvar</button>
      </div>
    </form>`).join('');
}

document.getElementById('lista-parametros').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const form = evento.target;
  try {
    await api.put(`/parametros/${form.dataset.chave}`, { valor: form.valor.value });
    aviso('Parâmetro atualizado.', 'sucesso');
  } catch (erro) {
    aviso(erro.message);
  }
});

// ---------- Auditoria ----------

async function carregarAuditoria() {
  const registros = await api.get('/auditoria', dadosDoFormulario(formAuditoria));
  document.getElementById('lista-auditoria').innerHTML = registros.length === 0
    ? '<tr><td colspan="5" class="vazio">Nenhum registro.</td></tr>'
    : registros.map((r) => `
      <tr>
        <td data-label="Data/hora">${dataHoraBR(r.data_hora)}</td>
        <td data-label="Usuário">${esc(r.usuario || '-')}</td>
        <td data-label="Ação">${esc(r.acao)}</td>
        <td data-label="Entidade">${esc(r.entidade)}${r.entidade_id ? ` #${r.entidade_id}` : ''}</td>
        <td data-label="Detalhes">${esc(r.detalhes || '')}</td>
      </tr>`).join('');
}

formAuditoria.addEventListener('submit', (evento) => {
  evento.preventDefault();
  carregarAuditoria().catch((erro) => aviso(erro.message));
});

// ---------- Início ----------

iniciarPagina().then(async (usuario) => {
  const abas = [...document.querySelectorAll('[role="tab"]')];
  abas.forEach((aba) => { aba.hidden = !temPermissao(usuario, aba.dataset.permissao); });
  const primeira = abas.find((a) => !a.hidden);
  if (!primeira) {
    aviso('Seu perfil não tem acesso à administração.');
    return;
  }
  abrirAba(primeira);

  if (temPermissao(usuario, 'gerenciar_usuarios')) {
    await carregarPerfis();
    await carregarUsuarios();
  }
  if (temPermissao(usuario, 'parametros')) await carregarParametros();
  if (temPermissao(usuario, 'auditoria')) await carregarAuditoria();
}).catch((erro) => aviso(erro.message));
