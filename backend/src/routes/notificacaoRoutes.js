const express = require('express');
const controller = require('../controllers/notificacaoController');
const { autenticar } = require('../middlewares/auth');

const router = express.Router();

router.use(autenticar);

router.get('/', controller.listar);
router.patch('/lidas', controller.marcarTodasLidas);
router.patch('/:id/lida', controller.marcarLida);

module.exports = router;
