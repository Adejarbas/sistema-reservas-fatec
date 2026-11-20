const express = require('express');
const controller = require('../controllers/disponibilidadeController');
const { autenticar } = require('../middlewares/auth');

const router = express.Router();

router.get('/disponibilidade', autenticar, controller.agendaDoDia);
router.get('/disponibilidade/verificar', autenticar, controller.verificar);
router.get('/agenda', controller.agendaPublica);

module.exports = router;
