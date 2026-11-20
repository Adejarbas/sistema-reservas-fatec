// Lista de permissões que podem ser atribuídas a um perfil.
const PERMISSOES = {
  solicitar: 'Criar e acompanhar as próprias solicitações',
  ver_todas: 'Ver solicitações de todos os usuários',
  gerenciar_espacos: 'Cadastrar e editar espaços',
  decidir_espaco: 'Aprovar, rejeitar ou devolver solicitações de espaço',
  bloquear: 'Bloquear períodos de espaços e equipamentos',
  gerenciar_equipamentos: 'Cadastrar e editar equipamentos e categorias',
  decidir_equipamento: 'Aprovar ou rejeitar equipamentos solicitados',
  movimentar: 'Registrar retirada e devolução de equipamentos',
  gerenciar_usuarios: 'Gerenciar usuários e perfis',
  parametros: 'Alterar parâmetros do sistema',
  auditoria: 'Consultar a auditoria'
};

module.exports = { PERMISSOES };
