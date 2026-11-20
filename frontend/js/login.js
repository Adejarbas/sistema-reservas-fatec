const formLogin = document.getElementById('form-login');
const mensagemLogin = document.getElementById('mensagem');

formLogin.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  limparMensagem(mensagemLogin);
  marcarCamposInvalidos(formLogin, []);

  const { email, senha } = dadosDoFormulario(formLogin);
  if (!email || !senha) {
    mostrarMensagem(mensagemLogin, 'Informe o e-mail e a senha.');
    marcarCamposInvalidos(formLogin, [!email ? 'email' : null, !senha ? 'senha' : null].filter(Boolean));
    return;
  }

  const botao = formLogin.querySelector('button');
  botao.disabled = true;
  try {
    await api.post('/auth/login', { email, senha });
    window.location.href = 'painel.html';
  } catch (erro) {
    mostrarMensagem(mensagemLogin, erro.message);
    formLogin.senha.value = '';
    formLogin.senha.focus();
  } finally {
    botao.disabled = false;
  }
});
