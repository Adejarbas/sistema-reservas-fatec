const express = require('express');
const controller = require('../controllers/bloqueioController');
const { autenticar, permitir } = require('../middlewares/auth');

const router = express.Router();

router.use(autenticar);

router.get('/', controller.listar);
router.post('/', permitir('bloquear'), controller.criar);
router.delete('/:id', permitir('bloquear'), controller.remover);

module.exports = router;
