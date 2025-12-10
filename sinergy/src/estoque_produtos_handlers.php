<?php
/**
 * Handlers para Gestão de Estoque de Produtos
 * Versão: Multi-Localização + Classe Global + Status Colorido
 */

/**
 * Retorna todo o estoque (bruto)
 */
function handleGetEstoqueProdutos() {
    $conn = get_db_connection();
    if (!$conn) sendJsonResponse(['error' => 'Erro de conexão'], 500);

    try {
        // AGORA BUSCAMOS A CLASSE DA TABELA PRODUTOS (p.Classe)
        $query = "
            SELECT 
                ep.ID, 
                p.ID as ProdutoID,
                p.NomeItem,
                p.UnidadeMedida,
                COALESCE(p.Classe, 'Outros') as Classe, -- Vem do Produto (Global)
                COALESCE(ep.Quantidade, 0) as QuantidadeAtual,
                COALESCE(ep.QuantidadeMinima, 0) as QuantidadeMinima,
                COALESCE(ep.Localizacao, 'Padrão') as Localizacao,
                COALESCE(ep.Observacao, '') as Observacao
            FROM Produtos p
            LEFT JOIN EstoqueProdutos ep ON p.ID = ep.ProdutoID
            ORDER BY p.NomeItem ASC, ep.Localizacao ASC
        ";

        $result = $conn->query($query);
        $estoque = [];
        if ($result) {
            while ($row = $result->fetch_assoc()) {
                $row['QuantidadeAtual'] = (float)$row['QuantidadeAtual'];
                $row['QuantidadeMinima'] = (float)$row['QuantidadeMinima'];
                
                // Define status preliminar (o JS recalcula para a visão Geral)
                if ($row['QuantidadeAtual'] <= 0) $row['StatusEstoque'] = 'Zerado';
                elseif ($row['QuantidadeAtual'] <= $row['QuantidadeMinima']) $row['StatusEstoque'] = 'Crítico';
                elseif ($row['QuantidadeAtual'] <= ($row['QuantidadeMinima'] * 1.2)) $row['StatusEstoque'] = 'Baixo';
                else $row['StatusEstoque'] = 'Normal';

                $estoque[] = $row;
            }
        }
        sendJsonResponse($estoque, 200);
    } catch (Exception $e) {
        error_log("Erro ao buscar estoque: " . $e->getMessage());
        sendJsonResponse(['error' => 'Erro ao carregar estoque'], 500);
    } finally {
        $conn->close();
    }
}

/**
 * Edição de Estoque (Atualiza Classe Global + Estoque Local)
 */
function handleSetEstoqueProduto($data) {
    $conn = get_db_connection();
    if (!$conn) sendJsonResponse(['error' => 'Erro de conexão'], 500);
    
    $produto_id = (int)$data['ProdutoID'];
    $qtd = (float)($data['Quantidade'] ?? 0);
    $min = (float)($data['QuantidadeMinima'] ?? 0);
    
    $classe = sanitize_input($data['Classe'] ?? '');
    $loc = sanitize_input($data['Localizacao'] ?? 'Padrão');
    $obs = sanitize_input($data['Observacao'] ?? '');
    $user = sanitize_input($data['Usuario'] ?? 'Sistema');

    $conn->begin_transaction(); // Transação para garantir integridade

    try {
        // 1. ATUALIZA A CLASSE GLOBAL NO PRODUTO
        $stmt_prod = $conn->prepare("UPDATE Produtos SET Classe = ? WHERE ID = ?");
        $stmt_prod->bind_param("si", $classe, $produto_id);
        $stmt_prod->execute();
        $stmt_prod->close();

        // 2. ATUALIZA OU CRIA O ESTOQUE LOCAL
        $stmt_check = $conn->prepare("SELECT ID FROM EstoqueProdutos WHERE ProdutoID = ? AND Localizacao = ?");
        $stmt_check->bind_param("is", $produto_id, $loc);
        $stmt_check->execute();
        $res_check = $stmt_check->get_result();
        
        if ($res_check->num_rows > 0) {
            // UPDATE (Removemos Classe daqui pois agora é global)
            $stmt = $conn->prepare("UPDATE EstoqueProdutos SET Quantidade=?, QuantidadeMinima=?, Observacao=?, Usuario=? WHERE ProdutoID=? AND Localizacao=?");
            $stmt->bind_param("ddsis", $qtd, $min, $obs, $user, $produto_id, $loc);
        } else {
            // INSERT
            $stmt = $conn->prepare("INSERT INTO EstoqueProdutos (ProdutoID, Quantidade, QuantidadeMinima, Localizacao, Observacao, Usuario) VALUES (?, ?, ?, ?, ?, ?)");
            $stmt->bind_param("iddsss", $produto_id, $qtd, $min, $loc, $obs, $user);
        }

        if ($stmt->execute()) {
            $conn->commit();
            sendJsonResponse(['message' => 'Estoque salvo com sucesso'], 200);
        } else {
            throw new Exception($stmt->error);
        }

    } catch (Exception $e) {
        $conn->rollback();
        error_log("Erro ao salvar: " . $e->getMessage());
        sendJsonResponse(['error' => 'Erro ao salvar dados: ' . $e->getMessage()], 500);
    } finally {
        $conn->close();
    }
}

/**
 * Movimentação (Entrada/Saída)
 */
function handleMovimentarEstoqueProduto($data) {
    $conn = get_db_connection();
    if (!$conn) sendJsonResponse(['error' => 'Erro de conexão'], 500);

    $produto_id = (int)$data['ProdutoID'];
    $loc = sanitize_input($data['Localizacao']);
    $qtd_mov = abs((float)$data['Quantidade']);
    $tipo = $data['TipoMovimentacao'];
    $motivo = sanitize_input($data['Motivo']??'');
    $obs = sanitize_input($data['Observacao']??'');
    $user = sanitize_input($data['Usuario']??'Sistema');

    if (empty($loc)) sendJsonResponse(['error' => 'Localização é obrigatória.'], 400);

    $conn->begin_transaction();
    try {
        // Busca estoque específico
        $stmt_check = $conn->prepare("SELECT ID, Quantidade FROM EstoqueProdutos WHERE ProdutoID = ? AND Localizacao = ? FOR UPDATE");
        $stmt_check->bind_param("is", $produto_id, $loc);
        $stmt_check->execute();
        $res_check = $stmt_check->get_result();

        if ($res_check->num_rows == 0) {
            $stmt_ins = $conn->prepare("INSERT INTO EstoqueProdutos (ProdutoID, Localizacao, Quantidade) VALUES (?, ?, 0)");
            $stmt_ins->bind_param("is", $produto_id, $loc);
            $stmt_ins->execute();
            $qtd_ant = 0;
        } else {
            $row = $res_check->fetch_assoc();
            $qtd_ant = (float)$row['Quantidade'];
        }

        $qtd_nov = ($tipo == 'Entrada') ? $qtd_ant + $qtd_mov : $qtd_ant - $qtd_mov;
        if ($qtd_nov < 0) throw new Exception("Saldo insuficiente nesta localização ($loc).");

        $stmt_upd = $conn->prepare("UPDATE EstoqueProdutos SET Quantidade=?, Usuario=? WHERE ProdutoID=? AND Localizacao=?");
        $stmt_upd->bind_param("dsis", $qtd_nov, $user, $produto_id, $loc);
        $stmt_upd->execute();

        // Histórico
        $stmt_hist = $conn->prepare("INSERT INTO MovimentacoesEstoqueProdutos (ProdutoID, TipoMovimentacao, Quantidade, QuantidadeAnterior, QuantidadeAtual, Motivo, Observacao, Usuario) VALUES (?,?,?,?,?,?,?,?)");
        $obs_final = "[$loc] " . $obs;
        $stmt_hist->bind_param("isdddsss", $produto_id, $tipo, $qtd_mov, $qtd_ant, $qtd_nov, $motivo, $obs_final, $user);
        $stmt_hist->execute();
        
        $conn->commit();
        sendJsonResponse(['message'=>'Movimentação OK', 'novo_saldo'=>$qtd_nov], 200);
    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['error'=>$e->getMessage()], 400);
    }
    $conn->close();
}

// Helpers de Leitura (Mantidos para compatibilidade)
function handleGetEstatisticasEstoqueProdutos() { sendJsonResponse([], 200); }
function handleGetProdutosEstoqueBaixo() {
    $conn = get_db_connection();
    // Agora pegamos a classe de P (Produto) e não EP
    $query = "SELECT ep.*, p.NomeItem, p.UnidadeMedida, p.Classe FROM EstoqueProdutos ep JOIN Produtos p ON ep.ProdutoID = p.ID WHERE ep.Quantidade <= (ep.QuantidadeMinima*1.2)";
    $res = $conn->query($query);
    $out = []; while($r = $res->fetch_assoc()) $out[] = $r;
    sendJsonResponse($out, 200);
}
function handleGetHistoricoMovimentacoesProduto($id) {
    $conn = get_db_connection();
    $res = $conn->query("SELECT * FROM MovimentacoesEstoqueProdutos WHERE ProdutoID = $id ORDER BY DataMovimentacao DESC LIMIT 50");
    $out = []; while($r = $res->fetch_assoc()) $out[] = $r;
    sendJsonResponse($out, 200);
}
function handleGetEstoqueProdutoById($produto_id) {
    $conn = get_db_connection();
    $stmt = $conn->prepare("SELECT ep.*, p.NomeItem, p.UnidadeMedida, p.Classe FROM EstoqueProdutos ep JOIN Produtos p ON ep.ProdutoID = p.ID WHERE ep.ProdutoID = ?");
    $stmt->bind_param("i", $produto_id);
    $stmt->execute();
    $res = $stmt->get_result();
    $out = [];
    while($r = $res->fetch_assoc()) $out[] = $r;
    if (count($out) > 0) sendJsonResponse($out[0], 200);
    else sendJsonResponse(['error'=>'Não encontrado'], 404);
}
?>