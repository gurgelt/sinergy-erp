<?php
/**
 * API REST - Sistema Sinergy
 * Ponto de Entrada da API
 * Versão Reestruturada e Otimizada
 */

// Carrega configurações
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../src/autoload.php';
require_once __DIR__ . '/../src/Utils/helpers.php';
require_once __DIR__ . '/../src/legacy_functions.php';
require_once __DIR__ . '/../src/estoque_produtos_handlers.php';

// Configura CORS
setup_cors();

// Obtém método HTTP e URI
$method = $_SERVER['REQUEST_METHOD'];
$request_uri = $_SERVER['REQUEST_URI'];
$base_api_path = API_BASE_PATH;

// Remove base path da URI
if (strpos($request_uri, $base_api_path) === 0) {
    $path = substr($request_uri, strlen($base_api_path));
} else {
    $path = $request_uri;
}

// Remove query string do path
$path_parts = explode('?', $path, 2);
$path = $path_parts[0];

// Remove /index.php do path se existir
$path = str_replace('/index.php', '', $path);

// Normaliza path
if (empty($path) || $path === '/') {
    $path = '/status';
} elseif (substr($path, 0, 1) !== '/') {
    $path = '/' . $path;
}

// Processa input JSON para POST e PUT
$input_data = null;
if (in_array($method, ['POST', 'PUT'])) {
    $raw_input = file_get_contents('php://input');
    $input_data = json_decode($raw_input, true);
    if (json_last_error() !== JSON_ERROR_NONE && !empty($raw_input)) {
        sendJsonResponse(['error' => 'JSON inválido'], 400);
    }
}

// === ROTEAMENTO DA API ===
try {
    switch (true) {
        // Status da API
        case $path === '/status':
            handleStatus();
            break;

        // === AUTENTICAÇÃO ===
        case $path === '/register' && $method === 'POST':
            handleRegister($input_data);
            break;

        case $path === '/login' && $method === 'POST':
            handleLogin($input_data);
            break;

        case $path === '/recover-password' && $method === 'POST':
            handleRecoverPassword($input_data);
            break;

        case $path === '/reset-password' && $method === 'POST':
            handleResetPassword($input_data);
            break;

        // === USUÁRIOS ===
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

        case $path === '/usuarios-lista' && $method === 'GET':
            handleGetUsuariosSimples(); // Usado nos dropdowns
            break;
            
        case $path === '/vendedores' && $method === 'GET':
            handleGetListaVendedores();
            break;

        case $path === '/usuarios-sem-vinculo' && $method === 'GET':
            handleGetUsuariosSemVinculo();
            break;

        case $path === '/usuarios-disponiveis' && $method === 'GET':
            handleGetUsuariosSemVinculo();
            break;

        // === BOBINAS ===
        case $path === '/bobinas':
            if ($method === 'GET') {
                handleGetBobinas();
            } elseif ($method === 'POST') {
                handleAddBobina($input_data);
            } else {
                sendJsonResponse(['error' => 'Método não permitido'], 405);
            }
            break;

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

        // === ORÇAMENTOS ===
        case $path === '/orcamentos' && $method === 'GET':
            handleGetOrcamentos();
            break;

        case $path === '/orcamentos' && $method === 'POST':
            handleAddOrcamento($input_data);
            break;

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
            
        // === PRODUÇÃO (NOVO FLUXO) ===
        case $path === '/producao/fila' && $method === 'GET':
            handleGetFilaProducao();
            break;
            
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