const express = require('express');
const controller = require('../controllers/equipamentoController');
const { autenticar, permitir } = require('../middlewares/auth');

const router = express.Router();

router.use(autenticar);

router.get('/', controller.listarCategorias);
router.post('/', permitir('gerenciar_equipamentos'), controller.criarCategoria);
router.put('/:id', permitir('gerenciar_equipamentos'), controller.atualizarCategoria);

module.exports = router;
