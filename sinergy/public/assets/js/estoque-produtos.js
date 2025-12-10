/**
 * estoque-produtos.js
 * Funcionalidades: Multi-Localização, Paginação (10 itens), 3 Botões de Ação
 * Correção: Inclusão de TODAS as funções utilitárias (calcularStatus e atualizarCardsEstatisticas)
 */

const API_BASE_URL = 'https://virtualcriacoes.com/sinergy/api';
let estoqueProdutos = []; // Dados brutos da API
let dadosExibicao = [];   // Dados filtrados/processados
let currentPageProd = 1;
const itemsPerPageProd = 10;

document.addEventListener('DOMContentLoaded', () => {
    // Só inicia se a seção de produtos existir na página
    if (document.getElementById('estoque-produtos-section')) {
        initializeEstoqueProdutos();
    }
});

async function initializeEstoqueProdutos() {
    const userId = window.getLoggedInUserID ? window.getLoggedInUserID() : null;
    if (!userId) return;

    setupEventListeners();
    await loadEstoqueProdutos();
}

async function loadEstoqueProdutos() {
    try {
        const response = await fetch(`${API_BASE_URL}/estoque-produtos`);
        if (!response.ok) throw new Error('Erro ao carregar estoque');
        estoqueProdutos = await response.json();
        
        // Aplica filtros e renderiza a primeira vez
        aplicarFiltrosERenderizar();
        
    } catch (error) {
        console.error(error);
        showNotification('Erro ao carregar dados de estoque.', 'error');
    }
}

function setupEventListeners() {
    // Filtros
    document.getElementById('filter-status-estoque')?.addEventListener('change', () => { currentPageProd = 1; aplicarFiltrosERenderizar(); });
    document.getElementById('filter-classe-estoque')?.addEventListener('change', () => { currentPageProd = 1; aplicarFiltrosERenderizar(); });
    document.getElementById('filter-localizacao-estoque')?.addEventListener('change', () => { currentPageProd = 1; aplicarFiltrosERenderizar(); });
    document.getElementById('search-produto-estoque')?.addEventListener('input', () => { currentPageProd = 1; aplicarFiltrosERenderizar(); });

    // Paginação
    document.getElementById('btn-prev-page-prod')?.addEventListener('click', () => mudarPagina(-1));
    document.getElementById('btn-next-page-prod')?.addEventListener('click', () => mudarPagina(1));

    // Modais
    document.getElementById('close-modal-estoque')?.addEventListener('click', fecharModais);
    document.getElementById('btn-cancelar-estoque')?.addEventListener('click', fecharModais);
    document.getElementById('close-modal-movimentacao')?.addEventListener('click', fecharModais);
    document.getElementById('btn-cancelar-movimentacao')?.addEventListener('click', fecharModais);

    // Forms
    const formEstoque = document.getElementById('form-estoque-produto');
    if (formEstoque) formEstoque.addEventListener('submit', salvarEstoque);

    const formMov = document.getElementById('form-movimentacao');
    if (formMov) formMov.addEventListener('submit', salvarMovimentacao);
    
    // Listener especial: Quando mudar a localização no modal de EDIÇÃO, carregar os dados daquela location
    const locEditInput = document.getElementById('input-localizacao');
    if(locEditInput) {
        locEditInput.addEventListener('change', function() {
            const prodId = document.getElementById('produto-id-hidden').value;
            if(prodId && this.value) {
                // Comparação com == para garantir que string/int funcionem
                const item = estoqueProdutos.find(p => p.ProdutoID == prodId && p.Localizacao === this.value);
                if(item) {
                    document.getElementById('input-quantidade').value = item.QuantidadeAtual;
                    document.getElementById('input-qtd-minima').value = item.QuantidadeMinima;
                    document.getElementById('input-observacao-estoque').value = item.Observacao;
                } else {
                    // Se não existe na localização selecionada, zera ou mantem limpo para criar novo
                    document.getElementById('input-quantidade').value = 0;
                    document.getElementById('input-qtd-minima').value = 0;
                    document.getElementById('input-observacao-estoque').value = '';
                }
            }
        });
    }
}

/**
 * Filtra os dados e chama a renderização da tabela
 */
function aplicarFiltrosERenderizar() {
    const filterLoc = document.getElementById('filter-localizacao-estoque').value;
    const filterStatus = document.getElementById('filter-status-estoque').value;
    const filterClasse = document.getElementById('filter-classe-estoque').value;
    const searchTerm = document.getElementById('search-produto-estoque').value.toLowerCase();

    // 1. Processamento dos dados (Geral ou Específico)
    let dadosProcessados = [];

    if (filterLoc === "") {
        // === MODO GERAL (Agrupado por Produto) ===
        const agrupado = {};

        estoqueProdutos.forEach(item => {
            const id = item.ProdutoID;
            if (!agrupado[id]) {
                agrupado[id] = {
                    ...item, 
                    QuantidadeAtual: 0,
                    QuantidadeMinima: 0, 
                    Localizacao: 'Geral', // Indica visão consolidada
                    StatusEstoque: 'Normal', 
                    IDsOriginais: [] 
                };
            }
            agrupado[id].QuantidadeAtual += parseFloat(item.QuantidadeAtual);
            agrupado[id].QuantidadeMinima += parseFloat(item.QuantidadeMinima);
            agrupado[id].IDsOriginais.push(item.ID);
        });

        dadosProcessados = Object.values(agrupado);
        
        // Recalcula Status no Geral (Aqui chamamos a função que estava faltando)
        dadosProcessados.forEach(p => {
            p.StatusEstoque = calcularStatus(p.QuantidadeAtual, p.QuantidadeMinima);
        });

    } else {
        // === MODO ESPECÍFICO (Filtrado por Local) ===
        dadosProcessados = estoqueProdutos.filter(item => item.Localizacao === filterLoc);
    }

    // 2. Aplica filtros de texto, classe e status
    dadosExibicao = dadosProcessados.filter(item => {
        const matchSearch = item.NomeItem.toLowerCase().includes(searchTerm);
        const matchClasse = filterClasse === "" || item.Classe === filterClasse;
        const matchStatus = filterStatus === "todos" || item.StatusEstoque === filterStatus;
        return matchSearch && matchClasse && matchStatus;
    });

    // Atualiza estatísticas e tabela
    atualizarCardsEstatisticas(dadosExibicao);
    renderTabelaPaginada();
}

/**
 * Renderiza a tabela considerando a página atual
 */
function renderTabelaPaginada() {
    const tbody = document.getElementById('tbody-estoque-produtos');
    if (!tbody) return;
    tbody.innerHTML = '';

    const totalItems = dadosExibicao.length;
    const totalPages = Math.ceil(totalItems / itemsPerPageProd) || 1;

    // Ajusta página se necessário
    if (currentPageProd > totalPages) currentPageProd = totalPages;
    if (currentPageProd < 1) currentPageProd = 1;

    // Atualiza controles visuais
    document.getElementById('current-page-prod').textContent = currentPageProd;
    document.getElementById('total-pages-prod').textContent = totalPages;
    document.getElementById('btn-prev-page-prod').disabled = currentPageProd === 1;
    document.getElementById('btn-next-page-prod').disabled = currentPageProd === totalPages;

    // Fatia os dados
    const start = (currentPageProd - 1) * itemsPerPageProd;
    const end = start + itemsPerPageProd;
    const itensPagina = dadosExibicao.slice(start, end);

    if (itensPagina.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">Nenhum produto encontrado.</td></tr>';
        return;
    }

    // Renderiza linhas
    itensPagina.forEach(p => {
        const tr = document.createElement('tr');
        const statusClass = getStatusClass(p.StatusEstoque);
        
        tr.innerHTML = `
            <td><strong>${p.NomeItem}</strong></td>
            <td>${p.Classe}</td>
            <td><span class="badge-local">${p.Localizacao}</span></td>
            <td>${p.UnidadeMedida}</td>
            <td class="text-center"><strong>${formatarNumero(p.QuantidadeAtual)}</strong></td>
            <td class="text-center">${formatarNumero(p.QuantidadeMinima)}</td>
            <td class="text-center"><span class="status-badge status-${statusClass}">${p.StatusEstoque}</span></td>
            <td class="text-center">
                <div class="table-actions" style="justify-content: center; gap: 8px;">
                    <button class="btn-icon" style="color: #27ae60;" onclick="abrirModalEntrada(${p.ProdutoID}, '${p.NomeItem}', '${p.Localizacao}')" title="Registrar Entrada">
                        <i class="fas fa-plus-circle fa-lg"></i>
                    </button>
                    
                    <button class="btn-icon" style="color: #e74c3c;" onclick="abrirModalSaida(${p.ProdutoID}, '${p.NomeItem}', '${p.Localizacao}')" title="Registrar Saída">
                        <i class="fas fa-minus-circle fa-lg"></i>
                    </button>
                    
                    <button class="btn-icon" style="color: #3498db;" onclick="abrirModalEditar(${p.ProdutoID}, '${p.Localizacao}')" title="Editar Cadastro">
                        <i class="fas fa-edit fa-lg"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function mudarPagina(delta) {
    const totalItems = dadosExibicao.length;
    const totalPages = Math.ceil(totalItems / itemsPerPageProd);
    
    const novaPagina = currentPageProd + delta;
    if (novaPagina >= 1 && novaPagina <= totalPages) {
        currentPageProd = novaPagina;
        renderTabelaPaginada();
    }
}

// === MODAIS ===

window.abrirModalEntrada = function(produtoId, nomeItem, localizacaoAtual) {
    abrirModalMovimentacaoGen(produtoId, nomeItem, localizacaoAtual, 'Entrada');
};

window.abrirModalSaida = function(produtoId, nomeItem, localizacaoAtual) {
    abrirModalMovimentacaoGen(produtoId, nomeItem, localizacaoAtual, 'Saída');
};

function abrirModalMovimentacaoGen(produtoId, nomeItem, localizacaoAtual, tipo) {
    document.getElementById('movimentacao-produto-id').value = produtoId;
    document.getElementById('movimentacao-tipo').value = tipo;
    
    const title = document.getElementById('modal-title-movimentacao');
    const btn = document.getElementById('btn-confirmar-movimentacao');
    
    title.textContent = `Registrar ${tipo}: ${nomeItem}`;
    title.style.color = tipo === 'Entrada' ? '#27ae60' : '#e74c3c';
    
    btn.textContent = `Confirmar ${tipo}`;
    btn.className = `btn ${tipo === 'Entrada' ? 'btn-success' : 'btn-danger'}`;

    document.getElementById('form-movimentacao').reset();
    document.getElementById('movimentacao-produto-id').value = produtoId; 
    document.getElementById('movimentacao-tipo').value = tipo;

    const locInput = document.getElementById('input-movimentacao-localizacao');
    if (localizacaoAtual !== 'Geral') {
        locInput.value = localizacaoAtual;
        atualizarSaldoNoModal(produtoId, localizacaoAtual);
    } else {
        locInput.value = "";
        document.getElementById('info-estoque-atual').textContent = "Selecione um local para ver o saldo.";
    }
    
    locInput.onchange = () => atualizarSaldoNoModal(produtoId, locInput.value);
    document.getElementById('modal-movimentacao').classList.add('is-active');
}

function atualizarSaldoNoModal(produtoId, loc) {
    if(loc) {
        // Comparação com ==
        const item = estoqueProdutos.find(p => p.ProdutoID == produtoId && p.Localizacao === loc);
        const saldo = item ? item.QuantidadeAtual : 0;
        document.getElementById('info-estoque-atual').textContent = `Saldo atual em ${loc}: ${formatarNumero(saldo)}`;
    }
}

window.abrirModalEditar = function(produtoId, localizacaoAtual) {
    // Comparação com ==
    let produto = estoqueProdutos.find(p => p.ProdutoID == produtoId && (localizacaoAtual === 'Geral' || p.Localizacao === localizacaoAtual));
    
    // Se não achou (ex: modo Geral ou erro de local), tenta pegar qualquer registro desse produto
    if (!produto) produto = estoqueProdutos.find(p => p.ProdutoID == produtoId);
    
    if (!produto) {
        console.error("Produto não encontrado para edição. ID:", produtoId);
        return;
    }

    document.getElementById('produto-id-hidden').value = produto.ProdutoID;
    document.getElementById('modal-title-estoque').textContent = `Editar: ${produto.NomeItem}`;
    document.getElementById('input-classe').value = produto.Classe;
    document.getElementById('input-quantidade').value = produto.QuantidadeAtual;
    document.getElementById('input-qtd-minima').value = produto.QuantidadeMinima;
    document.getElementById('input-observacao-estoque').value = produto.Observacao;
    
    const locInput = document.getElementById('input-localizacao');
    if (localizacaoAtual !== 'Geral') {
        locInput.value = localizacaoAtual;
    } else {
        locInput.value = ""; 
        // Se abriu do Geral, zera os campos específicos para obrigar a escolha
        document.getElementById('input-quantidade').value = "";
    }

    document.getElementById('modal-estoque-produto').classList.add('is-active');
};

async function salvarMovimentacao(e) {
    e.preventDefault();
    const tipo = document.getElementById('movimentacao-tipo').value;
    const qtd = parseFloat(document.getElementById('input-quantidade-movimentacao').value);
    const loc = document.getElementById('input-movimentacao-localizacao').value;

    if (!loc) return showNotification('Selecione a localização.', 'warning');
    if (!qtd || qtd <= 0) return showNotification('Quantidade inválida.', 'warning');

    const payload = {
        ProdutoID: document.getElementById('movimentacao-produto-id').value,
        Localizacao: loc,
        TipoMovimentacao: tipo,
        Quantidade: qtd,
        Motivo: document.getElementById('input-motivo').value,
        Observacao: document.getElementById('input-observacao-movimentacao').value,
        Usuario: window.getLoggedInUserFullName ? window.getLoggedInUserFullName() : 'Sistema'
    };

    try {
        const res = await fetch(`${API_BASE_URL}/estoque-produtos/movimentar`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Erro ao movimentar');
        }
        
        showNotification('Movimentação realizada!', 'success');
        fecharModais();
        await loadEstoqueProdutos();
        aplicarFiltrosERenderizar();
    } catch (err) {
        showNotification(err.message, 'error');
    }
}

async function salvarEstoque(e) {
    e.preventDefault();
    const payload = {
        ProdutoID: document.getElementById('produto-id-hidden').value,
        Classe: document.getElementById('input-classe').value,
        Quantidade: document.getElementById('input-quantidade').value,
        QuantidadeMinima: document.getElementById('input-qtd-minima').value,
        Localizacao: document.getElementById('input-localizacao').value,
        Observacao: document.getElementById('input-observacao-estoque').value,
        Usuario: window.getLoggedInUserFullName ? window.getLoggedInUserFullName() : 'Sistema'
    };

    if (!payload.Localizacao) return showNotification('Selecione uma localização.', 'warning');

    try {
        const res = await fetch(`${API_BASE_URL}/estoque-produtos`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Erro ao salvar');
        
        showNotification('Dados atualizados com sucesso!', 'success');
        fecharModais();
        await loadEstoqueProdutos();
        aplicarFiltrosERenderizar();
    } catch (err) {
        showNotification(err.message, 'error');
    }
}

// === UTILS ===

function fecharModais() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('is-active'));
}

function getStatusClass(status) {
    const map = { 'Zerado': 'danger', 'Crítico': 'danger', 'Baixo': 'warning', 'Normal': 'success', 'Excesso': 'info' };
    return map[status] || 'secondary';
}

function formatarNumero(num) { return parseFloat(num).toLocaleString('pt-BR'); }
function setText(id, txt) { const el = document.getElementById(id); if(el) el.textContent = txt; }
function showNotification(msg, type) { if(window.NotificationManager) window.NotificationManager.show({title: type, message: msg, type: type}); else alert(msg); }

// --- FUNÇÕES RECUPERADAS ---

function calcularStatus(qtd, min) {
    if (qtd <= 0) return 'Zerado';
    if (qtd <= min) return 'Crítico';
    if (qtd <= min * 1.2) return 'Baixo';
    return 'Normal';
}

function atualizarCardsEstatisticas(dados) {
    if (!dados) return;
    const total = dados.length;
    // Considera produto com estoque se quantidade > 0
    const comEstoque = dados.filter(p => p.QuantidadeAtual > 0).length;
    const criticos = dados.filter(p => p.StatusEstoque === 'Crítico' || p.StatusEstoque === 'Zerado').length;
    const baixos = dados.filter(p => p.StatusEstoque === 'Baixo').length;

    setText('stat-total-produtos', total);
    setText('stat-com-estoque', comEstoque);
    setText('stat-criticos', criticos);
    setText('stat-baixos', baixos);
}