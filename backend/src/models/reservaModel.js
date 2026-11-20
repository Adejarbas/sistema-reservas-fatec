const { db } = require('../db');

// ---------- Reservas de espaço ----------

function listarEspacosDaSolicitacao(solicitacaoId) {
  return db.prepare(`
    SELECT re.*, e.nome AS espaco, e.capacidade, e.localizacao
    FROM reserva_espaco re
    JOIN espaco e ON e.id = re.espaco_id
    WHERE re.solicitacao_id = ?`).all(solicitacaoId);
}

// Reserva aprovada que conflita com o período (regra: inicioA < fimB e inicioB < fimA).
function conflitoEspaco(espacoId, inicio, fim, ignorarSolicitacaoId = 0) {
  return db.prepare(`
    SELECT re.inicio, re.fim, re.solicitacao_id
    FROM reserva_espaco re
    WHERE re.espaco_id = ? AND re.status = 'aprovada' AND re.solicitacao_id <> ?
      AND re.inicio < ? AND ? < re.fim
    ORDER BY re.inicio LIMIT 1`).get(espacoId, ignorarSolicitacaoId, fim, inicio);
}

function atualizarStatusEspacos(solicitacaoId, statusAtuais, novoStatus, justificativa = null) {
  const marcadores = statusAtuais.map(() => '?').join(', ');
  db.prepare(`
    UPDATE reserva_espaco SET status = ?, justificativa = ?
    WHERE solicitacao_id = ? AND status IN (${marcadores})`).run(novoStatus, justificativa, solicitacaoId, ...statusAtuais);
}

// ---------- Reservas de equipamento ----------

const SELECT_RESERVA_EQUIP = `
  SELECT rq.*, eq.nome AS equipamento, eq.codigo_patrimonio, eq.tipo_controle, eq.situacao,
         s.status AS status_solicitacao, s.solicitante_id, u.nome AS solicitante,
         a.titulo AS atividade
  FROM reserva_equipamento rq
  JOIN equipamento eq ON eq.id = rq.equipamento_id
  JOIN solicitacao s ON s.id = rq.solicitacao_id
  JOIN usuario u ON u.id = s.solicitante_id
  JOIN atividade a ON a.id = s.atividade_id`;

function listarEquipamentosDaSolicitacao(solicitacaoId) {
  return db.prepare(`${SELECT_RESERVA_EQUIP} WHERE rq.solicitacao_id = ? ORDER BY rq.id`).all(solicitacaoId);
}

function buscarReservaEquipamento(id) {
  return db.prepare(`${SELECT_RESERVA_EQUIP} WHERE rq.id = ?`).get(id);
}

// Lista usada pelo responsável por equipamentos (análise, retirada e devolução).
// Rascunho e "em ajustes" ficam de fora porque ainda não podem ser analisados.
function listarReservasEquipamento({ status, data, equipamentoId } = {}) {
  const condicoes = ["s.status NOT IN ('rascunho', 'em_ajustes')"];
  const valores = [];

  if (status) {
    condicoes.push('rq.status = ?');
    valores.push(status);
  }
  if (data) {
    condicoes.push('rq.inicio < ? AND rq.fim > ?');
    valores.push(`${data}T24:00`, `${data}T00:00`);
  }
  if (equipamentoId) {
    condicoes.push('rq.equipamento_id = ?');
    valores.push(equipamentoId);
  }

  return db.prepare(`${SELECT_RESERVA_EQUIP} WHERE ${condicoes.join(' AND ')} ORDER BY rq.inicio LIMIT 200`).all(...valores);
}

// Reservas que ocupam o equipamento no período. Item retirado e ainda não
// devolvido continua ocupado mesmo depois do horário previsto de término.
function ocupacoesEquipamento(equipamentoId, inicio, fim, ignorarSolicitacaoId = 0) {
  return db.prepare(`
    SELECT rq.inicio, rq.fim, rq.quantidade, rq.status
    FROM reserva_equipamento rq
    WHERE rq.equipamento_id = ? AND rq.solicitacao_id <> ?
      AND ((rq.status = 'aprovada' AND rq.inicio < ? AND ? < rq.fim)
        OR (rq.status = 'retirado' AND rq.inicio < ?))
    ORDER BY rq.inicio`).all(equipamentoId, ignorarSolicitacaoId, fim, inicio, fim);
}

function atualizarStatusEquipamento(id, novoStatus, justificativa = null) {
  db.prepare('UPDATE reserva_equipamento SET status = ?, justificativa = ? WHERE id = ?').run(novoStatus, justificativa, id);
}

function atualizarStatusEquipamentos(solicitacaoId, statusAtuais, novoStatus, justificativa = null) {
  const marcadores = statusAtuais.map(() => '?').join(', ');
  db.prepare(`
    UPDATE reserva_equipamento SET status = ?, justificativa = ?
    WHERE solicitacao_id = ? AND status IN (${marcadores})`).run(novoStatus, justificativa, solicitacaoId, ...statusAtuais);
}

// Reservas futuras já aprovadas de um equipamento (para avisar quando ele fica indisponível).
function futurasAprovadasDoEquipamento(equipamentoId, aPartirDe) {
  return db.prepare(`${SELECT_RESERVA_EQUIP}
    WHERE rq.equipamento_id = ? AND rq.status = 'aprovada' AND rq.fim > ?`).all(equipamentoId, aPartirDe);
}

// ---------- Usadas por solicitações e bloqueios ----------

function substituirReservas(solicitacaoId, { espacoId, equipamentos, inicio, fim }) {
  db.prepare('DELETE FROM reserva_espaco WHERE solicitacao_id = ?').run(solicitacaoId);
  db.prepare('DELETE FROM reserva_equipamento WHERE solicitacao_id = ?').run(solicitacaoId);

  if (espacoId) {
    db.prepare('INSERT INTO reserva_espaco (solicitacao_id, espaco_id, inicio, fim) VALUES (?, ?, ?, ?)')
      .run(solicitacaoId, espacoId, inicio, fim);
  }
  const inserirEquip = db.prepare(`
    INSERT INTO reserva_equipamento (solicitacao_id, equipamento_id, inicio, fim, quantidade)
    VALUES (?, ?, ?, ?, ?)`);
  for (const item of equipamentos) {
    inserirEquip.run(solicitacaoId, item.equipamento_id, inicio, fim, item.quantidade);
  }
}

// Reservas aprovadas que caem dentro de um bloqueio novo.
function aprovadasNoPeriodo(tipo, recursoId, inicio, fim) {
  const tabela = tipo === 'espaco' ? 'reserva_espaco' : 'reserva_equipamento';
  const coluna = tipo === 'espaco' ? 'espaco_id' : 'equipamento_id';
  return db.prepare(`
    SELECT r.id, r.solicitacao_id, r.inicio, r.fim, s.solicitante_id, a.titulo AS atividade
    FROM ${tabela} r
    JOIN solicitacao s ON s.id = r.solicitacao_id
    JOIN atividade a ON a.id = s.atividade_id
    WHERE r.${coluna} = ? AND r.status IN ('aprovada', 'retirado')
      AND r.inicio < ? AND ? < r.fim`).all(recursoId, fim, inicio);
}

// Ocupações de um dia inteiro, usadas na tela de agenda/disponibilidade.
// 'T24:00' funciona como "fim do dia" porque a comparação é de texto.
function ocupacoesDoDia(tipo, dia) {
  const inicioDia = `${dia}T00:00`;
  const fimDia = `${dia}T24:00`;

  if (tipo === 'espaco') {
    return db.prepare(`
      SELECT re.espaco_id AS recurso_id, re.inicio, re.fim, a.titulo AS descricao, re.solicitacao_id
      FROM reserva_espaco re
      JOIN solicitacao s ON s.id = re.solicitacao_id
      JOIN atividade a ON a.id = s.atividade_id
      WHERE re.status = 'aprovada' AND re.inicio < ? AND re.fim > ?
      ORDER BY re.inicio`).all(fimDia, inicioDia);
  }
  return db.prepare(`
    SELECT rq.equipamento_id AS recurso_id, rq.inicio, rq.fim, rq.quantidade, rq.status,
           a.titulo AS descricao, rq.solicitacao_id
    FROM reserva_equipamento rq
    JOIN solicitacao s ON s.id = rq.solicitacao_id
    JOIN atividade a ON a.id = s.atividade_id
    WHERE (rq.status = 'aprovada' AND rq.inicio < ? AND rq.fim > ?)
       OR (rq.status = 'retirado' AND rq.inicio < ?)
    ORDER BY rq.inicio`).all(fimDia, inicioDia, fimDia);
}

module.exports = {
  listarEspacosDaSolicitacao,
  conflitoEspaco,
  atualizarStatusEspacos,
  listarEquipamentosDaSolicitacao,
  buscarReservaEquipamento,
  listarReservasEquipamento,
  ocupacoesEquipamento,
  atualizarStatusEquipamento,
  atualizarStatusEquipamentos,
  futurasAprovadasDoEquipamento,
  substituirReservas,
  aprovadasNoPeriodo,
  ocupacoesDoDia
};
