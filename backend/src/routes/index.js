const express = require('express');

const router = express.Router();

router.use('/auth', require('./authRoutes'));
router.use('/usuarios', require('./usuarioRoutes'));
router.use('/espacos', require('./espacoRoutes'));
router.use('/categorias', require('./categoriaRoutes'));
router.use('/equipamentos', require('./equipamentoRoutes'));
router.use('/bloqueios', require('./bloqueioRoutes'));
router.use('/solicitacoes', require('./solicitacaoRoutes'));
router.use('/reservas-equipamento', require('./reservaEquipamentoRoutes'));
router.use('/movimentacoes', require('./movimentacaoRoutes'));
router.use('/notificacoes', require('./notificacaoRoutes'));
router.use('/', require('./disponibilidadeRoutes'));
router.use('/', require('./adminRoutes'));

module.exports = router;
