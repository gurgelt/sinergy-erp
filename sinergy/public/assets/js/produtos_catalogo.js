/**
 * js/produtos_catalogo.js - Gestão do Catálogo de Produtos
 */

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

const API_URL = 'https://virtualcriacoes.com/sinergy/api';
let allProdutos = [];
let filteredProdutos = [];
let currentPage = 1;
const itemsPerPage = 15;
let currentEditID = null;
let produtoParaExcluir = null;

async function initializeApp() {
    const userId = window.getLoggedInUserID();
    if (!userId) return; // App.js redireciona

    setupEventListeners();
    await loadProdutos();
    
    const loader = document.getElementById('loader-overlay');
    if (loader) loader.style.display = 'none';
}

async function loadProdutos() {
    try {
        const res = await fetch(`${API_URL}/produtos`);
        if (!res.ok) throw new Error('Erro ao carregar produtos');
        allProdutos = await res.json();
        renderTabela(true);
    } catch (e) {
        showNotification(e.message, 'error');
    }
}

function setupEventListeners() {
    // Busca
    document.getElementById('search-input').addEventListener('input', () => {
        currentPage = 1;
        renderTabela(true);
    });

    // Paginação
    document.getElementById('btn-prev-page').addEventListener('click', () => {
        if (currentPage > 1) { currentPage--; renderTabela(false); }
    });
    document.getElementById('btn-next-page').addEventListener('click', () => {
        const maxPages = Math.ceil(filteredProdutos.length / itemsPerPage);
        if (currentPage < maxPages) { currentPage++; renderTabela(false); }
    });

    // Modais
    document.getElementById('btn-novo-produto').addEventListener('click', () => abrirModal('create'));
    document.getElementById('close-modal').addEventListener('click', fecharModal);
    document.getElementById('btn-cancelar').addEventListener('click', fecharModal);
    document.getElementById('form-produto').addEventListener('submit', salvarProduto);
    
    document.getElementById('close-exclusao').addEventListener('click', fecharModalExclusao);
    document.getElementById('btn-cancelar-exclusao').addEventListener('click', fecharModalExclusao);
    document.getElementById('btn-confirmar-exclusao').addEventListener('click', confirmarExclusao);
}

function renderTabela(reFilter = true) {
    const tbody = document.getElementById('produtos-tbody');
    
    if (reFilter) {
        const term = document.getElementById('search-input').value.toLowerCase();
        filteredProdutos = allProdutos.filter(p => p.NomeItem.toLowerCase().includes(term));
    }

    // Paginação
    const totalItems = filteredProdutos.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const itemsToShow = filteredProdutos.slice(start, end);

    document.getElementById('page-info').textContent = `Página ${currentPage} de ${totalPages}`;
    document.getElementById('btn-prev-page').disabled = currentPage === 1;
    document.getElementById('btn-next-page').disabled = currentPage === totalPages;

    tbody.innerHTML = '';
    if (itemsToShow.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum produto encontrado.</td></tr>';
        return;
    }

    itemsToShow.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${p.NomeItem}</td>
            <td>${p.UnidadeMedida}</td>
            <td>${formatarMoeda(p.PrecoSerralheria)}</td>
            <td>${formatarMoeda(p.PrecoConsumidor)}</td>
            <td class="text-center">
                <div class="table-actions">
                    <button class="action-button edit" onclick="editarProduto(${p.ID})" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="action-button delete" onclick="abrirModalExclusao(${p.ID}, '${p.NomeItem}')" title="Excluir"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function abrirModal(mode, produto = null) {
    document.getElementById('form-produto').reset();
    currentEditID = null;
    
    const title = document.getElementById('modal-title');
    const btn = document.getElementById('btn-salvar');
    
    if (mode === 'edit' && produto) {
        currentEditID = produto.ID;
        title.textContent = 'Editar Produto';
        btn.textContent = 'Salvar Alterações';
        
        document.getElementById('input-nome').value = produto.NomeItem;
        document.getElementById('input-unidade').value = produto.UnidadeMedida;
        document.getElementById('input-preco-serralheria').value = parseFloat(produto.PrecoSerralheria).toFixed(2);
        document.getElementById('input-preco-consumidor').value = parseFloat(produto.PrecoConsumidor).toFixed(2);
    } else {
        title.textContent = 'Novo Produto';
        btn.textContent = 'Salvar Produto';
    }
    
    document.getElementById('modal-produto').classList.add('active');
}

function fecharModal() {
    document.getElementById('modal-produto').classList.remove('active');
}

function editarProduto(id) {
    const p = allProdutos.find(x => x.ID === id);
    if (p) abrirModal('edit', p);
}

async function salvarProduto(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-salvar');
    btn.disabled = true; btn.textContent = 'Salvando...';

    const payload = {
        NomeItem: document.getElementById('input-nome').value,
        UnidadeMedida: document.getElementById('input-unidade').value,
        PrecoSerralheria: parseFloat(document.getElementById('input-preco-serralheria').value) || 0,
        PrecoConsumidor: parseFloat(document.getElementById('input-preco-consumidor').value) || 0
    };

    try {
        let url = `${API_URL}/produtos`;
        let method = 'POST';
        if (currentEditID) {
            url += `/${currentEditID}`;
            method = 'PUT';
        }

        const res = await fetch(url, {
            method: method,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error('Erro ao salvar');
        
        showNotification('Produto salvo com sucesso!', 'success');
        fecharModal();
        await loadProdutos();
    } catch (err) {
        showNotification(err.message, 'error');
    } finally {
        btn.disabled = false;
    }
}

function abrirModalExclusao(id, nome) {
    produtoParaExcluir = id;
    document.getElementById('nome-exclusao').textContent = nome;
    document.getElementById('modal-exclusao').classList.add('active');
}

function fecharModalExclusao() {
    document.getElementById('modal-exclusao').classList.remove('active');
    produtoParaExcluir = null;
}

async function confirmarExclusao() {
    if (!produtoParaExcluir) return;
    
    try {
        const res = await fetch(`${API_URL}/produtos/${produtoParaExcluir}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Erro ao excluir');
        
        showNotification('Produto excluído!', 'success');
        fecharModalExclusao();
        await loadProdutos();
    } catch (err) {
        showNotification(err.message, 'error');
    }
}

// UTILS
function formatarMoeda(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v); }
function showNotification(msg, type) { if(window.NotificationManager) window.NotificationManager.show({ title: type, message: msg, type: type }); else alert(msg); }

// Exporta para o HTML
window.editarProduto = editarProduto;
window.abrirModalExclusao = abrirModalExclusao;