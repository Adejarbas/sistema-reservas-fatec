// Chamadas à API. O cookie de login vai junto automaticamente (mesma origem).

async function requisicao(metodo, url, corpo) {
  const opcoes = { method: metodo, headers: {} };
  if (corpo !== undefined) {
    opcoes.headers['Content-Type'] = 'application/json';
    opcoes.body = JSON.stringify(corpo);
  }

  const resposta = await fetch(`/api${url}`, opcoes);

  // Sessão expirada ou sem login: volta para a tela de login.
  if (resposta.status === 401 && !url.startsWith('/auth/login')) {
    window.location.href = 'index.html';
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  const dados = resposta.status === 204 ? null : await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const erro = new Error((dados && dados.erro) || 'Não foi possível concluir a operação.');
    erro.status = resposta.status;
    erro.campos = (dados && dados.campos) || [];
    throw erro;
  }
  return dados;
}

const api = {
  get: (url, filtros) => requisicao('GET', url + montarQuery(filtros)),
  post: (url, corpo = {}) => requisicao('POST', url, corpo),
  put: (url, corpo = {}) => requisicao('PUT', url, corpo),
  patch: (url, corpo = {}) => requisicao('PATCH', url, corpo),
  delete: (url) => requisicao('DELETE', url)
};

// { status: 'pendente', de: '' } -> '?status=pendente' (ignora campos vazios)
function montarQuery(filtros) {
  if (!filtros) return '';
  const params = new URLSearchParams();
  for (const [chave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null && valor !== '') params.append(chave, valor);
  }
  const texto = params.toString();
  return texto ? `?${texto}` : '';
}
