// Datas trafegam e ficam no banco como texto 'AAAA-MM-DDTHH:MM' (horário local).

const FORMATO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function paraTexto(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  const hora = String(data.getHours()).padStart(2, '0');
  const minuto = String(data.getMinutes()).padStart(2, '0');
  return `${ano}-${mes}-${dia}T${hora}:${minuto}`;
}

// Recusa formatos errados e datas que não existem (ex.: 2026-02-30T10:00).
function dataValida(texto) {
  if (typeof texto !== 'string' || !FORMATO.test(texto)) return false;
  const data = new Date(texto);
  return !Number.isNaN(data.getTime()) && paraTexto(data) === texto;
}

function diaValido(texto) {
  return typeof texto === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(texto) && dataValida(`${texto}T00:00`);
}

function somarMinutos(texto, minutos) {
  const data = new Date(texto);
  data.setMinutes(data.getMinutes() + minutos);
  return paraTexto(data);
}

function agora() {
  return paraTexto(new Date());
}

function dataRelativa(diasAPartirDeHoje, hora) {
  const data = new Date();
  data.setDate(data.getDate() + diasAPartirDeHoje);
  return `${paraTexto(data).slice(0, 10)}T${hora}`;
}

function hora(texto) {
  return texto.slice(11, 16);
}

function diaBR(texto) {
  const [ano, mes, dia] = texto.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

// Ex.: "das 14:00 às 16:00 em 22/11/2026"
function descreverPeriodo(inicio, fim) {
  if (inicio.slice(0, 10) === fim.slice(0, 10)) {
    return `das ${hora(inicio)} às ${hora(fim)} em ${diaBR(inicio)}`;
  }
  return `de ${diaBR(inicio)} ${hora(inicio)} até ${diaBR(fim)} ${hora(fim)}`;
}

module.exports = { dataValida, diaValido, somarMinutos, agora, dataRelativa, hora, diaBR, descreverPeriodo };
