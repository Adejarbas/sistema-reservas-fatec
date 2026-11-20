const express = require('express');
const controller = require('../controllers/usuarioController');
const { autenticar, permitir } = require('../middlewares/auth');

const router = express.Router();

router.use(autenticar, permitir('gerenciar_usuarios'));

router.get('/', controller.listar);
router.get('/:id', controller.buscar);
router.post('/', controller.criar);
router.put('/:id', controller.atualizar);
// Não existe DELETE: usuário é desativado para não perder o histórico.

module.exports = router;
