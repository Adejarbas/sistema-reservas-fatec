// Funções de apoio usadas por todas as páginas.

const STATUS_SOLICITACAO = {
  rascunho: 'Rascunho',
  pendente: 'Pendente',
  em_ajustes: 'Em ajustes',
  aprovada: 'Aprovada',
  rejeitada: 'Rejeitada',
  cancelada: 'Cancelada',
  concluida: 'Concluída'
};

const STATUS_RESERVA = {
  pendente: 'Pendente',
  aprovada: 'Aprovada',
  rejeitada: 'Rejeitada',
  cancelada: 'Cancelada',
  concluida: 'Concluída',
  retirado: 'Retirado',
  devolvido: 'Devolvido'
};

const SITUACAO_EQUIPAMENTO = {
  operacional: 'Operacional',
  manutencao: 'Em manutenção',
  avariado: 'Avariado',
  inativo: 'Inativo'
};

const TIPOS_ATIVIDADE = {
  palestra: 'Palestra',
  oficina: 'Oficina',
  minicurso: 'Minicurso',
  seminario: 'Seminário',
  reuniao: 'Reunião',
  cultural: 'Atividade cultural',
  extensao: 'Extensão',
  outro: 'Outro'
};

const ACOES_HISTORICO = {
  criar: 'criou a solicitação',
  editar: 'editou a solicitação',
  enviar: 'enviou para análise',
  reenviar: 'reenviou após ajustes',
  alterar: 'alterou a solicitação aprovada',
  aprovar: 'aprovou',
  rejeitar: 'rejeitou',
  devolver: 'devolveu para ajustes',
  cancelar: 'cancelou',
  concluir: 'concluiu',
  aprovar_equipamento: 'aprovou equipamento',
  rejeitar_equipamento: 'rejeitou equipamento',
  retirada: 'registrou retirada',
  devolucao: 'registrou devolução'
};

// Escapa o texto antes de colocar no HTML (proteção contra XSS).
function esc(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function dataBR(texto) {
  if (!texto) return '';
  const [ano, mes, dia] = texto.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

function horaDe(texto) {
  return texto ? texto.slice(11, 16) : '';
}

function dataHoraBR(texto) {
  return texto ? `${dataBR(texto)} ${horaDe(texto)}` : '';
}

function periodoBR(inicio, fim) {
  if (inicio.slice(0, 10) === fim.slice(0, 10)) {
    return `${dataBR(inicio)}, ${horaDe(inicio)} às ${horaDe(fim)}`;
  }
  return `${dataHoraBR(inicio)} até ${dataHoraBR(fim)}`;
}

function hojeISO(diasAMais = 0) {
  const data = new Date();
  data.setDate(data.getDate() + diasAMais);
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

function agoraISO() {
  const data = new Date();
  const hora = String(data.getHours()).padStart(2, '0');
  const minuto = String(data.getMinutes()).padStart(2, '0');
  return `${hojeISO()}T${hora}:${minuto}`;
}

function badge(status, rotulos = STATUS_SOLICITACAO) {
  return `<span class="badge badge-${esc(status)}">${esc(rotulos[status] || status)}</span>`;
}

function mostrarMensagem(elemento, texto, tipo = 'erro') {
  elemento.className = `mensagem mensagem-${tipo}`;
  elemento.textContent = texto;
  elemento.hidden = false;
  elemento.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
}

function limparMensagem(elemento) {
  elemento.hidden = true;
  elemento.textContent = '';
}

// Marca os campos que o servidor apontou como inválidos e leva o foco ao primeiro.
function marcarCamposInvalidos(formulario, campos = []) {
  formulario.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
  let primeiro = null;
  for (const nome of campos) {
    const campo = formulario.elements[nome];
    if (campo && campo.setAttribute) {
      campo.setAttribute('aria-invalid', 'true');
      primeiro = primeiro || campo;
    }
  }
  if (primeiro) primeiro.focus();
}

function parametroUrl(nome) {
  return new URLSearchParams(window.location.search).get(nome);
}

function temPermissao(usuario, ...permissoes) {
  return permissoes.some((p) => usuario.permissoes.includes(p));
}

function opcoesSelect(lista, { valor = 'id', texto = 'nome', selecionado = '', vazio = null } = {}) {
  let html = vazio !== null ? `<option value="">${esc(vazio)}</option>` : '';
  for (const item of lista) {
    const v = typeof valor === 'function' ? valor(item) : item[valor];
    const t = typeof texto === 'function' ? texto(item) : item[texto];
    const marcado = String(v) === String(selecionado) ? ' selected' : '';
    html += `<option value="${esc(v)}"${marcado}>${esc(t)}</option>`;
  }
  return html;
}

function opcoesDeObjeto(objeto, selecionado = '', vazio = null) {
  const lista = Object.entries(objeto).map(([id, nome]) => ({ id, nome }));
  return opcoesSelect(lista, { selecionado, vazio });
}

// Lê os campos do formulário em um objeto simples.
function dadosDoFormulario(formulario) {
  return Object.fromEntries(new FormData(formulario).entries());
}
