const express = require('express');
const controller = require('../controllers/solicitacaoController');
const { autenticar, permitir } = require('../middlewares/auth');

const router = express.Router();

router.use(autenticar);

router.get('/', permitir('decidir_equipamento', 'movimentar'), controller.listarReservasEquipamento);
router.patch('/:id/aprovar', permitir('decidir_equipamento'), controller.aprovarEquipamento);
router.patch('/:id/rejeitar', permitir('decidir_equipamento'), controller.rejeitarEquipamento);

module.exports = router;
