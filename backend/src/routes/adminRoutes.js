const express = require('express');
const controller = require('../controllers/adminController');
const { autenticar, permitir } = require('../middlewares/auth');

const router = express.Router();

router.get('/perfis', autenticar, permitir('gerenciar_usuarios'), controller.listarPerfis);
router.put('/perfis/:id', autenticar, permitir('gerenciar_usuarios'), controller.atualizarPerfil);

// Qualquer usuário logado pode ver os parâmetros (o front usa para mostrar o horário de funcionamento).
router.get('/parametros', autenticar, controller.listarParametros);
router.put('/parametros/:chave', autenticar, permitir('parametros'), controller.atualizarParametro);

router.get('/auditoria', autenticar, permitir('auditoria'), controller.listarAuditoria);

module.exports = router;
