const express = require('express');
const controller = require('../controllers/espacoController');
const { autenticar, permitir } = require('../middlewares/auth');

const router = express.Router();

router.use(autenticar);

router.get('/', controller.listar);
router.get('/:id', controller.buscar);
router.post('/', permitir('gerenciar_espacos'), controller.criar);
router.put('/:id', permitir('gerenciar_espacos'), controller.atualizar);

module.exports = router;
