const express = require('express');
const controller = require('../controllers/movimentacaoController');
const { autenticar, permitir } = require('../middlewares/auth');

const router = express.Router();

router.use(autenticar, permitir('movimentar'));

router.get('/', controller.listar);
router.post('/', controller.registrar);

module.exports = router;
