<?php
/**
 * =====================================================================
 * API REST - Sistema Sinergy ERP
 * =====================================================================
 *
 * DESCRIÇÃO:
 * Ponto de entrada único da API REST do sistema Sinergy ERP.
 * Este arquivo funciona como um router centralizado que recebe todas
 * as requisições HTTP e direciona para os handlers apropriados.
 *
 * ARQUITETURA:
 * - Frontend (JavaScript) → Apache (.htaccess) → index.php → Handlers → MySQL
 * - Sistema de roteamento baseado em switch/case com pattern matching
 * - Suporta métodos HTTP: GET, POST, PUT, DELETE
 * - Responde exclusivamente em formato JSON
 *
 * FUNCIONALIDADES:
 * - 87+ endpoints REST organizados por módulos
 * - Parsing automático de JSON para POST/PUT
 * - Tratamento centralizado de CORS
 * - Validação de JSON com tratamento de erros
 * - Normalização de URLs e paths
 *
 * MÓDULOS DISPONÍVEIS:
 * - Autenticação (Login, Registro, Recuperação de Senha)
 * - Usuários e Permissões
 * - Estoque (Bobinas, Movimentações, Produtos)
 * - Comercial (Orçamentos, Pedidos, Clientes)
 * - Financeiro (Contas a Pagar/Receber, Dashboard)
 * - RH (Funcionários)
 * - Produção e Expedição
 * - COMEX (Rastreio de Containers)
 * - Suprimentos (Solicitações e Pedidos de Compra)
 * - Chat Interno
 * - Manutenções
 * - Notas Fiscais (XML NFe)
 *
 * @author Paulo (Desenvolvedor Original)
 * @version 2.0
 * @since 2024
 */

// =====================================================================
// CARREGAMENTO DE DEPENDÊNCIAS
// =====================================================================

// Configurações globais (DB_HOST, DB_NAME, API_BASE_PATH, etc)
require_once __DIR__ . '/../config/config.php';

// Conexão MySQLi com o banco de dados
require_once __DIR__ . '/../config/database.php';

// Configuração de headers CORS para permitir requisições cross-origin
require_once __DIR__ . '/../config/cors.php';

// Autoloader PSR-4 para classes (Response, Security, Validation)
require_once __DIR__ . '/../src/autoload.php';

// Funções auxiliares de compatibilidade
require_once __DIR__ . '/../src/Utils/helpers.php';

// Funções handlers principais (87 funções de processamento de endpoints)
require_once __DIR__ . '/../src/legacy_functions.php';

// Handlers especializados de estoque com suporte a múltiplas localizações
require_once __DIR__ . '/../src/estoque_produtos_handlers.php';

// =====================================================================
// CONFIGURAÇÃO INICIAL
// =====================================================================

// Configura headers CORS (Access-Control-Allow-Origin, Methods, Headers)
setup_cors();

// =====================================================================
// PROCESSAMENTO DA REQUISIÇÃO
// =====================================================================

// Captura o método HTTP (GET, POST, PUT, DELETE, OPTIONS)
$method = $_SERVER['REQUEST_METHOD'];

// Captura a URI completa da requisição
// Exemplo: /sinergy/api/orcamentos/45?status=pendente
$request_uri = $_SERVER['REQUEST_URI'];

// Base path da API definida em config.php
// Exemplo: /sinergy/api
$base_api_path = API_BASE_PATH;

// Remove o base path da URI para obter apenas o endpoint
// /sinergy/api/orcamentos/45 → /orcamentos/45
if (strpos($request_uri, $base_api_path) === 0) {
    $path = substr($request_uri, strlen($base_api_path));
} else {
    $path = $request_uri;
}

// Remove query string do path (mantém apenas o caminho limpo)
// /orcamentos/45?status=pendente → /orcamentos/45
$path_parts = explode('?', $path, 2);
$path = $path_parts[0];

// Remove /index.php do path se existir (caso seja chamado explicitamente)
// /index.php/orcamentos → /orcamentos
$path = str_replace('/index.php', '', $path);

// Normaliza path garantindo formato consistente
// '' ou '/' → '/status' (endpoint padrão)
// 'orcamentos' → '/orcamentos' (adiciona barra inicial)
if (empty($path) || $path === '/') {
    $path = '/status';
} elseif (substr($path, 0, 1) !== '/') {
    $path = '/' . $path;
}

// =====================================================================
// PARSING DE DADOS JSON
// =====================================================================

// Para requisições POST e PUT, lê o corpo da requisição e decodifica JSON
// O frontend envia dados no formato: { "campo": "valor", ... }
$input_data = null;
if (in_array($method, ['POST', 'PUT'])) {
    // Lê o raw input do corpo da requisição
    $raw_input = file_get_contents('php://input');

    // Decodifica JSON para array associativo PHP
    $input_data = json_decode($raw_input, true);

    // Valida se o JSON é válido (se houver conteúdo)
    if (json_last_error() !== JSON_ERROR_NONE && !empty($raw_input)) {
        sendJsonResponse(['error' => 'JSON inválido'], 400);
    }
}

// =====================================================================
// ROTEAMENTO DA API
// =====================================================================
//
// COMO FUNCIONA:
// 1. O switch(true) permite usar condições complexas em cada case
// 2. Cada case verifica o path e o método HTTP
// 3. Pattern matching com preg_match para rotas dinâmicas (ex: /pedidos/123)
// 4. Chama o handler correspondente passando os dados necessários
// 5. Handlers estão definidos em legacy_functions.php e estoque_produtos_handlers.php
//
// PADRÃO DE NOMENCLATURA DOS HANDLERS:
// - handleGet*()    : Buscar dados (GET)
// - handleAdd*()    : Criar novo registro (POST)
// - handleUpdate*() : Atualizar registro (PUT)
// - handleDelete*() : Deletar registro (DELETE)
//
// EXEMPLO DE FLUXO:
// Frontend: fetch('API_URL/orcamentos', {method: 'POST', body: JSON.stringify(data)})
//    ↓
// Router: case $path === '/orcamentos' && $method === 'POST'
//    ↓
// Handler: handleAddOrcamento($input_data)
//    ↓
// Backend: INSERT INTO Orcamentos (...) VALUES (...)
//    ↓
// Resposta: sendJsonResponse({success: true, id: 45}, 201)
// =====================================================================

try {
    switch (true) {
        // ============================================================
        // STATUS DA API (Health Check)
        // ============================================================
        // Endpoint para verificar se a API está respondendo
        case $path === '/status':
            handleStatus();
            break;

        // ============================================================
        // MÓDULO: AUTENTICAÇÃO E RECUPERAÇÃO DE SENHA
        // ============================================================
        // Gestão de login, registro e recuperação de senha

        // POST /register - Cria novo usuário no sistema
        case $path === '/register' && $method === 'POST':
            handleRegister($input_data);
            break;

        // POST /login - Autentica usuário e retorna dados da sessão
        case $path === '/login' && $method === 'POST':
            handleLogin($input_data);
            break;

        // POST /recover-password - Envia email com token de recuperação
        case $path === '/recover-password' && $method === 'POST':
            handleRecoverPassword($input_data);
            break;

        // POST /reset-password - Reseta senha usando token válido
        case $path === '/reset-password' && $method === 'POST':
            handleResetPassword($input_data);
            break;

        // ============================================================
        // MÓDULO: USUÁRIOS E PERFIL
        // ============================================================
        // Gestão de perfis de usuários, dados pessoais e listagens

        // GET/PUT /users/{username} - Busca ou atualiza perfil do usuário
        // Exemplo: /users/paulo.silva
        case preg_match('/^\/users\/([a-zA-Z0-9_.-]+)$/', $path, $matches):
            $username = $matches[1];
            if ($method === 'GET') {
                handleGetUserProfile($username);
            } elseif ($method === 'PUT') {
                handleUpdateUserProfile($username, $input_data);
            } else {
                sendJsonResponse(['error' => 'Método não permitido'], 405);
            }
            break;

        // GET /usuarios-lista - Retorna lista simplificada de usuários
        // Usado em dropdowns e seletores no frontend
        case $path === '/usuarios-lista' && $method === 'GET':
            handleGetUsuariosSimples();
            break;

        // GET /vendedores - Lista apenas usuários com perfil de vendedor
        // Usado para atribuir vendedores a orçamentos e pedidos
        case $path === '/vendedores' && $method === 'GET':
            handleGetListaVendedores();
            break;

        // GET /usuarios-sem-vinculo - Lista usuários sem vínculo com funcionários
        // Usado no cadastro de funcionários para vincular login
        case $path === '/usuarios-sem-vinculo' && $method === 'GET':
            handleGetUsuariosSemVinculo();
            break;

        // GET /usuarios-disponiveis - Alias para usuarios-sem-vinculo
        case $path === '/usuarios-disponiveis' && $method === 'GET':
            handleGetUsuariosSemVinculo();
            break;

        // ============================================================
        // MÓDULO: ESTOQUE DE BOBINAS (Matéria-Prima)
        // ============================================================
        // Gestão de bobinas de alumínio/aço para produção
        // Rastreamento de peso, espessura, largura, lotes e fornecedores

        // GET /bobinas - Lista todas as bobinas do estoque
        // POST /bobinas - Registra entrada de nova bobina
        case $path === '/bobinas':
            if ($method === 'GET') {
                handleGetBobinas();
            } elseif ($method === 'POST') {
                handleAddBobina($input_data);
            } else {
                sendJsonResponse(['error' => 'Método não permitido'], 405);
            }
            break;

        // GET /bobinas/{id} - Busca bobina específica
        // PUT /bobinas/{id} - Atualiza dados da bobina
        // DELETE /bobinas/{id} - Remove bobina do sistema
        case preg_match('/^\/bobinas\/(\d+)$/', $path, $matches):
            $bobina_id = (int)$matches[1];
            if ($method === 'GET') {
                handleGetBobinaById($bobina_id);
            } elseif ($method === 'PUT') {
                handleUpdateBobina($bobina_id, $input_data);
            } elseif ($method === 'DELETE') {
                handleDeleteBobina($bobina_id);
            } else {
                sendJsonResponse(['error' => 'Método não permitido'], 405);
            }
            break;

        // === PRODUÇÕES ===
        case $path === '/producoes':
            if ($method === 'GET') {
                handleGetProducoes();
            } elseif ($method === 'POST') {
                handleAddProducao($input_data);
            } else {
                sendJsonResponse(['error' => 'Método não permitido'], 405);
            }
            break;

        case preg_match('/^\/producoes\/(\d+)$/', $path, $matches):
            $producao_id = (int)$matches[1];
            if ($method === 'PUT') {
                handleUpdateProducao($producao_id, $input_data);
            } elseif ($method === 'DELETE') {
                handleDeleteProducao($producao_id);
            } else {
                sendJsonResponse(['error' => 'Método não permitido'], 405);
            }
            break;

        // === MOVIMENTAÇÕES ===
        case $path === '/movimentacoes':
            if ($method === 'GET') {
                handleGetMovimentacoes();
            } elseif ($method === 'POST') {
                handleAddMovimentacao($input_data);
            } else {
                sendJsonResponse(['error' => 'Método não permitido'], 405);
            }
            break;

        case preg_match('/^\/movimentacoes\/(\d+)$/', $path, $matches):
            $movimentacao_id = (int)$matches[1];
            if ($method === 'DELETE') {
                handleDeleteMovimentacao($movimentacao_id);
            } else {
                sendJsonResponse(['error' => 'Método não permitido'], 405);
            }
            break;

        // === MANUTENÇÕES ===
        case $path === '/manutencoes' && $method === 'GET':
            handleGetManutencoes();
            break;

        case $path === '/manutencoes' && $method === 'POST':
            handleAddManutencao($input_data);
            break;

        case preg_match('/^\/manutencoes\/(\d+)$/', $path, $matches):
            $manutencao_id = (int)$matches[1];
            if ($method === 'PUT') {
                handleUpdateManutencao($manutencao_id, $input_data);
            } elseif ($method === 'DELETE') {
                // TODO: Implementar handleDeleteManutencao se necessário
                // handleDeleteManutencao($manutencao_id);
            } else {
                sendJsonResponse(['error' => 'Método não permitido'], 405);
            }
            break;
            
        // === CHAT INTERNO ===
        case $path === '/chat/usuarios' && $method === 'GET':
            handleGetChatUsuarios();
            break;

        case $path === '/chat/mensagens' && $method === 'GET':
            // Ex: /chat/mensagens?usuarioID=5 (Pega conversa com usuario 5)
            handleGetChatMensagens($_GET['usuarioID'] ?? 0);
            break;

        case $path === '/chat/enviar' && $method === 'POST':
            handleEnviarMensagem($input_data);
            break;
            
        case $path === '/chat/heartbeat' && $method === 'POST':
            handleUpdateUserActivity($input_data['usuarioID']);
            break;
        
        // === NOTAS FISCAIS (XML) ===
        case $path === '/estoque/notas-fiscais' && $method === 'GET':
            handleGetNotasFiscais();
            break;

        case $path === '/estoque/notas-fiscais/upload' && $method === 'POST':
            // Nota: Para upload de arquivos, não usamos json_decode no input_data
            // O PHP popula $_FILES automaticamente.
            handleImportarXMLNFe();
            break;
        
        // Rota para pegar detalhes de UMA nota específica
        case preg_match('/^\/estoque\/notas-fiscais\/(\d+)$/', $path, $matches) && $method === 'GET':
            handleGetDetalhesNota($matches[1]);
            break;

        // === PRODUTOS ===
        case $path === '/produtos' && $method === 'GET':
            handleGetProdutos();
            break;

        case $path === '/produtos' && $method === 'POST':
            handleAddProduto($input_data);
            break;

        case preg_match('/^\/produtos\/(\d+)$/', $path, $matches):
            $produto_id = (int)$matches[1];
            if ($method === 'PUT') {
                handleUpdateProduto($produto_id, $input_data);
            } elseif ($method === 'DELETE') {
                handleDeleteProduto($produto_id);
            } else {
                sendJsonResponse(['error' => 'Método não permitido'], 405);
            }
            break;


        // Rota para buscar onde tem estoque de um produto
        case $path === '/estoque/locais-produto' && $method === 'GET':
            $prodID = $_GET['id'] ?? 0;
            handleGetLocaisProduto($prodID);
            break;
        
        // === ESTOQUE DE PRODUTOS ===
        case $path === '/estoque-produtos' && $method === 'GET':
            handleGetEstoqueProdutos();
            break;

        case $path === '/estoque-produtos/estatisticas' && $method === 'GET':
            handleGetEstatisticasEstoqueProdutos();
            break;

        case $path === '/estoque-produtos/baixo' && $method === 'GET':
            handleGetProdutosEstoqueBaixo();
            break;

        case $path === '/estoque-produtos' && $method === 'POST':
            handleSetEstoqueProduto($input_data);
            break;

        case $path === '/estoque-produtos/movimentar' && $method === 'POST':
            handleMovimentarEstoqueProduto($input_data);
            break;

        case preg_match('/^\/estoque-produtos\/(\d+)$/', $path, $matches):
            $produto_id = (int)$matches[1];
            if ($method === 'GET') {
                handleGetEstoqueProdutoById($produto_id);
            } else {
                sendJsonResponse(['error' => 'Método não permitido'], 405);
            }
            break;

        case preg_match('/^\/estoque-produtos\/(\d+)\/historico$/', $path, $matches):
            $produto_id = (int)$matches[1];
            if ($method === 'GET') {
                handleGetHistoricoMovimentacoesProduto($produto_id);
            } else {
                sendJsonResponse(['error' => 'Método não permitido'], 405);
            }
            break;

        // ============================================================
        // MÓDULO: ORÇAMENTOS (Comercial)
        // ============================================================
        // Criação e gestão de orçamentos para clientes
        // FLUXO: Orçamento → Aprovação → Converte automaticamente em Pedido
        //
        // IMPORTANTE: Quando um orçamento é aprovado (status='aprovado'),
        // o sistema automaticamente:
        // 1. Cria um registro na tabela Pedidos
        // 2. Copia todos os itens para ItensPedido
        // 3. Gera número de pedido sequencial
        // 4. Cria entrada em ContasReceber (financeiro)

        // GET /orcamentos - Lista todos os orçamentos com filtros
        case $path === '/orcamentos' && $method === 'GET':
            handleGetOrcamentos();
            break;

        // POST /orcamentos - Cria novo orçamento com itens
        // Usa transação MySQL para garantir consistência
        case $path === '/orcamentos' && $method === 'POST':
            handleAddOrcamento($input_data);
            break;

        // GET /orcamentos/{id} - Busca orçamento específico com itens
        // PUT /orcamentos/{id} - Atualiza orçamento (aprovar/rejeitar)
        // DELETE /orcamentos/{id} - Remove orçamento
        case preg_match('/^\/orcamentos\/(\d+)$/', $path, $matches):
            $orcamento_id = (int)$matches[1];
            if ($method === 'GET') {
                handleGetOrcamentoById($orcamento_id);
            } elseif ($method === 'PUT') {
                handleUpdateOrcamento($orcamento_id, $input_data);
            } elseif ($method === 'DELETE') {
                handleDeleteOrcamento($orcamento_id);
            } else {
                sendJsonResponse(['error' => 'Método não permitido'], 405);
            }
            break;

        // ============================================================
        // MÓDULO: PRODUÇÃO (Fluxo de Fabricação)
        // ============================================================
        // Gerencia a fila de produção e baixa de itens produzidos
        // INTEGRAÇÃO: Conecta Pedidos → Produção → Expedição

        // GET /producao/fila - Lista itens pendentes de produção
        // Busca ItensPedido onde StatusProducao = 'Pendente'
        case $path === '/producao/fila' && $method === 'GET':
            handleGetFilaProducao();
            break;

        // POST /producao/baixar-item - Marca item como produzido
        // Atualiza StatusProducao de 'Pendente' para 'Concluido'
        // Registra bobinas utilizadas e sucata gerada
        case $path === '/producao/baixar-item' && $method === 'POST':
            handleBaixarItemProducao($input_data);
            break;
            
        // === EXPEDIÇÃO (NOVO MÓDULO) ===
        case $path === '/expedicao/fila' && $method === 'GET':
            handleGetFilaExpedicao();
            break;
            
        // NOVA ROTA
        case $path === '/expedicao/historico' && $method === 'GET':
            handleGetHistoricoExpedicao();
            break;

        case $path === '/expedicao/baixar-item' && $method === 'POST':
            handleBaixarItemExpedicao($input_data);
            break;
        
        // NOVA ROTA DE HISTÓRICO
        case $path === '/producao/historico' && $method === 'GET':
            handleGetHistoricoProducao();
            break;

        // === PEDIDOS ===
        case $path === '/pedidos' && $method === 'GET':
            handleGetPedidos();
            break;

        case preg_match('/^\/pedidos\/(\d+)$/', $path, $matches):
            $pedido_id = (int)$matches[1];
            if ($method === 'GET') {
                handleGetPedidoById($pedido_id);
            } elseif ($method === 'PUT') {
                handleUpdatePedidoStatus($pedido_id, $input_data);
            } else {
                sendJsonResponse(['error' => 'Método não permitido'], 405);
            }
            break;

        // === CLIENTES ===
        case $path === '/clientes' && $method === 'GET':
            handleGetClientes();
            break;

        case $path === '/clientes' && $method === 'POST':
            handleAddCliente($input_data);
            break;

        case preg_match('/^\/clientes\/(\d+)$/', $path, $matches):
            $cliente_id = (int)$matches[1];
            if ($method === 'GET') {
                handleGetClienteById($cliente_id);
            } elseif ($method === 'PUT') {
                handleUpdateCliente($cliente_id, $input_data);
            } elseif ($method === 'DELETE') {
                handleDeleteCliente($cliente_id);
            } else {
                sendJsonResponse(['error' => 'Método não permitido'], 405);
            }
            break;
        
        // === FORNECEDORES (NOVO) ===
        case $path === '/fornecedores' && $method === 'GET':
            handleGetFornecedores();
            break;

        case $path === '/fornecedores' && $method === 'POST':
            handleAddFornecedor($input_data);
            break;

        case preg_match('/^\/fornecedores\/(\d+)$/', $path, $matches):
            $forn_id = (int)$matches[1];
            if ($method === 'PUT') {
                handleUpdateFornecedor($forn_id, $input_data);
            } elseif ($method === 'DELETE') {
                handleDeleteFornecedor($forn_id);
            } else {
                sendJsonResponse(['error' => 'Método não permitido'], 405);
            }
            break;

        // ============================================================
        // 7. FINANCEIRO (CORRIGIDO PARA ACEITAR HÍFEN)
        // ============================================================
        
        // Contas a Pagar (GET/POST)
        // Aceita tanto /contas-pagar quanto /contasapagar
        case ($path === '/contas-pagar' || $path === '/contasapagar' || strpos($path, '/contas-pagar') !== false) && $method === 'GET':
            handleGetContasPagar();
            break;

        case ($path === '/contas-pagar' || $path === '/contasapagar' || strpos($path, '/contas-pagar') !== false) && $method === 'POST':
            handleAddContaPagar($input_data);
            break;

        // Contas a Pagar ID (PUT/DELETE)
        case (preg_match('/^\/contas-pagar\/(\d+)$/', $path, $matches) || preg_match('/^\/contasapagar\/(\d+)$/', $path, $matches)) && $method === 'PUT':
            handleUpdateContaPagar($matches[1], $input_data);
            break;

        case (preg_match('/^\/contas-pagar\/(\d+)$/', $path, $matches) || preg_match('/^\/contasapagar\/(\d+)$/', $path, $matches)) && $method === 'DELETE':
            handleDeleteContaPagar($matches[1]);
            break;

        // Contas a Receber (GET)
        case ($path === '/contas-receber' || $path === '/contasareceber' || strpos($path, '/contas-receber') !== false) && $method === 'GET':
            handleGetContasReceber();
            break;

        // Contas a Receber ID (PUT)
        case (preg_match('/^\/contas-receber\/(\d+)$/', $path, $matches) || preg_match('/^\/contasareceber\/(\d+)$/', $path, $matches)) && $method === 'PUT':
            handleUpdateContaReceber($matches[1], $input_data);
            break;

        // Dashboard Financeiro
        case $path === '/financeiro/dashboard' && $method === 'GET':
            handleGetFinanceiroDashboard();
            break;

        // === FUNCIONÁRIOS/RH ===
        case $path === '/funcionarios' && $method === 'GET':
            handleGetFuncionarios();
            break;

        case $path === '/funcionarios' && $method === 'POST':
            handleAddFuncionario($input_data);
            break;

        case preg_match('/^\/funcionarios\/(\d+)$/', $path, $matches):
            $funcionario_id = (int)$matches[1];
            if ($method === 'PUT') {
                handleUpdateFuncionario($funcionario_id, $input_data);
            } else {
                sendJsonResponse(['error' => 'Método não permitido'], 405);
            }
            break;

        // === PERMISSÕES ===
        case preg_match('/^\/permissoes\/(\d+)$/', $path, $matches):
            $usuario_id = (int)$matches[1];
            if ($method === 'GET') {
                handleGetPermissoes($usuario_id);
            } elseif ($method === 'POST' || $method === 'PUT') {
                handleSavePermissoes($usuario_id, $input_data);
            } else {
                sendJsonResponse(['error' => 'Método não permitido'], 405);
            }
            break;
        
        // === COMEX / RASTREIO ===
        case $path === '/comex/rastreio' && $method === 'GET':
            handleGetRastreio();
            break;

        case $path === '/comex/rastreio' && $method === 'POST':
            handleAddRastreio($input_data);
            break;

        case preg_match('/^\/comex\/rastreio\/(\d+)$/', $path, $matches):
            $id = (int)$matches[1];
            if ($method === 'PUT') handleUpdateRastreio($id, $input_data);
            elseif ($method === 'DELETE') handleDeleteRastreio($id);
            break;

        // === SOLICITAÇÕES DE COMPRAS ===
        case $path === '/solicitacoes-compras' && $method === 'GET':
            handleGetSolicitacoesCompras();
            break;

        case $path === '/solicitacoes-compras' && $method === 'POST':
            handleAddSolicitacaoCompra($input_data);
            break;

        case preg_match('/^\/solicitacoes-compras\/(\d+)$/', $path, $matches):
            $solicitacao_id = (int)$matches[1];
            if ($method === 'PUT') {
                handleUpdateSolicitacaoCompra($solicitacao_id, $input_data);
            } elseif ($method === 'DELETE') {
                handleDeleteSolicitacaoCompra($solicitacao_id);
            } else {
                sendJsonResponse(['error' => 'Método não permitido'], 405);
            }
            break;

        // === AVISOS DO SISTEMA ===
        case $path === '/avisos' && $method === 'GET':
            handleGetAvisosSistema();
            break;

        case $path === '/avisos' && $method === 'POST':
            handleAddAvisoSistema($input_data);
            break;

        case preg_match('/^\/avisos\/(\d+)$/', $path, $matches):
            $aviso_id = (int)$matches[1];
            if ($method === 'DELETE') {
                handleDeleteAvisoSistema($aviso_id);
            } else {
                sendJsonResponse(['error' => 'Método não permitido'], 405);
            }
            break;
            
        // === CORREÇÃO DO ERRO 2: AVISOS DO SISTEMA (NOTIFICAÇÕES) ===
        case $path === '/avisos-sistema' && $method === 'GET':
            handleGetAvisosSistema();
            break;

        case $path === '/avisos-sistema' && $method === 'POST':
            handleAddAvisoSistema($input_data); // Changed to handleAddAvisoSistema based on legacy_functions.php
            break;

        case preg_match('/^\/avisos-sistema\/(\d+)$/', $path, $matches):
             if ($method === 'DELETE') {
                $id = (int)$matches[1];
                handleDeleteAvisoSistema($id);
             } else {
                sendJsonResponse(['error' => 'Método não permitido'], 405);
             }
            break;
            
        // === SUPRIMENTOS / GESTÃO DE COMPRAS ===
        case $path === '/suprimentos/compras' && $method === 'GET':
            handleGetPedidosCompra();
            break;

        case $path === '/suprimentos/compras' && $method === 'POST':
            handleAddPedidoCompra($input_data);
            break;

        case preg_match('/^\/suprimentos\/compras\/(\d+)$/', $path, $matches):
            $id = (int)$matches[1];
            if ($method === 'PUT') handleUpdatePedidoCompra($id, $input_data);
            // Adicionar DELETE se necessário
            break;

        // === DASHBOARD DIRETORIA ===
        case $path === '/diretoria/dashboard' && $method === 'GET':
            handleGetDiretoriaDashboard();
            break;

        // === ROTA NÃO ENCONTRADA ===
        default:
            sendJsonResponse(['error' => 'Endpoint não encontrado: ' . $path], 404);
            break;
    }
} catch (Exception $e) {
    error_log("Erro na API: " . $e->getMessage());
    sendJsonResponse(['error' => 'Erro interno do servidor'], 500);
}