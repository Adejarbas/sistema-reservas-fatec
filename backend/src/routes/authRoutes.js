const express = require('express');
const controller = require('../controllers/authController');
const { autenticar } = require('../middlewares/auth');

const router = express.Router();

router.post('/login', controller.login);
router.post('/logout', controller.logout);
router.get('/me', autenticar, controller.usuarioLogado);

module.exports = router;
