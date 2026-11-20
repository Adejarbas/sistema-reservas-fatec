const express = require('express');
const controller = require('../controllers/equipamentoController');
const { autenticar, permitir } = require('../middlewares/auth');

const router = express.Router();

router.use(autenticar);

router.get('/', controller.listar);
router.get('/:id', controller.buscar);
router.post('/', permitir('gerenciar_equipamentos'), controller.criar);
router.put('/:id', permitir('gerenciar_equipamentos'), controller.atualizar);
// Registro de avaria, manutenção ou volta à operação.
router.patch('/:id/situacao', permitir('gerenciar_equipamentos', 'movimentar'), controller.alterarSituacao);

module.exports = router;
