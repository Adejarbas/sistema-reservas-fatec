const AppError = require('./AppError');

function vazio(valor) {
  return valor === undefined || valor === null || String(valor).trim() === '';
}

// Nomes dos campos como aparecem para o usuário na mensagem de erro.
const ROTULOS = {
  perfil_id: 'perfil',
  publico_estimado: 'público estimado',
  descricao: 'descrição',
  titulo: 'título',
  inicio: 'início',
  codigo_patrimonio: 'patrimônio',
  categoria_id: 'categoria'
};

function exigirCampos(dados, campos) {
  const faltando = campos.filter((campo) => vazio(dados[campo]));
  if (faltando.length > 0) {
    const nomes = faltando.map((campo) => ROTULOS[campo] || campo).join(', ');
    throw new AppError(`Preencha os campos obrigatórios: ${nomes}.`, 400, { campos: faltando });
  }
}

function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function inteiroPositivo(valor) {
  return Number.isInteger(Number(valor)) && Number(valor) > 0;
}

function idValido(valor) {
  if (!inteiroPositivo(valor)) {
    throw new AppError('Identificador inválido.', 400);
  }
  return Number(valor);
}

// Converte o que vier do formulário/JSON (true, 'true', 1, '1') em 1 ou 0.
function simOuNao(valor, padrao) {
  if (valor === undefined || valor === null) return padrao;
  return [true, 1, '1', 'true'].includes(valor) ? 1 : 0;
}

function texto(valor) {
  return valor === undefined || valor === null ? '' : String(valor).trim();
}

module.exports = { vazio, exigirCampos, emailValido, inteiroPositivo, idValido, simOuNao, texto };
