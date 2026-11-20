# Roteiro de demonstração

Tempo estimado: 10 a 15 minutos.

## Preparação (antes da apresentação)

```
cd backend
npm run seed
npm start
```

Abra `http://localhost:3000`. Senha de todos os usuários: `senha123`.

Dica: deixe duas janelas abertas, uma normal e outra anônima, para ficar logado com dois usuários ao mesmo tempo (o login fica no cookie de cada janela).

O seed cria as datas a partir do dia em que foi rodado. Nos passos abaixo, **D+3** quer dizer "daqui a 3 dias".

Situação inicial importante: o **Auditório já está aprovado de D+3, das 14:00 às 16:00**, para a "Palestra: Carreira em TI" (solicitação #1).

---

## 1. Solicitar o auditório

1. Entre como **aluno@exemplo.edu.br** (Ana, solicitante).
2. Mostre o menu: ela só vê as opções de solicitante.
3. Vá em **Agenda e disponibilidade**, escolha a data D+3 e mostre o Auditório ocupado das 14:00 às 16:00.
4. Vá em **Nova solicitação** e preencha:
   - Título: `Workshop de Banco de Dados`, tipo Oficina, público `60`
   - Data: D+3, das **16:00 às 18:00**
   - Espaço: Auditório
   - Equipamento: Microfone sem fio Shure (PAT-0102)
5. Clique em **Verificar disponibilidade**: aparece "Disponível".
6. Clique em **Enviar para análise**. A solicitação fica **Pendente**.

> Ponto a explicar: 16:00 às 18:00 **não conflita** com 14:00 às 16:00. Pela regra `inicioA < fimB e inicioB < fimA`, reservas encostadas são permitidas (CA-02).

## 2. Tentar reservar em horário conflitante

1. Ainda como Ana, vá em **Nova solicitação**.
2. Preencha com o Auditório em D+3, das **15:00 às 17:00**.
3. Clique em **Enviar para análise**.
4. Aparece a mensagem: **"O espaço Auditório já está reservado das 14:00 às 16:00 em DD/MM/AAAA."** (CA-01).

Variações para mostrar, se der tempo:
- Público `150` no Auditório: "O público estimado (150 pessoas) é maior que a capacidade do espaço Auditório (120 pessoas)." (CA-03)
- Equipamento "Caixa de som JBL": ele nem aparece na lista porque está em manutenção. Pela API, o pedido é recusado (CA-04).

## 3. Aprovar a solicitação

1. Em outra janela, entre como **gestor@exemplo.edu.br** (Roberto, secretaria).
2. Mostre o aviso (sino) de nova solicitação.
3. Vá em **Fila de aprovação** e abra o "Workshop de Banco de Dados".
4. Tente **Rejeitar** sem escrever justificativa: aparece "A justificativa é obrigatória para rejeitar a solicitação." (CA-07).
5. Clique em **Aprovar**. A solicitação fica **Aprovada** e o espaço também.
6. Mostre que o microfone continua **Pendente**: aprovar o evento não aprova os equipamentos (RN-18).
7. Mostre o **Histórico** com quem fez cada ação e quando.

> Ponto a explicar: a aprovação verifica o conflito **de novo**, dentro de uma transação `BEGIN IMMEDIATE`. Se duas pessoas aprovarem ao mesmo tempo, só uma consegue (CA-12, coberto por teste automático).

Extra: tente abrir a URL da API de aprovação logado como Ana. O servidor responde **403**, mesmo que ela tente "por fora" da tela (ver o teste em `tests/permissoes.test.js`).

## 4. Registrar a retirada do equipamento

1. Entre como **equipamentos@exemplo.edu.br** (Júlio).
2. Vá em **Retirada e devolução** e filtre por "Aguardando análise".
3. **Aprove** o microfone do Workshop.
4. Filtre por "Aprovada (aguardando retirada)" e clique em **Registrar retirada** e depois **Confirmar retirada**.
5. Abra a solicitação: o microfone está **Retirado**, com o responsável e o horário em "Retiradas e devoluções" (CA-10).

## 5. Registrar a devolução com avaria (opcional)

1. Filtre por "Retirado (aguardando devolução)".
2. Clique em **Registrar devolução**, escolha a condição **Avariado** e escreva a observação "Microfone não liga".
3. Vá em **Equipamentos**: o PAT-0102 está com a situação **Avariado**.
4. Volte como Ana e tente uma nova solicitação: o microfone não aparece mais como opção. Pela API, o pedido é recusado com "está avariado e não pode ser reservado" (CA-11).

## 6. Cancelamento (se der tempo)

1. Como **docente@exemplo.edu.br**, abra a "Palestra: Carreira em TI" (#1).
2. Clique em **Cancelar solicitação** e informe o motivo.
3. Volte em **Agenda**, data D+3: o horário das 14:00 às 16:00 do Auditório ficou **livre** (CA-09).

## 7. Testes automatizados

```
cd backend
npm test
```

Mostre os 46 testes passando, com os nomes dos critérios de aceite (CA-01, CA-03, CA-07, CA-11, CA-12...). A saída salva está em `docs/evidencias/saida-testes.txt`.
