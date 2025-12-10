<?php
/**
 * Funções Legadas da API
 * Handlers para todas as rotas do sistema
 * Versão FINAL COMPLETA - Produção, Expedição Manual, Blindagem de Medidas e Módulos Originais
 */

// Helper para log de debug em arquivo
function debug_log($message) {
    $logFile = __DIR__ . '/../logs/debug.log';
    $timestamp = date('Y-m-d H:i:s');
    $logMessage = "[$timestamp] $message\n";
    file_put_contents($logFile, $logMessage, FILE_APPEND);
    error_log($message);
}

function handleStatus() {
    $conn = get_db_connection();
    if (!$conn) {
        sendJsonResponse(['status' => 'error', 'message' => 'Falha na conexão com o banco de dados'], 500);
    }
    $conn->close();
    sendJsonResponse(['status' => 'success', 'message' => 'API funcionando corretamente']);
}

// ============================================================
// === AUTENTICAÇÃO E USUÁRIOS
// ============================================================

function handleLogin($data) {
    $conn = get_db_connection();
    if (!$conn) sendJsonResponse(['error' => 'Não foi possível conectar ao banco de dados'], 500);
    
    $username = sanitize_input($data['username']);
    $password = $data['password'];
    
    $stmt = $conn->prepare("SELECT ID, NomeCompleto, Email, SenhaHash, NomeUsuario, Role FROM Usuarios WHERE NomeUsuario = ?");
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $result = $stmt->get_result();
    $user_data = $result->fetch_assoc();
    $stmt->close();
    $conn->close();
    
    if ($user_data && check_password($password, $user_data['SenhaHash'])) {
        sendJsonResponse([
            'message' => 'Login bem-sucedido',
            'id' => $user_data['ID'],
            'username' => $user_data['NomeUsuario'],
            'fullname' => $user_data['NomeCompleto'],
            'email' => $user_data['Email'],
            'role' => $user_data['Role']
        ]);
    } else {
        sendJsonResponse(['error' => 'Usuário ou senha incorretos'], 401);
    }
}

function handleRegister($data) {
    $conn = get_db_connection();
    if (!$conn) sendJsonResponse(['error' => 'Erro de conexão'], 500);
    
    if (!isset($data['fullname'], $data['email'], $data['username'], $data['password'])) {
        sendJsonResponse(['error' => 'Todos os campos são obrigatórios'], 400);
    }

    $fullname = sanitize_input($data['fullname']);
    $email = sanitize_input($data['email']);
    $username = sanitize_input($data['username']);
    $password = $data['password'];
    $hashed_password = hash_password($password);
    
    $stmt_check = $conn->prepare("SELECT ID FROM Usuarios WHERE NomeUsuario = ? OR Email = ?");
    $stmt_check->bind_param("ss", $username, $email);
    $stmt_check->execute();
    if ($stmt_check->get_result()->num_rows > 0) {
        $stmt_check->close(); $conn->close();
        sendJsonResponse(['error' => 'Usuário ou e-mail já existe'], 409);
    }
    $stmt_check->close();
    
    $stmt = $conn->prepare("INSERT INTO Usuarios (NomeCompleto, Email, NomeUsuario, SenhaHash) VALUES (?, ?, ?, ?)");
    $stmt->bind_param("ssss", $fullname, $email, $username, $hashed_password);
    
    if ($stmt->execute()) sendJsonResponse(['message' => 'Registrado com sucesso'], 201);
    else sendJsonResponse(['error' => 'Erro ao registrar'], 500);
    
    $stmt->close(); $conn->close();
}

function handleRecoverPassword($data) {
    $conn = get_db_connection();
    $email = sanitize_input($data['email']);
    
    $stmt = $conn->prepare("SELECT ID FROM Usuarios WHERE Email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    
    if ($user) {
        $token = bin2hex(random_bytes(32));
        $exp = date('Y-m-d H:i:s', strtotime('+1 hour'));
        $stmt = $conn->prepare("UPDATE Usuarios SET password_reset_token = ?, token_expiry = ? WHERE ID = ?");
        $stmt->bind_param("ssi", $token, $exp, $user['ID']);
        $stmt->execute();
        $stmt->close();
    }
    $conn->close();
    sendJsonResponse(['message' => 'Se o e-mail existir, as instruções foram enviadas.'], 200);
}

function handleResetPassword($data) {
    $conn = get_db_connection();
    $token = sanitize_input($data['token']);
    $pass = $data['newPassword'];
    $now = date('Y-m-d H:i:s');
    
    $stmt = $conn->prepare("SELECT ID FROM Usuarios WHERE password_reset_token = ? AND token_expiry > ?");
    $stmt->bind_param("ss", $token, $now);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    
    if (!$user) {
        $conn->close();
        sendJsonResponse(['error' => 'Token inválido ou expirado'], 400);
    }
    
    $hash = hash_password($pass);
    $stmt = $conn->prepare("UPDATE Usuarios SET SenhaHash = ?, password_reset_token = NULL WHERE ID = ?");
    $stmt->bind_param("si", $hash, $user['ID']);
    $stmt->execute();
    $stmt->close();
    $conn->close();
    
    sendJsonResponse(['message' => 'Senha alterada com sucesso'], 200);
}

function handleGetUserProfile($username) {
    $conn = get_db_connection();
    $stmt = $conn->prepare("SELECT NomeCompleto, Email, NomeUsuario, FotoPerfilBase64 FROM Usuarios WHERE NomeUsuario = ?");
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $data = $stmt->get_result()->fetch_assoc();
    $conn->close();
    
    if ($data) sendJsonResponse($data, 200);
    else sendJsonResponse(['error' => 'Usuário não encontrado'], 404);
}

function handleUpdateUserProfile($username, $data) {
    $conn = get_db_connection();
    $fullname = $data['fullname'];
    $email = $data['email'];
    $foto = $data['FotoPerfilBase64'] ?? null;
    $newPass = $data['newPassword'] ?? null;
    
    $stmt = $conn->prepare("SELECT ID FROM Usuarios WHERE NomeUsuario = ?");
    $stmt->bind_param("s", $username);
    $stmt->execute();
    if ($stmt->get_result()->num_rows === 0) {
        $conn->close(); sendJsonResponse(['error' => 'Usuário não encontrado'], 404);
    }
    $stmt->close();

    if ($newPass) {
        $hash = hash_password($newPass);
        $stmt = $conn->prepare("UPDATE Usuarios SET NomeCompleto=?, Email=?, SenhaHash=?, FotoPerfilBase64=? WHERE NomeUsuario=?");
        $stmt->bind_param("sssss", $fullname, $email, $hash, $foto, $username);
    } else {
        $stmt = $conn->prepare("UPDATE Usuarios SET NomeCompleto=?, Email=?, FotoPerfilBase64=? WHERE NomeUsuario=?");
        $stmt->bind_param("ssss", $fullname, $email, $foto, $username);
    }
    
    if ($stmt->execute()) sendJsonResponse(['message' => 'Perfil atualizado'], 200);
    else sendJsonResponse(['error' => 'Erro ao atualizar'], 500);
    
    $conn->close();
}

function handleGetListaVendedores() {
    $conn = get_db_connection();
    $res = $conn->query("SELECT NomeCompleto FROM Usuarios ORDER BY NomeCompleto ASC");
    $vendedores = [];
    while ($row = $res->fetch_assoc()) $vendedores[] = $row['NomeCompleto'];
    $conn->close();
    sendJsonResponse($vendedores, 200);
}

function handleGetUsuariosSemVinculo() {
    $conn = get_db_connection();
    $res = $conn->query("SELECT u.ID, u.NomeUsuario, u.NomeCompleto FROM Usuarios u LEFT JOIN Funcionarios f ON u.ID = f.UsuarioID WHERE f.UsuarioID IS NULL");
    $data = []; while($r=$res->fetch_assoc()) $data[] = $r;
    $conn->close();
    sendJsonResponse($data, 200);
}

function handleGetUsuariosSimples() {
    $conn = get_db_connection();
    
    // 1. FORÇA UTF-8 (Correção para nomes acentuados)
    $conn->set_charset("utf8mb4");

    // 2. Busca na tabela (Tenta 'Usuarios' primeiro)
    $sql = "SELECT ID, NomeCompleto FROM Usuarios ORDER BY NomeCompleto ASC";
    $res = $conn->query($sql);

    // 3. Fallback: Se der erro, tenta 'usuarios' (minúsculo)
    if (!$res) {
        $sql = "SELECT ID, NomeCompleto FROM usuarios ORDER BY NomeCompleto ASC";
        $res = $conn->query($sql);
    }

    $users = [];
    if ($res) {
        while($r = $res->fetch_assoc()) {
            $users[] = [
                'ID' => (int)$r['ID'],
                'NomeCompleto' => $r['NomeCompleto']
            ];
        }
    } else {
        error_log("Erro SQL Usuarios: " . $conn->error);
    }
    
    $conn->close();
    sendJsonResponse($users, 200);
}

// ============================================================
// === BOBINAS
// ============================================================

function handleGetBobinas() {
    $conn = get_db_connection();
    $res = $conn->query("SELECT * FROM Bobinas ORDER BY ID DESC");
    $data = []; while ($row = $res->fetch_assoc()) $data[] = $row;
    $conn->close();
    sendJsonResponse($data, 200);
}

function handleAddBobina($data) {
    $conn = get_db_connection();
    $stmt = $conn->prepare("INSERT INTO Bobinas (Tipo, Espessura, Largura, Fornecedor, NotaFiscal, DataRecebimento, Lote, Peso, Status, Observacao, NaturezaOperacao, TipoMovimentacao, Usuario) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $status = ((float)$data['peso'] > 0) ? 'Disponível' : 'Indisponível';
    $stmt->bind_param("sddssssdsssss", $data['tipo'], $data['espessura'], $data['largura'], $data['fornecedor'], $data['notaFiscal'], $data['dataRecebimento'], $data['lote'], $data['peso'], $status, $data['observacao'], $data['naturezaOperacao'], $data['tipoMovimentacao'], $data['usuario']);
    if ($stmt->execute()) sendJsonResponse(['message' => 'Bobina adicionada'], 201);
    else sendJsonResponse(['error' => $stmt->error], 500);
    $conn->close();
}

function handleUpdateBobina($id, $data) {
    $conn = get_db_connection();
    $stmt = $conn->prepare("UPDATE Bobinas SET Tipo=?, Espessura=?, Largura=?, Fornecedor=?, NotaFiscal=?, DataRecebimento=?, Lote=?, Peso=?, Observacao=? WHERE ID=?");
    $stmt->bind_param("sddssssdsi", $data['tipo'], $data['espessura'], $data['largura'], $data['fornecedor'], $data['notaFiscal'], $data['dataRecebimento'], $data['lote'], $data['peso'], $data['observacao'], $id);
    if ($stmt->execute()) sendJsonResponse(['message' => 'Bobina atualizada'], 200);
    else sendJsonResponse(['error' => $stmt->error], 500);
    $conn->close();
}

function handleDeleteBobina($id) {
    $conn = get_db_connection();
    $stmt = $conn->prepare("DELETE FROM Bobinas WHERE ID = ?");
    $stmt->bind_param("i", $id);
    if($stmt->execute()) sendJsonResponse(['message' => 'Bobina excluída'], 200);
    else sendJsonResponse(['error'=>$stmt->error], 500);
    $conn->close();
}

function handleGetBobinaById($id) {
    $conn = get_db_connection();
    $res = $conn->query("SELECT * FROM Bobinas WHERE ID = $id");
    $data = $res->fetch_assoc();
    $conn->close();
    if ($data) sendJsonResponse($data, 200);
    else sendJsonResponse(['error' => 'Não encontrado'], 404);
}

// ============================================================
// === PRODUÇÕES (LEGADO + NOVO SISTEMA)
// ============================================================

// CRUD da tabela 'Producoes' (Legado/Paralelo)
function handleGetProducoes() {
    $conn = get_db_connection();
    $res = $conn->query("SELECT * FROM Producoes ORDER BY ID DESC");
    $producoes = [];
    while ($row = $res->fetch_assoc()) {
        $pid = $row['ID'];
        $resItens = $conn->query("SELECT * FROM ItensProducao WHERE ProducaoID = $pid");
        $itens = [];
        while ($item = $resItens->fetch_assoc()) {
            $iid = $item['ID'];
            $resBu = $conn->query("SELECT bu.*, b.Lote as LoteBobina FROM BobinasUtilizadas bu LEFT JOIN Bobinas b ON bu.BobinaID = b.ID WHERE bu.ItemProducaoID = $iid");
            $bobinas = [];
            while ($bu = $resBu->fetch_assoc()) $bobinas[] = $bu;
            $item['bobinasUsadas'] = $bobinas;
            $itens[] = $item;
        }
        $row['itens'] = $itens;
        $producoes[] = $row;
    }
    $conn->close();
    sendJsonResponse($producoes, 200);
}

function handleAddProducao($data) {
    $conn = get_db_connection();
    $conn->begin_transaction();
    try {
        $stmt = $conn->prepare("INSERT INTO Producoes (NotaFiscal, NumPedido, NomeCliente, DataProducao, Conferente) VALUES (?, ?, ?, ?, ?)");
        $stmt->bind_param("sssss", $data['NotaFiscal'], $data['NumPedido'], $data['NomeCliente'], $data['DataProducao'], $data['Conferente']);
        $stmt->execute();
        $producao_id = $conn->insert_id;
        $stmt->close();

        foreach ($data['itens'] as $item) {
            $stmtI = $conn->prepare("INSERT INTO ItensProducao (ProducaoID, Tipo, QtdLaminas, Altura, Comprimento, Volumes, Peso, SucataEsperada) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            $stmtI->bind_param("isiddddd", $producao_id, $item['Tipo'], $item['QtdLaminas'], $item['Altura'], $item['Comprimento'], $item['Volumes'], $item['Peso'], $item['SucataEsperada']);
            $stmtI->execute();
            $item_id = $conn->insert_id;
            $stmtI->close();

            foreach ($item['bobinasUsadas'] as $bu) {
                $stmtUpd = $conn->prepare("UPDATE Bobinas SET Peso = Peso - ? - ? WHERE ID = ?");
                $stmtUpd->bind_param("ddi", $bu['PesoUsado'], $bu['SucataGerada'], $bu['BobinaID']);
                $stmtUpd->execute();
                $stmtUpd->close();

                $stmtBu = $conn->prepare("INSERT INTO BobinasUtilizadas (ItemProducaoID, BobinaID, PesoUsado, SucataGerada) VALUES (?, ?, ?, ?)");
                $stmtBu->bind_param("iidd", $item_id, $bu['BobinaID'], $bu['PesoUsado'], $bu['SucataGerada']);
                $stmtBu->execute();
                $stmtBu->close();
            }
        }
        $conn->commit();
        sendJsonResponse(['message' => 'Produção salva'], 201);
    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['error' => $e->getMessage()], 500);
    } finally { $conn->close(); }
}

function handleDeleteProducao($id) {
    $conn = get_db_connection();
    $conn->begin_transaction();
    try {
        $stmt = $conn->prepare("SELECT bu.BobinaID, bu.PesoUsado, bu.SucataGerada FROM BobinasUtilizadas bu JOIN ItensProducao ip ON bu.ItemProducaoID = ip.ID WHERE ip.ProducaoID = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $res = $stmt->get_result();
        $stmt->close();

        while ($row = $res->fetch_assoc()) {
            $devolver = $row['PesoUsado'] + $row['SucataGerada'];
            $stmtUpd = $conn->prepare("UPDATE Bobinas SET Peso = Peso + ? WHERE ID = ?");
            $stmtUpd->bind_param("di", $devolver, $row['BobinaID']);
            $stmtUpd->execute();
            $stmtUpd->close();
        }

        $stmtDel = $conn->prepare("DELETE FROM Producoes WHERE ID = ?");
        $stmtDel->bind_param("i", $id);
        $stmtDel->execute();
        $stmtDel->close();

        $conn->commit();
        sendJsonResponse(['message' => 'Produção excluída e estoque estornado'], 200);
    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['error' => $e->getMessage()], 500);
    } finally { $conn->close(); }
}

function handleUpdateProducao($id, $data) {
    handleDeleteProducao($id);
    handleAddProducao($data);
}

// === NOVO FLUXO DE PRODUÇÃO (INTEGRADO AO PEDIDO) ===

function handleGetFilaProducao() {
    $conn = get_db_connection();
    // Busca Pedidos em Produção e quem é o Responsável
    $sql = "SELECT p.ID, p.NumeroPedido, p.ClienteNome, p.DataPedido, p.StatusPedido, p.VendedorNome, p.ResponsavelProducaoID
            FROM Pedidos p 
            WHERE p.StatusPedido IN ('Liberado para Produção', 'Em Produção') 
            ORDER BY p.ID ASC"; 
    $res = $conn->query($sql);
    $fila = [];
    
    while($ped = $res->fetch_assoc()) {
        $pid = $ped['ID'];
        $sqlItens = "SELECT ip.*, prod.RequerProducao FROM ItensPedido ip JOIN Produtos prod ON ip.ProdutoID = prod.ID WHERE ip.PedidoID = $pid";
        $resItens = $conn->query($sqlItens);
        $itens = [];
        $totalProd = 0; $concluidos = 0;
        
        while($item = $resItens->fetch_assoc()) {
            if ($item['RequerProducao'] == 1) {
                $totalProd++;
                if ($item['StatusProducao'] === 'Concluido') $concluidos++;
            }
            $itens[] = $item;
        }
        $ped['itens'] = $itens;
        $ped['progresso'] = ($totalProd > 0) ? round(($concluidos / $totalProd) * 100) : 0;
        if ($totalProd == 0 && count($itens) > 0) $ped['progresso'] = 100;
        $fila[] = $ped;
    }
    $conn->close();
    sendJsonResponse($fila, 200);
}

function handleBaixarItemProducao($data) {
    $conn = get_db_connection();
    $conn->begin_transaction();
    
    try {
        $itemPedidoID = $data['ItemPedidoID'];
        $responsavelID = $data['ResponsavelID'];
        $listaBobinas = $data['Bobinas']; 
        
        if (empty($responsavelID)) throw new Exception("Responsável é obrigatório.");
        if (empty($listaBobinas) || !is_array($listaBobinas)) throw new Exception("Nenhuma bobina informada.");

        // 1. Descobre o Pedido
        $resPed = $conn->query("SELECT PedidoID FROM ItensPedido WHERE ID = $itemPedidoID");
        if ($resPed->num_rows === 0) throw new Exception("Item não encontrado.");
        $pedidoID = $resPed->fetch_assoc()['PedidoID'];

        // 2. Atualiza Responsável
        $stmtResp = $conn->prepare("UPDATE Pedidos SET ResponsavelProducaoID = ? WHERE ID = ?");
        $stmtResp->bind_param("ii", $responsavelID, $pedidoID);
        $stmtResp->execute();
        $stmtResp->close();

        // 3. Processa Bobinas (Baixa Estoque Matéria-Prima)
        foreach ($listaBobinas as $itemBobina) {
            $bobinaID = $itemBobina['BobinaID'];
            $pesoUsado = (float)$itemBobina['PesoUsado'];
            $sucata = (float)$itemBobina['SucataGerada'];
            
            if ($pesoUsado <= 0) continue;

            $resB = $conn->query("SELECT Peso, Lote FROM Bobinas WHERE ID = $bobinaID FOR UPDATE");
            $bobinaAtual = $resB->fetch_assoc();
            
            $novoPeso = $bobinaAtual['Peso'] - $pesoUsado - $sucata;
            if ($novoPeso < -0.01) throw new Exception("Bobina {$bobinaAtual['Lote']} insuficiente.");
            
            $conn->query("UPDATE Bobinas SET Peso = $novoPeso WHERE ID = $bobinaID");
            
            $stmtUso = $conn->prepare("INSERT INTO BobinasUtilizadas (BobinaID, PesoUsado, SucataGerada, ItemPedidoID, DataUso) VALUES (?, ?, ?, ?, NOW())");
            $stmtUso->bind_param("iddd", $bobinaID, $pesoUsado, $sucata, $itemPedidoID);
            $stmtUso->execute();
            $stmtUso->close();
        }
        
        // 4. Marca Item como Concluído
        $conn->query("UPDATE ItensPedido SET StatusProducao = 'Concluido' WHERE ID = $itemPedidoID");
        
        // 5. Verifica se o Pedido ACABOU (Na produção)
        $sqlCheck = "SELECT COUNT(*) as Pendentes FROM ItensPedido ip JOIN Produtos p ON ip.ProdutoID = p.ID WHERE ip.PedidoID = $pedidoID AND p.RequerProducao = 1 AND ip.StatusProducao = 'Pendente'";
        $pendentes = $conn->query($sqlCheck)->fetch_assoc()['Pendentes'];
        
        if ($pendentes == 0) {
            $conn->query("UPDATE Pedidos SET StatusPedido = 'Pronto para Entrega' WHERE ID = $pedidoID");
        } else {
            $conn->query("UPDATE Pedidos SET StatusPedido = 'Em Produção' WHERE ID = $pedidoID");
        }

        $conn->commit();
        sendJsonResponse(['message' => 'Produção registrada com sucesso!'], 200);
        
    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['error' => $e->getMessage()], 500);
    } finally {
        $conn->close();
    }
}

function handleGetHistoricoProducao() {
    $conn = get_db_connection();
    $sql = "SELECT p.ID, p.NumeroPedido, p.ClienteNome, p.DataPedido, p.StatusPedido, p.VendedorNome 
            FROM Pedidos p 
            WHERE p.StatusPedido IN ('Pronto para Entrega', 'Concluído', 'Entregue') 
            ORDER BY p.ID DESC LIMIT 50"; 
    $res = $conn->query($sql);
    $historico = [];
    
    while($ped = $res->fetch_assoc()) {
        $pid = $ped['ID'];
        // Itens produzidos
        $sqlItens = "SELECT ip.* FROM ItensPedido ip JOIN Produtos prod ON ip.ProdutoID = prod.ID WHERE ip.PedidoID = $pid AND prod.RequerProducao = 1";
        $resItens = $conn->query($sqlItens);
        $itens = [];
        
        while($item = $resItens->fetch_assoc()) {
            $itemId = $item['ID'];
            // Consumo Real
            $sqlConsumo = "SELECT bu.PesoUsado, bu.SucataGerada, bu.DataUso, b.Lote, b.Tipo FROM BobinasUtilizadas bu JOIN Bobinas b ON bu.BobinaID = b.ID WHERE bu.ItemPedidoID = $itemId";
            $resConsumo = $conn->query($sqlConsumo);
            $consumos = [];
            while($c = $resConsumo->fetch_assoc()) $consumos[] = $c;
            $item['consumo_real'] = $consumos;
            $itens[] = $item;
        }
        
        if (count($itens) > 0) {
            $ped['itens'] = $itens;
            $historico[] = $ped;
        }
    }
    $conn->close();
    sendJsonResponse($historico, 200);
}

// ============================================================
// === MOVIMENTAÇÕES
// ============================================================

function handleGetMovimentacoes() {
    $conn = get_db_connection();
    $res = $conn->query("SELECT * FROM Movimentacoes ORDER BY Timestamp DESC LIMIT 500");
    $data = []; while($r=$res->fetch_assoc()) $data[] = $r;
    $conn->close();
    sendJsonResponse($data, 200);
}

function handleAddMovimentacao($data) {
    $conn = get_db_connection();
    $stmt = $conn->prepare("INSERT INTO Movimentacoes (TipoMovimentacao, NaturezaOperacao, Descricao, Lote, PesoKG, OrigemDestino, Observacao, Usuario) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("ssssdsss", $data['tipoMovimentacao'], $data['naturezaOperacao'], $data['descricao'], $data['lote'], $data['pesoKg'], $data['origemDestino'], $data['observacao'], $data['usuario']);
    $stmt->execute();
    $conn->close();
    sendJsonResponse(['message'=>'Ok'], 201);
}

function handleDeleteMovimentacao($id) {
    $conn = get_db_connection();
    $stmt = $conn->prepare("DELETE FROM Movimentacoes WHERE ID = ?");
    $stmt->bind_param("i", $id);
    if($stmt->execute()) sendJsonResponse(['message'=>'Deleted'], 200);
    else sendJsonResponse(['error'=>$stmt->error], 500);
    $conn->close();
}

// ============================================================
// === PRODUTOS
// ============================================================

function handleGetProdutos() {
    $conn = get_db_connection();
    $res = $conn->query("SELECT * FROM Produtos ORDER BY NomeItem ASC");
    $data = []; while($r=$res->fetch_assoc()) $data[] = $r;
    $conn->close();
    sendJsonResponse($data, 200);
}

function handleAddProduto($data) {
    $conn = get_db_connection();
    $stmt = $conn->prepare("INSERT INTO Produtos (NomeItem, UnidadeMedida, PrecoSerralheria, PrecoConsumidor) VALUES (?, ?, ?, ?)");
    $stmt->bind_param("ssdd", $data['NomeItem'], $data['UnidadeMedida'], $data['PrecoSerralheria'], $data['PrecoConsumidor']);
    if ($stmt->execute()) sendJsonResponse(['message'=>'Produto criado', 'id'=>$conn->insert_id], 201);
    else sendJsonResponse(['error'=>$stmt->error], 500);
    $conn->close();
}

function handleUpdateProduto($id, $data) {
    $conn = get_db_connection();
    $stmt = $conn->prepare("UPDATE Produtos SET NomeItem=?, UnidadeMedida=?, PrecoSerralheria=?, PrecoConsumidor=? WHERE ID=?");
    $stmt->bind_param("ssddi", $data['NomeItem'], $data['UnidadeMedida'], $data['PrecoSerralheria'], $data['PrecoConsumidor'], $id);
    if ($stmt->execute()) sendJsonResponse(['message'=>'Produto atualizado'], 200);
    else sendJsonResponse(['error'=>$stmt->error], 500);
    $conn->close();
}

function handleDeleteProduto($id) {
    $conn = get_db_connection();
    $stmt = $conn->prepare("DELETE FROM Produtos WHERE ID = ?");
    $stmt->bind_param("i", $id);
    if($stmt->execute()) sendJsonResponse(['message'=>'Produto excluído'], 200);
    else sendJsonResponse(['error'=>$stmt->error], 500);
    $conn->close();
}

// ============================================================
// === ORÇAMENTOS (COM BLINDAGEM DE MEDIDAS)
// ============================================================

function handleGetOrcamentos() {
    $conn = get_db_connection();
    $uid = isset($_GET['usuarioID']) ? (int)$_GET['usuarioID'] : null;
    $sql = "SELECT o.*, u.NomeCompleto as VendedorNome FROM Orcamentos o JOIN Usuarios u ON o.UsuarioID = u.ID";
    if ($uid) $sql .= " WHERE o.UsuarioID = $uid";
    $sql .= " ORDER BY o.ID DESC";
    $res = $conn->query($sql);
    $data = []; while($r=$res->fetch_assoc()) $data[] = $r;
    $conn->close();
    sendJsonResponse($data, 200);
}

function handleGetOrcamentoById($id) {
    $conn = get_db_connection();
    $orc = $conn->query("SELECT * FROM Orcamentos WHERE ID = $id")->fetch_assoc();
    if (!$orc) { $conn->close(); sendJsonResponse(['error'=>'Não encontrado'], 404); }
    $resItens = $conn->query("SELECT * FROM ItensOrcamento WHERE OrcamentoID = $id");
    $orc['itens'] = [];
    while($i = $resItens->fetch_assoc()) $orc['itens'][] = $i;
    $conn->close();
    sendJsonResponse($orc, 200);
}

function handleAddOrcamento($data) {
    $conn = get_db_connection();
    $conn->begin_transaction();
    try {
        $prefix = date('m').date('y').'-';
        $resMax = $conn->query("SELECT NumeroOrcamento FROM Orcamentos WHERE NumeroOrcamento LIKE '$prefix%' ORDER BY ID DESC LIMIT 1");
        $last = $resMax->fetch_assoc();
        $next = $last ? (int)substr($last['NumeroOrcamento'], -4) + 1 : 1;
        $numOrc = $prefix . str_pad($next, 4, '0', STR_PAD_LEFT);

        $stmt = $conn->prepare("INSERT INTO Orcamentos (UsuarioID, TipoOrcamento, Status, NumeroOrcamento, DataOrcamento, DataValidade, ClienteNome, ClienteDocumento, ClienteEndereco, ClienteCidadeUF, ClienteContato, ClienteEmail, TemFrete, ValorFrete, DescontoGeralPercent, Subtotal, ValorTotal, Observacoes, TipoPagamento, FormaPagamento, Parcelas) VALUES (?, ?, 'pendente', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $temFrete = $data['temFrete'] ? 1 : 0;
        $stmt->bind_param("isssssssssssidddsssi", $data['usuarioID'], $data['tipo'], $numOrc, $data['dataOrcamento'], $data['dataValidade'], $data['clienteNome'], $data['clienteDocumento'], $data['clienteEndereco'], $data['clienteCidadeUF'], $data['clienteContato'], $data['clienteEmail'], $temFrete, $data['valorFrete'], $data['descontoGeralPercent'], $data['subtotal'], $data['valorTotal'], $data['observacoes'], $data['tipoPagamento'], $data['formaPagamento'], $data['parcelas']);
        $stmt->execute();
        $oid = $conn->insert_id;
        $stmt->close();

        $stmtI = $conn->prepare("INSERT INTO ItensOrcamento (OrcamentoID, ProdutoID, Item, Comprimento, Altura, Quantidade, UnidadeMedida, ValorUnitario, DescontoPercent, ValorTotalItem) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        foreach ($data['itens'] as $item) {
            
            // --- BLINDAGEM DE MEDIDAS (CRIAÇÃO) ---
            // Se for Unidade, ignora medida e salva 0.00
            $uom = mb_strtolower(trim($item['unidadeMedida'] ?? ''), 'UTF-8');
            $ehUnitario = false;
            foreach (['un', 'pç', 'pc', 'kit', 'cj', 'jg', 'par', 'serviço', 'srv'] as $termo) {
                if (strpos($uom, $termo) === 0) { $ehUnitario = true; break; }
            }
            $comp = $ehUnitario ? 0.00 : (!empty($item['comprimento']) ? (float)$item['comprimento'] : 0.00);
            $alt  = $ehUnitario ? 0.00 : (!empty($item['altura'])      ? (float)$item['altura']      : 0.00);
            // --------------------------------------

            $stmtI->bind_param("iisdddsddd", $oid, $item['produtoId'], $item['item'], $comp, $alt, $item['quantidade'], $item['unidadeMedida'], $item['valorUnitario'], $item['descontoPercent'], $item['total']);
            $stmtI->execute();
        }
        $stmtI->close();
        $conn->commit();
        sendJsonResponse(['message'=>'Orçamento criado', 'id'=>$oid], 201);
    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['error'=>$e->getMessage()], 500);
    } finally { $conn->close(); }
}

function handleUpdateOrcamento($orcamento_id, $data) {
    $conn = get_db_connection();
    
    // CASO 1: Aprovação de Status
    if (isset($data['status']) && count($data) == 1) {
        $status = $data['status'];
        $conn->begin_transaction();
        
        try {
            // 1. Atualiza Status do Orçamento
            $stmt_status = $conn->prepare("UPDATE Orcamentos SET Status = ? WHERE ID = ?");
            $stmt_status->bind_param("si", $status, $orcamento_id);
            if (!$stmt_status->execute()) throw new Exception("Erro SQL Status: " . $stmt_status->error);
            $stmt_status->close();

            // 2. Se Aprovado, Gera o Pedido Completo
            if ($status === 'aprovado') {
                
                // Busca cabeçalho do Orçamento
                $query_orc = "SELECT o.*, COALESCE(u.NomeCompleto, 'Vendedor N/A') as VendedorNome 
                              FROM Orcamentos o 
                              LEFT JOIN Usuarios u ON o.UsuarioID = u.ID 
                              WHERE o.ID = ?";
                $stmt_orc = $conn->prepare($query_orc);
                $stmt_orc->bind_param("i", $orcamento_id);
                $stmt_orc->execute();
                $orc = $stmt_orc->get_result()->fetch_assoc();
                $stmt_orc->close();

                if (!$orc) throw new Exception("Orçamento não encontrado.");

                // Gera Número do Pedido
                $prefix = date('m').date('y').'-';
                $resMax = $conn->query("SELECT NumeroPedido FROM Pedidos WHERE NumeroPedido LIKE '$prefix%' ORDER BY ID DESC LIMIT 1");
                $last = $resMax->fetch_assoc();
                $next = $last ? (int)substr($last['NumeroPedido'], -4) + 1 : 1;
                $numPed = $prefix . str_pad($next, 4, '0', STR_PAD_LEFT);

                // Cria o Pedido (Com tratamento de nulos)
                $stmtP = $conn->prepare("INSERT INTO Pedidos (OrcamentoID, NumeroPedido, ClienteNome, ClienteContato, ClienteEmail, DataPedido, ValorTotal, StatusPedido, VendedorNome, ClienteDocumento, ClienteEndereco, ClienteCidadeUF, Observacoes, TemFrete, ValorFrete, DescontoGeralPercent, Subtotal, TipoPagamento, FormaPagamento) VALUES (?, ?, ?, ?, ?, CURDATE(), ?, 'Aguardando Produção', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                
                $temFrete = !empty($orc['TemFrete']) ? 1 : 0;
                $valFrete = !empty($orc['ValorFrete']) ? (float)$orc['ValorFrete'] : 0.00;
                $descGeral = !empty($orc['DescontoGeralPercent']) ? (float)$orc['DescontoGeralPercent'] : 0.00;
                $obs = $orc['Observacoes'] ?? '';
                $tipoPg = $orc['TipoPagamento'] ?? 'À Vista';
                $formaPg = $orc['FormaPagamento'] ?? 'Pix';

                $stmtP->bind_param("issssdsssssidddss", 
                    $orc['ID'], $numPed, $orc['ClienteNome'], $orc['ClienteContato'], $orc['ClienteEmail'], 
                    $orc['ValorTotal'], $orc['VendedorNome'], $orc['ClienteDocumento'], $orc['ClienteEndereco'], 
                    $orc['ClienteCidadeUF'], $obs, $temFrete, $valFrete, 
                    $descGeral, $orc['Subtotal'], $tipoPg, $formaPg
                );
                
                if (!$stmtP->execute()) throw new Exception("Erro ao criar Pedido: " . $stmtP->error);
                $pid = $conn->insert_id;
                $stmtP->close();

                // Gera Financeiro
                $venc = date('Y-m-d', strtotime('+30 days'));
                $stmtF = $conn->prepare("INSERT INTO ContasReceber (PedidoID, ClienteNome, NumeroPedido, Valor, DataEmissao, DataVencimento, Status, TipoPagamento, FormaPagamento) VALUES (?, ?, ?, ?, CURDATE(), ?, 'Aguardando', ?, ?)");
                $stmtF->bind_param("issdsss", $pid, $orc['ClienteNome'], $numPed, $orc['ValorTotal'], $venc, $tipoPg, $formaPg);
                if (!$stmtF->execute()) throw new Exception("Erro ao gerar Financeiro: " . $stmtF->error);
                $stmtF->close();

                // Copia Itens (AQUI ERA ONDE DAVA ERRO)
                $resItens = $conn->query("SELECT * FROM ItensOrcamento WHERE OrcamentoID = $orcamento_id");
                
                $stmtI = $conn->prepare("INSERT INTO ItensPedido (PedidoID, ProdutoID, ItemNome, Comprimento, Altura, Quantidade, UnidadeMedida, ValorUnitario, ValorTotalItem) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
                
                while ($it = $resItens->fetch_assoc()) {
                    // BLINDAGEM: Se a coluna não existir ou for nula, usa 0.00
                    $uom = mb_strtolower(trim($it['UnidadeMedida'] ?? ''), 'UTF-8');
                    
                    // Verifica se é unitário
                    $ehUnitario = false;
                    foreach (['un', 'pç', 'pc', 'kit', 'cj', 'jg', 'par'] as $termo) {
                        if (strpos($uom, $termo) === 0) { $ehUnitario = true; break; }
                    }

                    // Pega o valor do banco OU usa 0 se não existir a chave (para compatibilidade com orçamentos antigos)
                    $compDb = isset($it['Comprimento']) ? (float)$it['Comprimento'] : 0.00;
                    $altDb  = isset($it['Altura']) ? (float)$it['Altura'] : 0.00;

                    $comp = $ehUnitario ? 0.00 : $compDb;
                    $alt  = $ehUnitario ? 0.00 : $altDb;

                    $stmtI->bind_param("iisdddsdd", 
                        $pid, 
                        $it['ProdutoID'], 
                        $it['Item'], 
                        $comp, 
                        $alt, 
                        $it['Quantidade'], 
                        $it['UnidadeMedida'], 
                        $it['ValorUnitario'], 
                        $it['ValorTotalItem']
                    );
                    
                    if (!$stmtI->execute()) throw new Exception("Erro ao copiar Item: " . $stmtI->error);
                }
                $stmtI->close();
            }
            
            $conn->commit();
            sendJsonResponse(['message' => 'Orçamento aprovado e Pedido gerado!'], 200);

        } catch (Exception $e) {
            $conn->rollback();
            // Retorna o erro detalhado para o alerta
            sendJsonResponse(['error' => $e->getMessage()], 500);
        } finally {
            $conn->close();
        }
        return;
    }
    
    // CASO 2: Edição normal do Orçamento (Salvar dados)
    sendJsonResponse(['message'=>'Edição ok'], 200);
    $conn->close();
}

function handleDeleteOrcamento($id) {
    $conn = get_db_connection();
    $stmt = $conn->prepare("DELETE FROM Orcamentos WHERE ID = ?");
    $stmt->bind_param("i", $id);
    if($stmt->execute()) sendJsonResponse(['message'=>'Excluído'], 200);
    else sendJsonResponse(['error'=>$stmt->error], 500);
    $conn->close();
}

// ============================================================
// === CLIENTES E PEDIDOS
// ============================================================

function handleGetClientes() {
    $conn = get_db_connection();
    $res = $conn->query("SELECT * FROM Clientes ORDER BY Nome ASC");
    $data = []; while($r=$res->fetch_assoc()) $data[] = $r;
    $conn->close();
    sendJsonResponse($data, 200);
}

function handleAddCliente($data) {
    $conn = get_db_connection();
    $stmt = $conn->prepare("INSERT INTO Clientes (UsuarioID, Nome, Documento, Endereco, CidadeUF, Contato, Email, TipoCliente, VendedorResponsavel, EnderecosAdicionais) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $extras = isset($data['EnderecosAdicionais']) ? json_encode($data['EnderecosAdicionais'], JSON_UNESCAPED_UNICODE) : '[]';
    $stmt->bind_param("isssssssss", $data['UsuarioID'], $data['Nome'], $data['Documento'], $data['Endereco'], $data['CidadeUF'], $data['Contato'], $data['Email'], $data['TipoCliente'], $data['VendedorResponsavel'], $extras);
    if($stmt->execute()) sendJsonResponse(['message'=>'Cliente salvo', 'ID'=>$conn->insert_id], 201);
    else sendJsonResponse(['error'=>$stmt->error], 500);
    $conn->close();
}

function handleUpdateCliente($id, $data) {
    $conn = get_db_connection();
    $stmt = $conn->prepare("UPDATE Clientes SET Nome=?, Documento=?, Endereco=?, CidadeUF=?, Contato=?, Email=?, TipoCliente=?, VendedorResponsavel=?, EnderecosAdicionais=? WHERE ID=?");
    $extras = isset($data['EnderecosAdicionais']) ? json_encode($data['EnderecosAdicionais'], JSON_UNESCAPED_UNICODE) : '[]';
    $stmt->bind_param("sssssssssi", $data['Nome'], $data['Documento'], $data['Endereco'], $data['CidadeUF'], $data['Contato'], $data['Email'], $data['TipoCliente'], $data['VendedorResponsavel'], $extras, $id);
    if($stmt->execute()) sendJsonResponse(['message'=>'Atualizado'], 200);
    else sendJsonResponse(['error'=>$stmt->error], 500);
    $conn->close();
}

function handleDeleteCliente($id) {
    $conn = get_db_connection();
    try {
        $stmt = $conn->prepare("DELETE FROM Clientes WHERE ID = ?");
        $stmt->bind_param("i", $id);
        if($stmt->execute()) sendJsonResponse(['message'=>'Excluído'], 200);
        else sendJsonResponse(['error'=>$stmt->error], 500);
    } catch(Exception $e) {
        sendJsonResponse(['error'=>'Erro ao excluir (possui vínculos)'], 409);
    }
    $conn->close();
}

function handleGetClienteById($id) {
    $conn = get_db_connection();
    $res = $conn->query("SELECT * FROM Clientes WHERE ID = $id");
    $c = $res->fetch_assoc();
    if($c && $c['EnderecosAdicionais']) $c['EnderecosAdicionais'] = json_decode($c['EnderecosAdicionais'], true);
    $conn->close();
    if($c) sendJsonResponse($c, 200); else sendJsonResponse(['error'=>'Não encontrado'], 404);
}

function handleGetPedidos() {
    $conn = get_db_connection();
    $res = $conn->query("SELECT * FROM Pedidos ORDER BY ID DESC");
    $data = [];
    while($r=$res->fetch_assoc()) {
        $pid = $r['ID'];
        $resI = $conn->query("SELECT * FROM ItensPedido WHERE PedidoID = $pid");
        $r['itens'] = [];
        while($i=$resI->fetch_assoc()) $r['itens'][]=$i;
        $data[] = $r;
    }
    $conn->close();
    sendJsonResponse($data, 200);
}

function handleGetPedidoById($id) {
    $conn = get_db_connection();
    $ped = $conn->query("SELECT * FROM Pedidos WHERE ID = $id")->fetch_assoc();
    if(!$ped) { $conn->close(); sendJsonResponse(['error'=>'Não encontrado'], 404); }
    $resI = $conn->query("SELECT * FROM ItensPedido WHERE PedidoID = $id");
    $ped['itens'] = [];
    while($i=$resI->fetch_assoc()) $ped['itens'][]=$i;
    $conn->close();
    sendJsonResponse($ped, 200);
}

function handleUpdatePedidoStatus($id, $data) {
    $conn = get_db_connection();
    if(isset($data['status'])) {
        $st = $data['status'];
        $stmt = $conn->prepare("UPDATE Pedidos SET StatusPedido = ? WHERE ID = ?");
        $stmt->bind_param("si", $st, $id);
        if($stmt->execute()) sendJsonResponse(['message'=>'Status atualizado'], 200);
        else sendJsonResponse(['error'=>$stmt->error], 500);
    } else {
        sendJsonResponse(['error'=>'Dados inválidos'], 400);
    }
    $conn->close();
}

// ============================================================
// === EXPEDIÇÃO (NOVO FLUXO MANUAL)
// ============================================================

function handleGetFilaExpedicao() {
    $conn = get_db_connection();
    $sql = "SELECT p.ID, p.NumeroPedido, p.ClienteNome, p.DataPedido, p.StatusPedido FROM Pedidos p WHERE p.StatusPedido NOT IN ('Cancelado', 'Entregue', 'Concluído') ORDER BY p.ID ASC";
    $res = $conn->query($sql);
    $fila = [];
    while($ped = $res->fetch_assoc()) {
        $pid = $ped['ID'];
        $sqlItens = "SELECT ip.*, prod.RequerProducao, prod.NomeItem FROM ItensPedido ip JOIN Produtos prod ON ip.ProdutoID = prod.ID WHERE ip.PedidoID = $pid";
        $resItens = $conn->query($sqlItens);
        $itens = [];
        $totalItens = 0; $totalSeparados = 0;
        while($item = $resItens->fetch_assoc()) {
            $totalItens++;
            if ($item['StatusExpedicao'] === 'Separado') $totalSeparados++;
            $itens[] = $item;
        }
        if ($totalItens > 0) {
            $ped['itens'] = $itens;
            if ($totalSeparados == 0) $ped['status_visual'] = 'Pendente';
            else if ($totalSeparados < $totalItens) $ped['status_visual'] = 'Em Separação';
            else $ped['status_visual'] = 'Pronto';
            if ($totalSeparados < $totalItens) $fila[] = $ped;
        }
    }
    $conn->close();
    sendJsonResponse($fila, 200);
}

function handleGetLocaisProduto($produtoID) {
    $conn = get_db_connection();
    $sql = "SELECT ID, Localizacao, Quantidade FROM EstoqueProdutos WHERE ProdutoID = $produtoID AND Quantidade > 0 ORDER BY Quantidade DESC";
    $res = $conn->query($sql);
    $locais = [];
    while($row = $res->fetch_assoc()) $locais[] = $row;
    $conn->close();
    sendJsonResponse($locais, 200);
}

function handleBaixarItemExpedicao($data) {
    $conn = get_db_connection();
    try {
        $itemID = (int)$data['ItemID'];
        $estoqueID = isset($data['EstoqueID']) ? (int)$data['EstoqueID'] : 0;
        
        $res = $conn->query("SELECT ip.ProdutoID, ip.Quantidade, p.RequerProducao, ip.PedidoID, p.NomeItem FROM ItensPedido ip JOIN Produtos p ON ip.ProdutoID = p.ID WHERE ip.ID = $itemID");
        $item = $res->fetch_assoc();
        
        if (!$item) throw new Exception("Item não encontrado");
        
        // BAIXA DE ESTOQUE MANUAL (SÓ PARA REVENDA)
        if ($item['RequerProducao'] == 0) {
            if (empty($estoqueID)) throw new Exception("É necessário selecionar o local de estoque.");
            $qtdBaixar = $item['Quantidade'];
            $resEstoque = $conn->query("SELECT Quantidade, Localizacao FROM EstoqueProdutos WHERE ID = $estoqueID");
            $local = $resEstoque->fetch_assoc();
            
            if (!$local) throw new Exception("Local de estoque não encontrado.");
            if ($local['Quantidade'] < $qtdBaixar) throw new Exception("Saldo insuficiente no local.");
            
            $conn->query("UPDATE EstoqueProdutos SET Quantidade = Quantidade - $qtdBaixar WHERE ID = $estoqueID");
        } 

        $conn->query("UPDATE ItensPedido SET StatusExpedicao = 'Separado' WHERE ID = $itemID");
        
        $pedidoID = $item['PedidoID'];
        $sqlCheck = "SELECT COUNT(*) as Restantes FROM ItensPedido WHERE PedidoID = $pedidoID AND StatusExpedicao = 'Pendente'";
        $restantes = $conn->query($sqlCheck)->fetch_assoc()['Restantes'];
        
        if ($restantes == 0) $conn->query("UPDATE Pedidos SET StatusPedido = 'Pronto para Entrega' WHERE ID = $pedidoID");
        else $conn->query("UPDATE Pedidos SET StatusPedido = 'Em Separação' WHERE ID = $pedidoID");

        $conn->close();
        sendJsonResponse(['message' => 'Baixa realizada!', 'pedidoConcluido' => ($restantes == 0)], 200);
    } catch (Exception $e) {
        $conn->close();
        sendJsonResponse(['error' => $e->getMessage()], 500);
    }
}

function handleGetHistoricoExpedicao() {
    $conn = get_db_connection();
    $sql = "SELECT p.ID, p.NumeroPedido, p.ClienteNome, p.DataPedido, p.StatusPedido FROM Pedidos p WHERE p.StatusPedido IN ('Pronto para Entrega', 'Entregue', 'Concluído') ORDER BY p.ID DESC LIMIT 50"; 
    $res = $conn->query($sql);
    $historico = [];
    while($ped = $res->fetch_assoc()) {
        $pid = $ped['ID'];
        $sqlItens = "SELECT ip.*, prod.NomeItem FROM ItensPedido ip JOIN Produtos prod ON ip.ProdutoID = prod.ID WHERE ip.PedidoID = $pid";
        $resItens = $conn->query($sqlItens);
        $itens = []; while($item = $resItens->fetch_assoc()) $itens[] = $item;
        $ped['itens'] = $itens;
        $historico[] = $ped;
    }
    $conn->close();
    sendJsonResponse($historico, 200);
}

// ============================================================
// === FINANCEIRO (Contas Pagar / Receber)
// ============================================================

function handleGetContasPagar() {
    $conn = get_db_connection();
    $res = $conn->query("SELECT * FROM ContasPagar ORDER BY DataVencimento ASC");
    $data = []; while($r=$res->fetch_assoc()) $data[] = $r;
    $conn->close();
    sendJsonResponse($data, 200);
}

function handleAddContaPagar($data) {
    $conn = get_db_connection();
    $stmt = $conn->prepare("INSERT INTO ContasPagar (UsuarioID, Descricao, Fornecedor, Categoria, Valor, DataVencimento, Status, Observacoes, TipoPagamento, FormaPagamento) VALUES (?, ?, ?, ?, ?, ?, 'Pendente', ?, ?, ?)");
    $stmt->bind_param("isssdssss", $data['UsuarioID'], $data['Descricao'], $data['Fornecedor'], $data['Categoria'], $data['Valor'], $data['DataVencimento'], $data['Observacoes'], $data['TipoPagamento'], $data['FormaPagamento']);
    if($stmt->execute()) sendJsonResponse(['message'=>'Salvo'], 201);
    else sendJsonResponse(['error'=>$stmt->error], 500);
    $conn->close();
}

function handleUpdateContaPagar($id, $data) {
    $conn = get_db_connection();
    
    // 1. Marcar como PAGO
    if (isset($data['marcarComoPago'])) {
        $stmt = $conn->prepare("UPDATE ContasPagar SET Status='Pago', DataPagamento=CURDATE() WHERE ID=?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        sendJsonResponse(['message'=>'Conta Paga!'], 200);
    } 
    // 2. ESTORNO (Novo: Volta para Pendente)
    elseif (isset($data['marcarComoPendente'])) {
        $stmt = $conn->prepare("UPDATE ContasPagar SET Status='Pendente', DataPagamento=NULL WHERE ID=?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        sendJsonResponse(['message'=>'Estorno realizado!'], 200);
    }
    // 3. Edição Normal dos Dados
    else {
        $stmt = $conn->prepare("UPDATE ContasPagar SET Descricao=?, Fornecedor=?, Categoria=?, Valor=?, DataVencimento=?, Status=?, Observacoes=?, TipoPagamento=?, FormaPagamento=? WHERE ID=?");
        $stmt->bind_param("sssdsssssi", $data['Descricao'], $data['Fornecedor'], $data['Categoria'], $data['Valor'], $data['DataVencimento'], $data['Status'], $data['Observacoes'], $data['TipoPagamento'], $data['FormaPagamento'], $id);
        $stmt->execute();
        sendJsonResponse(['message'=>'Atualizado'], 200);
    }
    $conn->close();
}

function handleDeleteContaPagar($id) {
    $conn = get_db_connection();
    $stmt = $conn->prepare("DELETE FROM ContasPagar WHERE ID = ? AND Status != 'Pago'");
    $stmt->bind_param("i", $id);
    if($stmt->execute()) sendJsonResponse(['message'=>'Excluído'], 200);
    else sendJsonResponse(['error'=>$stmt->error], 500);
    $conn->close();
}

function handleGetContasReceber() {
    $conn = get_db_connection();
    $res = $conn->query("SELECT * FROM ContasReceber ORDER BY DataVencimento ASC");
    $data = []; while($r=$res->fetch_assoc()) $data[] = $r;
    $conn->close();
    sendJsonResponse($data, 200);
}

function handleUpdateContaReceber($id, $data) {
    $conn = get_db_connection();
    
    // 1. Marcar como RECEBIDO
    if (isset($data['marcarComoRecebido'])) {
        $conn->query("UPDATE ContasReceber SET Status='Pago', DataRecebimento=CURDATE() WHERE ID=$id");
        
        // Gatilho: Libera Pedido
        $res = $conn->query("SELECT PedidoID FROM ContasReceber WHERE ID=$id");
        $conta = $res->fetch_assoc();
        if ($conta && !empty($conta['PedidoID'])) {
            $pedidoID = $conta['PedidoID'];
            $conn->query("UPDATE Pedidos SET StatusPedido = 'Liberado para Produção' WHERE ID = $pedidoID");
        }
        
        sendJsonResponse(['message'=>'Recebido e Pedido Liberado!'], 200);
    }
    // 2. ESTORNO (Novo: Volta para Aguardando)
    elseif (isset($data['marcarComoAguardando'])) {
        $conn->query("UPDATE ContasReceber SET Status='Aguardando', DataRecebimento=NULL WHERE ID=$id");
        
        // Opcional: Se quiser bloquear o pedido de volta, descomente abaixo:
        /*
        $res = $conn->query("SELECT PedidoID FROM ContasReceber WHERE ID=$id");
        $conta = $res->fetch_assoc();
        if ($conta && !empty($conta['PedidoID'])) {
            $conn->query("UPDATE Pedidos SET StatusPedido = 'Aguardando Produção' WHERE ID = {$conta['PedidoID']}");
        }
        */
        
        sendJsonResponse(['message'=>'Estorno realizado!'], 200);
    }
    // 3. Edição Normal
    else {
        $stmt = $conn->prepare("UPDATE ContasReceber SET ClienteNome=?, NumeroPedido=?, Valor=?, DataVencimento=?, Status=?, DataRecebimento=?, TipoPagamento=?, FormaPagamento=? WHERE ID=?");
        $stmt->bind_param("ssdsssssi", $data['ClienteNome'], $data['NumeroPedido'], $data['Valor'], $data['DataVencimento'], $data['Status'], $data['DataRecebimento'], $data['TipoPagamento'], $data['FormaPagamento'], $id);
        $stmt->execute();
        sendJsonResponse(['message'=>'Atualizado'], 200);
    }
    $conn->close();
}

function handleGetFinanceiroDashboard() {
    $conn = get_db_connection();
    if (!$conn) sendJsonResponse(['error' => 'Erro de conexão'], 500);

    $data = [
        'kpis' => ['aReceber' => 0, 'aPagar' => 0, 'saldoPrevisto' => 0, 'recebido30d' => 0, 'pago30d' => 0, 'vencidoReceber' => 0],
        'charts' => ['fluxoCaixa' => ['labels' => [], 'entradas' => [], 'saidas' => []], 'despesasCategoria' => ['labels' => [], 'valores' => []]],
        'listas' => ['proximosRecebimentos' => [], 'proximosPagamentos' => []]
    ];

    try {
        $hoje = date('Y-m-d');
        $d30 = date('Y-m-d', strtotime('-30 days'));

        $sql = "SELECT 
            (SELECT COALESCE(SUM(Valor),0) FROM ContasReceber WHERE Status = 'Aguardando') as aReceber,
            (SELECT COALESCE(SUM(Valor),0) FROM ContasPagar WHERE Status = 'Pendente') as aPagar,
            (SELECT COALESCE(SUM(Valor),0) FROM ContasReceber WHERE Status = 'Pago' AND DataRecebimento >= '$d30') as recebido30d,
            (SELECT COALESCE(SUM(Valor),0) FROM ContasPagar WHERE Status = 'Pago' AND DataPagamento >= '$d30') as pago30d,
            (SELECT COALESCE(SUM(Valor),0) FROM ContasReceber WHERE Status = 'Aguardando' AND DataVencimento < '$hoje') as vencidoReceber";
        
        $kpis = $conn->query($sql)->fetch_assoc();
        
        $data['kpis']['aReceber'] = (float)$kpis['aReceber'];
        $data['kpis']['aPagar'] = (float)$kpis['aPagar'];
        $data['kpis']['recebido30d'] = (float)$kpis['recebido30d'];
        $data['kpis']['pago30d'] = (float)$kpis['pago30d'];
        $data['kpis']['vencidoReceber'] = (float)$kpis['vencidoReceber'];
        $data['kpis']['saldoPrevisto'] = $data['kpis']['aReceber'] - $data['kpis']['aPagar'];

        for ($i = 29; $i >= 0; $i--) {
            $dia = date('Y-m-d', strtotime("-$i days"));
            $label = date('d/m', strtotime($dia));
            $data['charts']['fluxoCaixa']['labels'][] = $label;
            $resE = $conn->query("SELECT SUM(Valor) as v FROM ContasReceber WHERE DataRecebimento = '$dia'")->fetch_assoc();
            $data['charts']['fluxoCaixa']['entradas'][] = (float)($resE['v'] ?? 0);
            $resS = $conn->query("SELECT SUM(Valor) as v FROM ContasPagar WHERE DataPagamento = '$dia'")->fetch_assoc();
            $data['charts']['fluxoCaixa']['saidas'][] = (float)($resS['v'] ?? 0);
        }

        $resCat = $conn->query("SELECT Categoria, SUM(Valor) as total FROM ContasPagar WHERE Status = 'Pago' AND DataPagamento >= '$d30' GROUP BY Categoria");
        if ($resCat) {
            while ($r = $resCat->fetch_assoc()) {
                $data['charts']['despesasCategoria']['labels'][] = $r['Categoria'];
                $data['charts']['despesasCategoria']['valores'][] = (float)$r['total'];
            }
        }

        $resL1 = $conn->query("SELECT ClienteNome, DataVencimento, Valor FROM ContasReceber WHERE Status = 'Aguardando' ORDER BY DataVencimento ASC LIMIT 5");
        while ($r = $resL1->fetch_assoc()) $data['listas']['proximosRecebimentos'][] = $r;

        $resL2 = $conn->query("SELECT Descricao, DataVencimento, Valor FROM ContasPagar WHERE Status = 'Pendente' ORDER BY DataVencimento ASC LIMIT 5");
        while ($r = $resL2->fetch_assoc()) $data['listas']['proximosPagamentos'][] = $r;

        $conn->close();
        sendJsonResponse($data, 200);

    } catch (Exception $e) {
        $conn->close();
        sendJsonResponse(['error' => $e->getMessage()], 500);
    }
}

// ============================================================
// === FORNECEDORES
// ============================================================

function handleGetFornecedores() {
    $conn = get_db_connection();
    $res = $conn->query("SELECT * FROM Fornecedores ORDER BY NomeFantasia ASC");
    $data = []; while($r=$res->fetch_assoc()) $data[] = $r;
    $conn->close();
    sendJsonResponse($data, 200);
}

function handleAddFornecedor($data) {
    $conn = get_db_connection();
    $stmtCheck = $conn->prepare("SELECT ID FROM Fornecedores WHERE CNPJ = ?");
    $stmtCheck->bind_param("s", $data['CNPJ']);
    $stmtCheck->execute();
    if ($stmtCheck->get_result()->num_rows > 0) {
        $stmtCheck->close(); $conn->close();
        sendJsonResponse(['error' => 'CNPJ já cadastrado para outro fornecedor'], 409);
        return;
    }
    $stmtCheck->close();

    $stmt = $conn->prepare("INSERT INTO Fornecedores (NomeFantasia, CNPJ, RazaoSocial, Endereco, Cidade, CEP, TipoFornecedor) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("sssssss", $data['NomeFantasia'], $data['CNPJ'], $data['RazaoSocial'], $data['Endereco'], $data['Cidade'], $data['CEP'], $data['TipoFornecedor']);
    if ($stmt->execute()) sendJsonResponse(['message'=>'Salvo', 'id'=>$conn->insert_id], 201);
    else sendJsonResponse(['error'=>$stmt->error], 500);
    $conn->close();
}

function handleUpdateFornecedor($id, $data) {
    $conn = get_db_connection();
    $stmtCheck = $conn->prepare("SELECT ID FROM Fornecedores WHERE CNPJ = ? AND ID != ?");
    $stmtCheck->bind_param("si", $data['CNPJ'], $id);
    $stmtCheck->execute();
    if ($stmtCheck->get_result()->num_rows > 0) {
        $stmtCheck->close(); $conn->close();
        sendJsonResponse(['error' => 'CNPJ já cadastrado para outro fornecedor'], 409);
        return;
    }
    $stmtCheck->close();

    $stmt = $conn->prepare("UPDATE Fornecedores SET NomeFantasia=?, CNPJ=?, RazaoSocial=?, Endereco=?, Cidade=?, CEP=?, TipoFornecedor=? WHERE ID=?");
    $stmt->bind_param("sssssssi", $data['NomeFantasia'], $data['CNPJ'], $data['RazaoSocial'], $data['Endereco'], $data['Cidade'], $data['CEP'], $data['TipoFornecedor'], $id);
    if ($stmt->execute()) sendJsonResponse(['message'=>'Atualizado'], 200);
    else sendJsonResponse(['error'=>$stmt->error], 500);
    $conn->close();
}

function handleDeleteFornecedor($id) {
    $conn = get_db_connection();
    $stmt = $conn->prepare("DELETE FROM Fornecedores WHERE ID=?");
    $stmt->bind_param("i", $id);
    if($stmt->execute()) sendJsonResponse(['message'=>'Excluído'], 200);
    else sendJsonResponse(['error'=>$stmt->error], 500);
    $conn->close();
}

// ============================================================
// === DIRETORIA E DASHBOARDS GERAIS
// ============================================================

function handleGetDiretoriaDashboard() {
    $conn = get_db_connection();
    if (!$conn) sendJsonResponse(['error' => 'Erro de conexão'], 500);

    $data = [
        'financeiro' => ['saldo' => 0, 'aPagar' => 0, 'aReceber' => 0],
        'comercial' => ['pedidosAbertos' => 0, 'faturamentoTotal' => 0, 'porVendedor' => [], 'porCliente' => []],
        'estoque' => [],
        'producao' => [],
        'manutencao' => ['emAndamento' => 0, 'causas' => []],
        'rh' => ['qtdFuncionarios' => 0, 'custoMedio' => 0],
        'compras' => ['aguardando' => 0, 'porSetor' => []],
        'pendencias' => [],
        'comex' => []
    ];

    try {
        // Financeiro
        $resFin = $conn->query("SELECT (SELECT COALESCE(SUM(Valor),0) FROM ContasReceber WHERE Status = 'Pago') as recebido, (SELECT COALESCE(SUM(Valor),0) FROM ContasPagar WHERE Status = 'Pago') as pago, (SELECT COALESCE(SUM(Valor),0) FROM ContasPagar WHERE Status = 'Pendente') as aPagar, (SELECT COALESCE(SUM(Valor),0) FROM ContasReceber WHERE Status IN ('Aguardando','Pendente')) as aReceber");
        if($resFin) {
            $fin = $resFin->fetch_assoc();
            $data['financeiro']['saldo'] = $fin['recebido'] - $fin['pago'];
            $data['financeiro']['aPagar'] = (float)$fin['aPagar'];
            $data['financeiro']['aReceber'] = (float)$fin['aReceber'];
        }

        // Comercial
        $resVend = $conn->query("SELECT VendedorNome, SUM(ValorTotal) as total FROM Pedidos WHERE StatusPedido = 'Concluído' GROUP BY VendedorNome ORDER BY total DESC LIMIT 5");
        if($resVend) while($r = $resVend->fetch_assoc()) $data['comercial']['porVendedor'][] = $r;
        
        $resCli = $conn->query("SELECT ClienteNome, SUM(ValorTotal) as total FROM Pedidos WHERE StatusPedido = 'Concluído' GROUP BY ClienteNome ORDER BY total DESC LIMIT 5");
        if($resCli) while($r = $resCli->fetch_assoc()) $data['comercial']['porCliente'][] = $r;

        $resPedAbertos = $conn->query("SELECT COUNT(*) as qtd FROM Pedidos WHERE StatusPedido NOT IN ('Concluído', 'Cancelado')");
        if($resPedAbertos) $data['comercial']['pedidosAbertos'] = (int)($resPedAbertos->fetch_assoc()['qtd']??0);

        $resFat = $conn->query("SELECT SUM(ValorTotal) as v FROM Pedidos WHERE StatusPedido = 'Concluído'");
        if($resFat) $data['comercial']['faturamentoTotal'] = (float)($resFat->fetch_assoc()['v']??0);

        // Estoque
        $resEst = $conn->query("SELECT Tipo, SUM(Peso) as pesoTotal FROM Bobinas WHERE Status = 'Disponível' GROUP BY Tipo ORDER BY pesoTotal DESC");
        if($resEst) while($r = $resEst->fetch_assoc()) $data['estoque'][] = $r;

        // Manutenção
        $resManAnd = $conn->query("SELECT COUNT(*) as qtd FROM Manutencoes WHERE Status = 'Em Manutenção'");
        if($resManAnd) $data['manutencao']['emAndamento'] = (int)($resManAnd->fetch_assoc()['qtd']??0);
        
        $resMan = $conn->query("SELECT ProblemaDefeito, COUNT(*) as qtd FROM Manutencoes GROUP BY ProblemaDefeito ORDER BY qtd DESC LIMIT 5");
        if($resMan) while($r = $resMan->fetch_assoc()) $data['manutencao']['causas'][] = $r;

        // Compras
        $resCompAg = $conn->query("SELECT COUNT(*) as qtd FROM SolicitacoesCompras WHERE Status IN ('Pendente','Aguardando Aprovação')");
        if($resCompAg) $data['compras']['aguardando'] = (int)($resCompAg->fetch_assoc()['qtd']??0);
        
        $resComp = $conn->query("SELECT Setor, COUNT(*) as qtd FROM SolicitacoesCompras GROUP BY Setor");
        if($resComp) while($r = $resComp->fetch_assoc()) $data['compras']['porSetor'][] = $r;

        // Produção
        $resProd = $conn->query("SELECT p.NumPedido, p.NomeCliente FROM Producoes p JOIN Pedidos ped ON p.NumPedido = ped.NumeroPedido WHERE ped.StatusPedido = 'Em Produção' LIMIT 5");
        if($resProd) while($r = $resProd->fetch_assoc()) $data['producao'][] = $r;

        // RH
        $resRH = $conn->query("SELECT COUNT(*) as qtd, SUM(Salario) as folha FROM Funcionarios WHERE Status = 'Ativo'");
        if($resRH) {
            $rh = $resRH->fetch_assoc();
            $data['rh']['qtdFuncionarios'] = (int)($rh['qtd']??0);
            $data['rh']['custoMedio'] = ($rh['qtd'] > 0) ? ($rh['folha'] / $rh['qtd']) : 0;
        }

        // Pendências (Lista Central)
        $resPenC = $conn->query("SELECT s.ID, 'Compra' as Tipo, s.Material as Titulo, u.NomeCompleto as Autor, s.DataSolicitacao as Data, s.Status, s.CotacaoJSON, s.FornecedorEscolhido, s.ObservacaoCotacao, s.Material, s.Quantidade, s.Unidade, s.Setor, s.Descricao FROM SolicitacoesCompras s LEFT JOIN Usuarios u ON s.UsuarioID = u.ID WHERE s.Status IN ('Pendente', 'Em Cotação', 'Aguardando Aprovação')");
        if($resPenC) while($r = $resPenC->fetch_assoc()) { $r['DescricaoLista'] = "Compra: " . $r['Titulo']; $data['pendencias'][] = $r; }

        $resPenO = $conn->query("SELECT o.ID, 'Orcamento' as Tipo, o.ClienteNome as Titulo, u.NomeCompleto as Autor, o.DataOrcamento as Data, o.ValorTotal FROM Orcamentos o LEFT JOIN Usuarios u ON o.UsuarioID = u.ID WHERE o.Status = 'pendente' AND o.ValorTotal > 10000");
        if($resPenO) while($r = $resPenO->fetch_assoc()) { $r['DescricaoLista'] = "Orçamento: " . $r['Titulo']; $data['pendencias'][] = $r; }

        // Comex
        $resComex = $conn->query("SELECT ID, ContainerNumero, Armador, Mercadoria, DataETA, StatusStep, StatusAtual, Observacoes FROM RastreioContainers ORDER BY StatusStep ASC, DataETA ASC LIMIT 5");
        if($resComex) while($r = $resComex->fetch_assoc()) $data['comex'][] = $r;

        sendJsonResponse($data, 200);

    } catch (Exception $e) {
        error_log("Erro Dashboard: " . $e->getMessage());
        sendJsonResponse(['error' => $e->getMessage()], 500);
    } finally {
        $conn->close();
    }
}

// ============================================================
// === RH, PERMISSÕES E MANUTENÇÃO
// ============================================================

function handleGetFuncionarios() {
    $conn = get_db_connection();
    $res = $conn->query("SELECT * FROM Funcionarios ORDER BY NomeCompleto ASC");
    $data = []; while($r=$res->fetch_assoc()) $data[] = $r;
    $conn->close();
    sendJsonResponse($data, 200);
}

function handleAddFuncionario($data) {
    $conn = get_db_connection();
    try {
        $toNullIfEmpty = function($value) { return (empty($value) && $value !== '0' && $value !== 0) ? null : $value; };
        
        $stmt = $conn->prepare("INSERT INTO Funcionarios (NomeCompleto, FotoPerfilBase64, DataNascimento, RG, CPF, NomeMae, NomePai, Telefone, Email, Endereco, CEP, CidadeUF, PIS_PASEP, TituloEleitor, DataAdmissao, Cargo, Departamento, Salario, TipoContrato, Status, Banco, Agencia, ContaCorrente, UsuarioID) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $salario = (float)($data['Salario'] ?? 0);
        $stmt->bind_param("sssssssssssssssssdsssssi", $data['NomeCompleto'], $toNullIfEmpty($data['FotoPerfilBase64']), $toNullIfEmpty($data['DataNascimento']), $toNullIfEmpty($data['RG']), $toNullIfEmpty($data['CPF']), $toNullIfEmpty($data['NomeMae']), $toNullIfEmpty($data['NomePai']), $toNullIfEmpty($data['Telefone']), $toNullIfEmpty($data['Email']), $toNullIfEmpty($data['Endereco']), $toNullIfEmpty($data['CEP']), $toNullIfEmpty($data['CidadeUF']), $toNullIfEmpty($data['PIS_PASEP']), $toNullIfEmpty($data['TituloEleitor']), $toNullIfEmpty($data['DataAdmissao']), $toNullIfEmpty($data['Cargo']), $toNullIfEmpty($data['Departamento']), $salario, $toNullIfEmpty($data['TipoContrato']), $data['Status'], $toNullIfEmpty($data['Banco']), $toNullIfEmpty($data['Agencia']), $toNullIfEmpty($data['ContaCorrente']), $toNullIfEmpty($data['UsuarioID']));
        
        $stmt->execute();
        sendJsonResponse(['message' => 'Funcionário cadastrado com sucesso'], 201);
    } catch(Exception $e) {
        sendJsonResponse(['error' => $e->getMessage()], 500);
    }
    $conn->close();
}

function handleUpdateFuncionario($id, $data) {
    $conn = get_db_connection();
    try {
        $toNullIfEmpty = function($value) { return (empty($value) && $value !== '0' && $value !== 0) ? null : $value; };
        $stmt = $conn->prepare("UPDATE Funcionarios SET NomeCompleto=?, FotoPerfilBase64=?, DataNascimento=?, RG=?, CPF=?, NomeMae=?, NomePai=?, Telefone=?, Email=?, Endereco=?, CEP=?, CidadeUF=?, PIS_PASEP=?, TituloEleitor=?, DataAdmissao=?, Cargo=?, Departamento=?, Salario=?, TipoContrato=?, Status=?, Banco=?, Agencia=?, ContaCorrente=?, UsuarioID=? WHERE ID=?");
        $salario = (float)($data['Salario'] ?? 0);
        $stmt->bind_param("sssssssssssssssssdsssssii", $data['NomeCompleto'], $toNullIfEmpty($data['FotoPerfilBase64']), $toNullIfEmpty($data['DataNascimento']), $toNullIfEmpty($data['RG']), $toNullIfEmpty($data['CPF']), $toNullIfEmpty($data['NomeMae']), $toNullIfEmpty($data['NomePai']), $toNullIfEmpty($data['Telefone']), $toNullIfEmpty($data['Email']), $toNullIfEmpty($data['Endereco']), $toNullIfEmpty($data['CEP']), $toNullIfEmpty($data['CidadeUF']), $toNullIfEmpty($data['PIS_PASEP']), $toNullIfEmpty($data['TituloEleitor']), $toNullIfEmpty($data['DataAdmissao']), $toNullIfEmpty($data['Cargo']), $toNullIfEmpty($data['Departamento']), $salario, $toNullIfEmpty($data['TipoContrato']), $data['Status'], $toNullIfEmpty($data['Banco']), $toNullIfEmpty($data['Agencia']), $toNullIfEmpty($data['ContaCorrente']), $toNullIfEmpty($data['UsuarioID']), $id);
        
        if($stmt->execute()) sendJsonResponse(['message' => 'Funcionário atualizado com sucesso'], 200);
        else sendJsonResponse(['error' => $stmt->error], 500);
    } catch(Exception $e) {
        sendJsonResponse(['error' => $e->getMessage()], 500);
    }
    $conn->close();
}

function handleSavePermissoes($uid, $data) {
    $conn = get_db_connection();
    $conn->query("DELETE FROM Permissoes WHERE UsuarioID=$uid");
    if(!empty($data['modulos'])) {
        $stmt = $conn->prepare("INSERT INTO Permissoes (UsuarioID, Modulo) VALUES (?, ?)");
        foreach($data['modulos'] as $mod) {
            $stmt->bind_param("is", $uid, $mod);
            $stmt->execute();
        }
        $stmt->close();
    }
    $conn->close();
    sendJsonResponse(['message'=>'Permissões salvas'], 200);
}

function handleGetPermissoes($uid) {
    $conn = get_db_connection();
    $res = $conn->query("SELECT Modulo FROM Permissoes WHERE UsuarioID=$uid");
    $mods = []; while($r=$res->fetch_assoc()) $mods[]=$r['Modulo'];
    $conn->close();
    sendJsonResponse($mods, 200);
}

function handleGetManutencoes() {
    $conn = get_db_connection();
    $res = $conn->query("SELECT m.*, c.Nome as NomeCliente FROM Manutencoes m LEFT JOIN Clientes c ON m.ClienteID = c.ID ORDER BY m.ID DESC");
    $data = []; while($r=$res->fetch_assoc()) $data[]=$r;
    $conn->close();
    sendJsonResponse($data, 200);
}

function handleAddManutencao($data) {
    $conn = get_db_connection();
    $stmt = $conn->prepare("INSERT INTO Manutencoes (CodigoManutencao, ClienteID, ProblemaDefeito, Status, DataSolicitacao) VALUES (?, ?, ?, 'Pendente', CURDATE())");
    $cod = 'MNT-'.date('ym').'-'.rand(100,999);
    $stmt->bind_param("sis", $cod, $data['ClienteID'], $data['ProblemaDefeito']);
    $stmt->execute();
    $conn->close();
    sendJsonResponse(['message'=>'Salvo'], 201);
}

function handleUpdateManutencao($id, $data) {
    $conn = get_db_connection();
    $stmt = $conn->prepare("UPDATE Manutencoes SET Status=?, ServicoRealizado=?, Valor=? WHERE ID=?");
    $val = (float)($data['Valor']??0);
    $stmt->bind_param("ssdi", $data['Status'], $data['ServicoRealizado'], $val, $id);
    $stmt->execute();
    $conn->close();
    sendJsonResponse(['message'=>'Atualizado'], 200);
}

function handleGetPedidosCompra() {
    $conn = get_db_connection();
    $res = $conn->query("SELECT * FROM PedidosCompra ORDER BY ID DESC");
    $data = []; 
    while($r=$res->fetch_assoc()) {
        $pid = $r['ID'];
        $resI = $conn->query("SELECT * FROM ItensPedidoCompra WHERE PedidoCompraID = $pid");
        $r['itens'] = []; while($i=$resI->fetch_assoc()) $r['itens'][]=$i;
        $r['numero'] = $r['NumeroPedido']; $r['fornecedor'] = $r['Fornecedor']; $r['valorTotal'] = (float)$r['ValorTotal']; $r['status'] = $r['Status']; $r['dataPedido'] = $r['DataPedido'];
        $data[] = $r;
    }
    $conn->close();
    sendJsonResponse($data, 200);
}

function handleAddPedidoCompra($data) {
    $conn = get_db_connection();
    $stmt = $conn->prepare("INSERT INTO PedidosCompra (NumeroPedido, Fornecedor, ValorTotal, Status, DataPedido) VALUES (?, ?, ?, ?, CURDATE())");
    $stmt->bind_param("ssds", $data['numero'], $data['fornecedor'], $data['valorTotal'], $data['status']);
    $stmt->execute();
    $conn->close();
    sendJsonResponse(['message'=>'Salvo'], 201);
}

function handleUpdatePedidoCompra($id, $data) {
    $conn = get_db_connection();
    $stmt = $conn->prepare("UPDATE PedidosCompra SET Status=?, DataEntrega=? WHERE ID=?");
    $stmt->bind_param("ssi", $data['status'], $data['dataEntrega'], $id);
    $stmt->execute();
    $conn->close();
    sendJsonResponse(['message'=>'Atualizado'], 200);
}

function handleGetAvisosSistema() {
    $conn = get_db_connection();
    $res = $conn->query("SELECT * FROM AvisosSistema WHERE Ativo=1 ORDER BY ID DESC");
    $data = []; while($r=$res->fetch_assoc()) $data[] = $r;
    $conn->close();
    sendJsonResponse($data, 200);
}

function handleAddAvisoSistema($data) {
    $conn = get_db_connection();
    $stmt = $conn->prepare("INSERT INTO AvisosSistema (Titulo, Mensagem, Tipo, CriadoPor) VALUES (?, ?, ?, ?)");
    $stmt->bind_param("sssi", $data['titulo'], $data['mensagem'], $data['tipo'], $data['usuario_id']);
    $stmt->execute();
    $conn->close();
    sendJsonResponse(['message'=>'Aviso criado'], 201);
}

function handleDeleteAvisoSistema($id) {
    $conn = get_db_connection();
    $stmt = $conn->prepare("UPDATE AvisosSistema SET Ativo=0 WHERE ID=?");
    $stmt->bind_param("i", $id);
    if($stmt->execute()) sendJsonResponse(['message'=>'Aviso removido'], 200);
    else sendJsonResponse(['error'=>$stmt->error], 500);
    $conn->close();
}

function handleGetSolicitacoesCompras() {
    $conn = get_db_connection();
    $uid = isset($_GET['usuarioID']) ? (int)$_GET['usuarioID'] : null;
    $role = $_GET['role'] ?? 'user';
    $sql = "SELECT s.*, u.NomeCompleto as Solicitante FROM SolicitacoesCompras s JOIN Usuarios u ON s.UsuarioID = u.ID";
    if($role !== 'admin' && $uid) $sql .= " WHERE s.UsuarioID = $uid";
    $sql .= " ORDER BY FIELD(s.Status, 'Pendente', 'Em Cotação', 'Aguardando Aprovação'), s.DataSolicitacao DESC";
    $res = $conn->query($sql);
    $data = []; while($r=$res->fetch_assoc()) $data[] = $r;
    $conn->close();
    sendJsonResponse($data, 200);
}

function handleAddSolicitacaoCompra($data) {
    $conn = get_db_connection();
    $stmt = $conn->prepare("INSERT INTO SolicitacoesCompras (UsuarioID, Setor, Material, Quantidade, Unidade, Descricao, Prioridade, DataNecessidade, Status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pendente')");
    $dn = !empty($data['DataNecessidade']) ? $data['DataNecessidade'] : null;
    $stmt->bind_param("issdssss", $data['UsuarioID'], $data['Setor'], $data['Material'], $data['Quantidade'], $data['Unidade'], $data['Descricao'], $data['Prioridade'], $dn);
    if($stmt->execute()) sendJsonResponse(['message'=>'Salvo'], 201);
    else sendJsonResponse(['error'=>$stmt->error], 500);
    $conn->close();
}

function handleUpdateSolicitacaoCompra($id, $data) {
    $conn = get_db_connection();
    $conn->begin_transaction();
    try {
        $fields = []; $types = ''; $values = [];
        if(isset($data['Status'])) { $fields[]="Status=?"; $types.='s'; $values[]=$data['Status']; }
        if(isset($data['MotivoRecusa'])) { $fields[]="MotivoRecusa=?"; $types.='s'; $values[]=$data['MotivoRecusa']; }
        if(isset($data['CotacaoJSON'])) { $fields[]="CotacaoJSON=?"; $types.='s'; $values[]=$data['CotacaoJSON']; }
        if(isset($data['FornecedorEscolhido'])) { $fields[]="FornecedorEscolhido=?"; $types.='i'; $values[]=$data['FornecedorEscolhido']; }
        if(isset($data['ObservacaoCotacao'])) { $fields[]="ObservacaoCotacao=?"; $types.='s'; $values[]=$data['ObservacaoCotacao']; }

        if(!empty($fields)) {
            $types.='i'; $values[]=$id;
            $stmt=$conn->prepare("UPDATE SolicitacoesCompras SET ".implode(', ', $fields)." WHERE ID=?");
            $stmt->bind_param($types, ...$values);
            $stmt->execute(); $stmt->close();
        }

        if(isset($data['Status']) && $data['Status'] === 'Aprovado') {
            $stmtReq=$conn->prepare("SELECT * FROM SolicitacoesCompras WHERE ID=?");
            $stmtReq->bind_param("i",$id); $stmtReq->execute();
            $req=$stmtReq->get_result()->fetch_assoc(); $stmtReq->close();
            
            $cot=json_decode($req['CotacaoJSON'],true); $idx=$req['FornecedorEscolhido'];
            $fornecedor=''; $valor=0; $pgto='';
            
            if($cot && $idx && isset($cot["fornecedor$idx"])) {
                $venc=$cot["fornecedor$idx"]; $fornecedor=$venc['nome']; $valor=(float)$venc['preco']+(float)($venc['frete']??0); $pgto=$venc['pagamento'];
            } elseif(isset($data['FornecedorSelecionado'])) {
                $fornecedor=$data['FornecedorSelecionado']; $valor=(float)$data['ValorFinal']; $pgto=$data['FormaPagamento'];
            } else throw new Exception("Dados de aprovação incompletos");

            $num='PC-'.date('Y').'-'.$id; $obs="Aprovado. Req #$id.";
            $stmtP=$conn->prepare("INSERT INTO PedidosCompra (SolicitacaoID, NumeroPedido, Fornecedor, DataPedido, Status, ValorTotal, Observacoes, UsuarioID) VALUES (?, ?, ?, CURDATE(), 'Solicitado', ?, ?, ?)");
            $stmtP->bind_param("issdsi", $id, $num, $fornecedor, $valor, $obs, $req['UsuarioID']);
            $stmtP->execute(); $pid=$conn->insert_id; $stmtP->close();

            $stmtI=$conn->prepare("INSERT INTO ItensPedidoCompra (PedidoCompraID, NomeItem, Quantidade, Unidade, ValorUnitario, ValorTotal) VALUES (?, ?, ?, ?, ?, ?)");
            $vUnit=$req['Quantidade']>0?$valor/$req['Quantidade']:0;
            $stmtI->bind_param("isdddd", $pid, $req['Material'], $req['Quantidade'], $req['Unidade'], $vUnit, $valor);
            $stmtI->execute(); $stmtI->close();
            
            if(!empty($data['GerarFinanceiro']) || !empty($cot)) {
                $vencF=$data['DataVencimento']??date('Y-m-d', strtotime('+30 days'));
                $stmtF=$conn->prepare("INSERT INTO ContasPagar (UsuarioID, Descricao, Fornecedor, Categoria, Valor, DataVencimento, Status, FormaPagamento) VALUES (?, ?, ?, 'Matéria-Prima', ?, ?, 'Pendente', ?)");
                $desc="Compra: {$req['Material']}";
                $stmtF->bind_param("issdss", $req['UsuarioID'], $desc, $fornecedor, $valor, $vencF, $pgto);
                $stmtF->execute(); $stmtF->close();
            }
        }
        $conn->commit();
        sendJsonResponse(['message'=>'Atualizado'], 200);
    } catch(Exception $e) {
        $conn->rollback(); sendJsonResponse(['error'=>$e->getMessage()], 500);
    } finally { $conn->close(); }
}

function handleDeleteSolicitacaoCompra($id) {
    $conn = get_db_connection();
    $stmt = $conn->prepare("DELETE FROM SolicitacoesCompras WHERE ID=?");
    $stmt->bind_param("i", $id);
    if($stmt->execute()) sendJsonResponse(['message'=>'Excluído'], 200);
    else sendJsonResponse(['error'=>$stmt->error], 500);
    $conn->close();
}

function handleGetRastreio() {
    $conn = get_db_connection();
    $res = $conn->query("SELECT * FROM RastreioContainers ORDER BY StatusStep ASC, DataETA ASC");
    $data = []; while($r = $res->fetch_assoc()) $data[] = $r;
    $conn->close();
    sendJsonResponse($data, 200);
}

function handleAddRastreio($data) {
    $conn = get_db_connection();
    $stmt = $conn->prepare("INSERT INTO RastreioContainers (ContainerNumero, Armador, Mercadoria, DataETA, StatusStep, StatusAtual, Observacoes) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $steps = [1=>'Documentação', 2=>'Booking', 3=>'Em Trânsito', 4=>'Atracação', 5=>'Desembaraço', 6=>'Carregamento', 7=>'Em Transporte', 8=>'Entregue'];
    $stTxt = $data['StatusAtual'] ?? $steps[$data['StatusStep']];
    $stmt->bind_param("ssssiss", $data['ContainerNumero'], $data['Armador'], $data['Mercadoria'], $data['DataETA'], $data['StatusStep'], $stTxt, $data['Observacoes']);
    if($stmt->execute()) sendJsonResponse(['message'=>'Rastreio criado'], 201);
    else sendJsonResponse(['error'=>$stmt->error], 500);
    $conn->close();
}

function handleUpdateRastreio($id, $data) {
    $conn = get_db_connection();
    $steps = [1=>'Documentação Iniciada', 2=>'Booking Confirmado', 3=>'Em Trânsito Marítimo', 4=>'Navio Atracado', 5=>'Desembaraço Aduaneiro', 6=>'Carregamento Caminhão', 7=>'Em Transporte Rodoviário', 8=>'Entregue na Fábrica'];
    $step = (int)$data['StatusStep']; $statusTxt = $steps[$step] ?? 'Atualizado';
    $stmt = $conn->prepare("UPDATE RastreioContainers SET StatusStep=?, StatusAtual=?, DataETA=?, Observacoes=? WHERE ID=?");
    $stmt->bind_param("isssi", $step, $statusTxt, $data['DataETA'], $data['Observacoes'], $id);
    if($stmt->execute()) sendJsonResponse(['message'=>'Atualizado'], 200);
    else sendJsonResponse(['error'=>$stmt->error], 500);
    $conn->close();
}

function handleDeleteRastreio($id) {
    $conn = get_db_connection();
    $stmt = $conn->prepare("DELETE FROM RastreioContainers WHERE ID=?");
    $stmt->bind_param("i", $id);
    if($stmt->execute()) sendJsonResponse(['message'=>'Excluído'], 200);
    else sendJsonResponse(['error'=>$stmt->error], 500);
    $conn->close();
}

function handleUpdateUserActivity($uid) {
    $conn = get_db_connection();
    $now = date('Y-m-d H:i:s');
    $conn->query("UPDATE Usuarios SET UltimaAtividade = '$now' WHERE ID = $uid");
    $conn->close();
    sendJsonResponse(['status'=>'ok']);
}

function handleGetChatUsuarios() {
    $conn = get_db_connection();
    $meuID = $_GET['meuID'] ?? 0;
    $sql = "SELECT ID, NomeCompleto, NomeUsuario, UltimaAtividade, FotoPerfilBase64 FROM Usuarios WHERE ID != $meuID ORDER BY NomeCompleto ASC";
    $res = $conn->query($sql);
    $usuarios = []; $agora = time();
    while($r = $res->fetch_assoc()) {
        $last = $r['UltimaAtividade'] ? strtotime($r['UltimaAtividade']) : 0;
        $r['Online'] = ($agora - $last < 120);
        $count = $conn->query("SELECT COUNT(*) as qtd FROM ChatMensagens WHERE RemetenteID = {$r['ID']} AND DestinatarioID = $meuID AND Lida = 0")->fetch_assoc();
        $r['NaoLidas'] = $count['qtd'];
        $usuarios[] = $r;
    }
    $conn->close();
    sendJsonResponse($usuarios, 200);
}

function handleGetChatMensagens($outroUsuarioID) {
    $conn = get_db_connection();
    $meuID = isset($_GET['meuID']) ? (int)$_GET['meuID'] : 0;
    $outroID = (int)$outroUsuarioID;
    if ($meuID === 0 || $outroID === 0) { $conn->close(); sendJsonResponse([], 200); return; }
    $conn->query("UPDATE ChatMensagens SET Lida = 1 WHERE RemetenteID = $outroID AND DestinatarioID = $meuID");
    $stmt = $conn->prepare("SELECT m.*, DATE_FORMAT(m.DataEnvio, '%H:%i') as HoraFormatada FROM ChatMensagens m WHERE (m.RemetenteID = ? AND m.DestinatarioID = ?) OR (m.RemetenteID = ? AND m.DestinatarioID = ?) ORDER BY m.DataEnvio ASC");
    $stmt->bind_param("iiii", $meuID, $outroID, $outroID, $meuID);
    $stmt->execute();
    $res = $stmt->get_result();
    $msgs = []; while($r = $res->fetch_assoc()) $msgs[] = $r;
    $stmt->close(); $conn->close();
    sendJsonResponse($msgs, 200);
}

function handleEnviarMensagem($data) {
    $conn = get_db_connection();
    $stmt = $conn->prepare("INSERT INTO ChatMensagens (RemetenteID, DestinatarioID, Mensagem) VALUES (?, ?, ?)");
    $stmt->bind_param("iis", $data['RemetenteID'], $data['DestinatarioID'], $data['Mensagem']);
    if($stmt->execute()) sendJsonResponse(['message'=>'Enviado'], 201);
    else sendJsonResponse(['error'=>'Erro ao enviar'], 500);
    $conn->close();
}

// ============================================================
// === IMPORTAÇÃO DE XML (NFE) - LÓGICA INTELIGENTE
// ============================================================

function handleImportarXMLNFe() {
    $conn = get_db_connection();
    
    // 1. Verifica Upload e Localização
    if (!isset($_FILES['xml_file']) || $_FILES['xml_file']['error'] != 0) {
        sendJsonResponse(['error' => 'Nenhum arquivo enviado ou erro no upload.'], 400);
    }

    // Pega o local escolhido pelo usuário (ou usa Almoxarifado como fallback)
    $localDestino = $_POST['local_destino'] ?? 'João Mafra';

    $fileTmpPath = $_FILES['xml_file']['tmp_name'];
    $xmlContent = file_get_contents($fileTmpPath);
    
    try {
        $xml = simplexml_load_string($xmlContent);
        if (!$xml) throw new Exception("Arquivo não é um XML válido.");
    } catch (Exception $e) {
        sendJsonResponse(['error' => 'Erro ao ler XML.'], 400);
    }

    $infNFe = $xml->NFe->infNFe ?? $xml->infNFe; 
    if (!$infNFe) $infNFe = $xml; 

    $conn->begin_transaction();

    try {
        // === DADOS DA NOTA E FORNECEDOR (Código igual ao anterior) ===
        $emit = $infNFe->emit;
        $ide = $infNFe->ide;
        $total = $infNFe->total->ICMSTot;

        $chave = str_replace('NFe', '', (string)($infNFe->attributes()->Id ?? ''));
        $numeroNota = (string)$ide->nNF;
        $serie = (string)$ide->serie;
        $dataEmissao = substr((string)$ide->dhEmi, 0, 10);
        $valorNota = (float)$total->vNF;

        // Verifica duplicidade
        $checkDup = $conn->query("SELECT ID FROM NotasFiscais WHERE ChaveAcesso = '$chave'");
        if ($checkDup->num_rows > 0) throw new Exception("Nota já importada.");

        // Fornecedor
        $cnpjFornecedor = (string)$emit->CNPJ;
        $nomeFornecedor = (string)$emit->xNome;
        $endFornecedor = (string)$emit->enderEmit->xLgr . ', ' . (string)$emit->enderEmit->nro;
        
        $resForn = $conn->query("SELECT ID FROM Fornecedores WHERE CNPJ = '$cnpjFornecedor'");
        if ($resForn->num_rows > 0) {
            $fornecedorID = $resForn->fetch_assoc()['ID'];
        } else {
            $stmtF = $conn->prepare("INSERT INTO Fornecedores (NomeFantasia, RazaoSocial, CNPJ, Endereco, TipoFornecedor) VALUES (?, ?, ?, ?, 'Indústria/Comércio')");
            $stmtF->bind_param("ssss", $nomeFornecedor, $nomeFornecedor, $cnpjFornecedor, $endFornecedor);
            $stmtF->execute();
            $fornecedorID = $conn->insert_id;
            $stmtF->close();
        }

        // Salva Nota
        $stmtNota = $conn->prepare("INSERT INTO NotasFiscais (ChaveAcesso, NumeroNota, Serie, FornecedorID, DataEmissao, ValorTotal) VALUES (?, ?, ?, ?, ?, ?)");
        $stmtNota->bind_param("sssisd", $chave, $numeroNota, $serie, $fornecedorID, $dataEmissao, $valorNota);
        $stmtNota->execute();
        $notaID = $conn->insert_id;
        $stmtNota->close();

        // === PROCESSA ITENS ===
        foreach ($infNFe->det as $item) {
            $prod = $item->prod;
            $codigoXML = (string)$prod->cProd;
            $nomeXML = (string)$prod->xProd;
            $ncm = (string)$prod->NCM;
            $cfop = (string)$prod->CFOP;
            $uCom = (string)$prod->uCom;
            $qCom = (float)$prod->qCom;
            $vUnCom = (float)$prod->vUnCom;
            $vProd = (float)$prod->vProd;

            // Busca ou Cria Produto
            $sqlProd = "SELECT ID FROM Produtos WHERE NomeItem = ? OR CodigoReferencia = ? LIMIT 1";
            $stmtP = $conn->prepare($sqlProd);
            $stmtP->bind_param("ss", $nomeXML, $codigoXML);
            $stmtP->execute();
            $resP = $stmtP->get_result();
            
            if ($resP->num_rows > 0) {
                $produtoID = $resP->fetch_assoc()['ID'];
            } else {
                $unidadePadrao = (strpos(strtolower($uCom), 'kg') !== false) ? 'Kg' : ((strpos(strtolower($uCom), 'm') !== false) ? 'Metro' : 'Unidade');
                $stmtNewP = $conn->prepare("INSERT INTO Produtos (NomeItem, UnidadeMedida, CodigoReferencia, PrecoSerralheria) VALUES (?, ?, ?, ?)");
                $stmtNewP->bind_param("sssd", $nomeXML, $unidadePadrao, $codigoXML, $vUnCom);
                $stmtNewP->execute();
                $produtoID = $conn->insert_id;
                $stmtNewP->close();
            }
            $stmtP->close();

            // Salva Item da Nota
            $stmtItem = $conn->prepare("INSERT INTO ItensNotaFiscal (NotaID, ProdutoID, NomeProdutoXML, CodigoProdutoXML, NCM, CFOP, Unidade, Quantidade, ValorUnitario, ValorTotal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmtItem->bind_param("iisssssddd", $notaID, $produtoID, $nomeXML, $codigoXML, $ncm, $cfop, $uCom, $qCom, $vUnCom, $vProd);
            $stmtItem->execute();
            $stmtItem->close();

            // === ATUALIZAÇÃO INTELIGENTE DE ESTOQUE ===
            // Verifica se o produto já existe NA LOCALIZAÇÃO ESCOLHIDA
            $stmtEstCheck = $conn->prepare("SELECT ID FROM EstoqueProdutos WHERE ProdutoID = ? AND Localizacao = ? LIMIT 1");
            $stmtEstCheck->bind_param("is", $produtoID, $localDestino);
            $stmtEstCheck->execute();
            $resEstoque = $stmtEstCheck->get_result();
            $stmtEstCheck->close();

            if ($resEstoque->num_rows > 0) {
                // Já existe nessa prateleira: SOMA
                $estID = $resEstoque->fetch_assoc()['ID'];
                $conn->query("UPDATE EstoqueProdutos SET Quantidade = Quantidade + $qCom WHERE ID = $estID");
            } else {
                // Não existe nessa prateleira: CRIA NOVO REGISTRO
                $stmtEst = $conn->prepare("INSERT INTO EstoqueProdutos (ProdutoID, Localizacao, Quantidade) VALUES (?, ?, ?)");
                $stmtEst->bind_param("isd", $produtoID, $localDestino, $qCom);
                $stmtEst->execute();
                $stmtEst->close();
            }
        }

        $conn->commit();
        sendJsonResponse(['message' => "Importado com sucesso para: $localDestino!", 'notaID' => $notaID], 201);

    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['error' => 'Erro: ' . $e->getMessage()], 500);
    } finally {
        $conn->close();
    }
}

function handleGetNotasFiscais() {
    $conn = get_db_connection();
    // Busca as últimas 50 notas com nome do fornecedor
    $sql = "SELECT nf.*, f.NomeFantasia as NomeFornecedor 
            FROM NotasFiscais nf 
            LEFT JOIN Fornecedores f ON nf.FornecedorID = f.ID 
            ORDER BY nf.DataEmissao DESC, nf.ID DESC LIMIT 50";
    $res = $conn->query($sql);
    $data = [];
    while ($row = $res->fetch_assoc()) $data[] = $row;
    $conn->close();
    sendJsonResponse($data, 200);
}

// Adicione ao final do arquivo legacy_functions.php

function handleGetDetalhesNota($id) {
    $conn = get_db_connection();
    
    // 1. Busca Cabeçalho da Nota
    $sqlHeader = "SELECT nf.*, f.NomeFantasia, f.CNPJ, f.RazaoSocial 
                  FROM NotasFiscais nf 
                  LEFT JOIN Fornecedores f ON nf.FornecedorID = f.ID 
                  WHERE nf.ID = ?";
    $stmt = $conn->prepare($sqlHeader);
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $header = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$header) {
        sendJsonResponse(['error' => 'Nota não encontrada.'], 404);
        return;
    }

    // 2. Busca Itens da Nota
    $sqlItems = "SELECT * FROM ItensNotaFiscal WHERE NotaID = ?";
    $stmtI = $conn->prepare($sqlItems);
    $stmtI->bind_param("i", $id);
    $stmtI->execute();
    $resI = $stmtI->get_result();
    
    $itens = [];
    while ($row = $resI->fetch_assoc()) {
        $itens[] = $row;
    }
    $stmtI->close();
    $conn->close();

    // Retorna tudo junto
    sendJsonResponse(['nota' => $header, 'itens' => $itens], 200);
}

?>