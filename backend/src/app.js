const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const rotas = require('./routes');
const { rotaNaoEncontrada, tratarErros } = require('./middlewares/erros');

const app = express();

app.use(express.json());
app.use(cookieParser());

app.use('/api', rotas);
app.use('/api', rotaNaoEncontrada);

// O próprio Express serve as páginas do frontend.
app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));

app.use(tratarErros);

module.exports = app;
