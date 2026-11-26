# Roteiro de demonstração

## Preparação

```
cd backend
npm run seed
npm start
```

Acesse `http://localhost:3000`. Senha de todos os usuários: `senha123`.

O seed cria as datas a partir do dia em que foi executado. Neste roteiro, **D+3** significa "daqui a 3 dias".

Situação inicial: o **Auditório já está aprovado em D+3, das 14:00 às 16:00**, para a "Palestra: Carreira em TI" (solicitação #1).

Para usar dois usuários ao mesmo tempo, abra uma janela normal e outra anônima.

---

## 1. Solicitar o auditório

1. Entrar como **aluno@exemplo.edu.br** (Ana, solicitante).
2. Abrir **Agenda e disponibilidade** na data D+3.
   - Resultado esperado: o Auditório aparece ocupado das 14:00 às 16:00.
3. Abrir **Nova solicitação** e preencher:
   - Título: `Workshop de Banco de Dados`, tipo Oficina, público `60`
   - Data: D+3, das **16:00 às 18:00**
   - Espaço: Auditório
   - Equipamento: Microfone sem fio Shure (PAT-0102)
4. Clicar em **Verificar disponibilidade**.
   - Resultado esperado: "Disponível". Horários encostados (16:00 com 16:00) não são conflito (CA-02).
5. Clicar em **Enviar para análise**.
   - Resultado esperado: a solicitação fica **Pendente**.

## 2. Detectar conflito de horário

1. Ainda como Ana, abrir **Nova solicitação** com o Auditório em D+3, das **15:00 às 17:00**.
2. Clicar em **Enviar para análise**.
   - Resultado esperado: "O espaço Auditório já está reservado das 14:00 às 16:00 em DD/MM/AAAA." (CA-01)

Outros casos de validação:

| Ação | Resultado esperado |
|---|---|
| Público `150` no Auditório | "O público estimado (150 pessoas) é maior que a capacidade do espaço Auditório (120 pessoas)." (CA-03) |
| Procurar a "Caixa de som JBL" | Não aparece na lista porque está em manutenção. Pela API, o pedido é recusado (CA-04) |

## 3. Aprovar a solicitação

1. Entrar como **gestor@exemplo.edu.br** (Roberto, secretaria).
   - Resultado esperado: o sino mostra o aviso da nova solicitação.
2. Abrir **Fila de aprovação** e depois o "Workshop de Banco de Dados".
3. Clicar em **Rejeitar** sem justificativa.
   - Resultado esperado: "A justificativa é obrigatória para rejeitar a solicitação." (CA-07)
4. Clicar em **Aprovar**.
   - Resultado esperado: a solicitação e o espaço ficam **Aprovados**. O microfone continua **Pendente**, porque a aprovação do equipamento é feita pelo responsável pelos equipamentos (RN-18).
5. Conferir o **Histórico**: cada ação aparece com o responsável e a data.

A aprovação de duas solicitações para o mesmo horário ao mesmo tempo está coberta pelo teste automático do CA-12 (`tests/aprovacao.test.js`). O bloqueio de acesso pela API (403 para quem não tem permissão) está em `tests/permissoes.test.js`.

## 4. Registrar a retirada do equipamento

1. Entrar como **equipamentos@exemplo.edu.br** (Júlio).
2. Abrir **Retirada e devolução**, filtrar por "Aguardando análise" e **aprovar** o microfone do Workshop.
3. Filtrar por "Aprovada (aguardando retirada)", clicar em **Registrar retirada** e depois em **Confirmar retirada**.
   - Resultado esperado: na solicitação, o microfone aparece como **Retirado**, com o responsável e o horário em "Retiradas e devoluções" (CA-10).

## 5. Registrar a devolução com avaria

1. Filtrar por "Retirado (aguardando devolução)".
2. Clicar em **Registrar devolução**, escolher a condição **Avariado** e escrever a observação "Microfone não liga".
   - Resultado esperado: em **Equipamentos**, o PAT-0102 aparece com a situação **Avariado**.
3. Entrar como Ana e abrir uma nova solicitação.
   - Resultado esperado: o microfone não aparece entre as opções. Pela API, o pedido é recusado com "está avariado e não pode ser reservado" (CA-11).

## 6. Cancelar uma reserva

1. Entrar como **docente@exemplo.edu.br** e abrir a "Palestra: Carreira em TI" (#1).
2. Clicar em **Cancelar solicitação** e informar o motivo.
   - Resultado esperado: na **Agenda**, data D+3, o Auditório fica livre das 14:00 às 16:00 (CA-09).

## 7. Exportar relatório em CSV

1. Entrar como gestor e abrir **Todas as solicitações**.
2. Filtrar por status "Aprovada" e por um período.
3. Clicar em **Exportar CSV**.
   - Resultado esperado: o arquivo abre no Excel só com as linhas filtradas e com os acentos corretos.

## 8. Testes automatizados

```
cd backend
npm test
```

Resultado esperado: 46 testes passando, com os nomes dos critérios de aceite (CA-01, CA-03, CA-07, CA-11, CA-12...). A saída salva está em `docs/evidencias/saida-testes.txt`.
