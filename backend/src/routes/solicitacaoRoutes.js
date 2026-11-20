const express = require('express');
const controller = require('../controllers/solicitacaoController');
const { autenticar, permitir } = require('../middlewares/auth');

const router = express.Router();

router.use(autenticar);

const analista = permitir('decidir_espaco', 'decidir_equipamento');

router.get('/', controller.listar);
router.get('/:id', controller.detalhar);

// Solicitante
router.post('/', permitir('solicitar'), controller.criar);
router.put('/:id', permitir('solicitar'), controller.atualizar);
router.patch('/:id/enviar', permitir('solicitar'), controller.enviar);
router.patch('/:id/cancelar', controller.cancelar); // dono ou analista (conferido no service)

// Secretaria / responsável por equipamentos
router.patch('/:id/aprovar', analista, controller.aprovar);
router.patch('/:id/rejeitar', analista, controller.rejeitar);
router.patch('/:id/devolver', analista, controller.devolver);
router.patch('/:id/concluir', analista, controller.concluir);

module.exports = router;
