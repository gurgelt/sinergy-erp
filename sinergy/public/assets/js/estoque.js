/**
 * estoque.js - Funcionalidades para a aba "Estoque de Bobinas"
 * VERSÃO BLINDADA: Previne erros se elementos do HTML estiverem faltando
 */

document.addEventListener('DOMContentLoaded', function() {
    // Verifica se o usuário está logado antes de iniciar
    if (typeof window.getLoggedInUserID === 'function' && !window.getLoggedInUserID()) {
        return; 
    }
    
    initBobinaPage();
    setupBobinaListeners();
    loadBobinaData();
});

let bobinaDatabase = []; 
let currentPage = 1;
const itemsPerPage = 10;
let filteredData = [];
let currentEditId = null;
let currentSortOrder = 'desc';

/**
 * Inicializa elementos básicos
 */
function initBobinaPage() {
    const dataInput = document.getElementById('data-recebimento');
    if (dataInput) dataInput.valueAsDate = new Date();
    
    // Inicializa modais (fechar ao clicar fora/botão x)
    document.querySelectorAll('.close-modal, .cancel-modal').forEach(function(button) {
        button.addEventListener('click', function() {
            document.querySelectorAll('.modal').forEach(m => m.classList.remove('is-active'));
        });
    });
}

/**
 * Configura os listeners (Botões e Filtros)
 */
function setupBobinaListeners() {
    // Botão Nova Bobina
    const btnNova = document.getElementById('btn-nova-bobina');
    if (btnNova) {
        btnNova.addEventListener('click', function() {
            openBobinaModal('Nova Bobina');
        });
    }

    // Formulário Salvar
    const form = document.getElementById('form-bobina');
    if (form) form.addEventListener('submit', handleBobinaFormSubmit);

    // Botão Exportar
    const btnExport = document.getElementById('btn-exportar-estoque');
    if (btnExport) btnExport.addEventListener('click', exportBobinasToCSV);

    // Filtros - Adicionamos verificação para não quebrar se o filtro não existir no HTML
    const filtrosIds = ['filter-tipo', 'filter-espessura', 'filter-largura', 'filter-mes', 'filter-natureza-operacao', 'filter-tipo-movimentacao'];
    filtrosIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', applyBobinaFilters);
    });

    // Busca
    const searchInput = document.getElementById('search-bobina');
    if (searchInput) {
        searchInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') applyBobinaFilters(); });
        searchInput.addEventListener('input', applyBobinaFilters);
    }

    // Paginação
    document.getElementById('prev-page')?.addEventListener('click', () => changeBobinaPage(-1));
    document.getElementById('next-page')?.addEventListener('click', () => changeBobinaPage(1));

    // Ordenação
    document.getElementById('btn-sort-date')?.addEventListener('click', toggleBobinaSortOrder);

    // Botão Confirmar Exclusão
    document.getElementById('btn-confirma-exclusao')?.addEventListener('click', confirmDeleteBobina);

    // Ações do Modal de Detalhes (Editar/Excluir a partir dele)
    document.getElementById('btn-editar-detalhe')?.addEventListener('click', () => {
        document.getElementById('modal-detalhes').classList.remove('is-active');
        if (currentEditId) editBobina(currentEditId);
    });

    document.getElementById('btn-excluir-detalhe')?.addEventListener('click', () => {
        document.getElementById('modal-detalhes').classList.remove('is-active');
        const bobina = bobinaDatabase.find(b => b.ID === currentEditId);
        if (bobina) openDeleteBobinaConfirmation(currentEditId, bobina.Lote);
    });
}

/**
 * Carrega dados da API
 */
async function loadBobinaData() {
    try {
        const response = await fetch('https://virtualcriacoes.com/sinergy/api/bobinas');
        if (!response.ok) throw new Error('Falha ao carregar bobinas');
        
        const data = await response.json();
        
        // Converte tipos numéricos
        bobinaDatabase = data.map(item => ({
            ...item,
            ID: parseInt(item.ID),
            Peso: parseFloat(item.Peso),
            Espessura: parseFloat(item.Espessura),
            Largura: parseFloat(item.Largura)
        }));

        applyBobinaFilters();
        updateBobinaSummary();

    } catch (error) {
        console.error('Erro ao carregar bobinas:', error);
        const tbody = document.querySelector('#tabela-bobinas tbody');
        if(tbody) tbody.innerHTML = `<tr><td colspan="12" class="text-center" style="color:red;">Erro: ${error.message}</td></tr>`;
    }
}

/**
 * Aplica filtros e renderiza tabela (Com correção de segurança ?.)
 */
function applyBobinaFilters() {
    // CORREÇÃO: Usa o operador ?. para não quebrar se o elemento não existir no HTML
    const tipo = document.getElementById('filter-tipo')?.value;
    const espessura = document.getElementById('filter-espessura')?.value;
    const largura = document.getElementById('filter-largura')?.value; // Esse era o culpado provável
    const mes = document.getElementById('filter-mes')?.value;
    const natureza = document.getElementById('filter-natureza-operacao')?.value;
    const mov = document.getElementById('filter-tipo-movimentacao')?.value;
    
    const searchInput = document.getElementById('search-bobina');
    const search = searchInput ? searchInput.value.toLowerCase() : '';

    filteredData = bobinaDatabase.filter(b => {
        if (tipo && b.Tipo !== tipo) return false;
        if (espessura && b.Espessura.toFixed(2) !== parseFloat(espessura).toFixed(2)) return false;
        if (largura && b.Largura.toFixed(2) !== parseFloat(largura).toFixed(2)) return false;
        if (natureza && b.NaturezaOperacao !== natureza) return false;
        if (mov && b.TipoMovimentacao !== mov) return false;

        if (mes) {
            const m = new Date(b.DataRecebimento).getMonth() + 1;
            if (String(m).padStart(2, '0') !== mes) return false;
        }

        if (search) {
            return (b.Lote.toLowerCase().includes(search) || b.Fornecedor.toLowerCase().includes(search));
        }

        return true;
    });

    // Ordenação
    filteredData.sort((a, b) => {
        return currentSortOrder === 'desc' ? b.ID - a.ID : a.ID - b.ID;
    });

    currentPage = 1;
    renderBobinasTable();
    updateBobinaPagination();
}

function renderBobinasTable() {
    const tbody = document.querySelector('#tabela-bobinas tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="12" class="empty-state"><i class="fas fa-box-open"></i><p>Nenhuma bobina encontrada.</p></td></tr>`;
        return;
    }

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageData = filteredData.slice(start, end);

    pageData.forEach(b => {
        const dataFormatada = b.DataRecebimento ? b.DataRecebimento.split('-').reverse().join('/') : '-';
        const statusClass = b.Status === 'Disponível' ? 'status-disponivel' : 'status-indisponivel';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="view-trigger" onclick="viewBobinaDetails(${b.ID})" style="cursor:pointer">${dataFormatada}</td>
            <td class="view-trigger" onclick="viewBobinaDetails(${b.ID})" style="cursor:pointer">${b.Fornecedor}</td>
            <td class="view-trigger" onclick="viewBobinaDetails(${b.ID})" style="cursor:pointer">${b.NotaFiscal}</td>
            <td class="view-trigger" onclick="viewBobinaDetails(${b.ID})" style="cursor:pointer">${b.Tipo}</td>
            <td class="view-trigger" onclick="viewBobinaDetails(${b.ID})" style="cursor:pointer">${b.Lote}</td>
            <td>${b.Espessura} mm</td>
            <td>${b.Largura} mm</td>
            <td><strong>${b.Peso.toFixed(2)}</strong></td>
            <td>${b.NaturezaOperacao || '-'}</td>
            <td>${b.TipoMovimentacao || '-'}</td>
            <td><span class="status-badge ${statusClass}">${b.Status}</span></td>
            <td class="table-actions">
                <button class="action-button view" onclick="viewBobinaDetails(${b.ID})" title="Ver"><i class="fas fa-eye"></i></button>
                <button class="action-button edit" onclick="editBobina(${b.ID})" title="Editar"><i class="fas fa-edit"></i></button>
                <button class="action-button delete" onclick="openDeleteBobinaConfirmation(${b.ID}, '${b.Lote}')" title="Excluir"><i class="fas fa-trash-alt"></i></button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function updateBobinaPagination() {
    const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
    const pageEl = document.querySelector('.page-numbers .current-page');
    const totalEl = document.getElementById('total-pages');
    
    if(pageEl) pageEl.textContent = currentPage;
    if(totalEl) totalEl.textContent = totalPages;
    
    const prev = document.getElementById('prev-page');
    const next = document.getElementById('next-page');
    
    if(prev) prev.disabled = currentPage <= 1;
    if(next) next.disabled = currentPage >= totalPages;
}

function changeBobinaPage(dir) {
    const total = Math.ceil(filteredData.length / itemsPerPage);
    const nova = currentPage + dir;
    if (nova > 0 && nova <= total) {
        currentPage = nova;
        renderBobinasTable();
        updateBobinaPagination();
    }
}

function toggleBobinaSortOrder() {
    currentSortOrder = currentSortOrder === 'desc' ? 'asc' : 'desc';
    const btn = document.getElementById('btn-sort-date');
    if(btn) btn.innerHTML = currentSortOrder === 'desc' ? '<i class="fas fa-calendar-alt"></i> Mais Recentes' : '<i class="fas fa-calendar-alt"></i> Mais Antigos';
    applyBobinaFilters();
}

function updateBobinaSummary() {
    const totalPeso = bobinaDatabase.reduce((sum, b) => sum + b.Peso, 0);
    const totalQtd = bobinaDatabase.filter(b => b.Peso > 0).length;
    
    const pTotal = document.getElementById('peso-total');
    const tBobinas = document.getElementById('total-bobinas');
    
    if(pTotal) pTotal.textContent = `${totalPeso.toFixed(2)} kg`;
    if(tBobinas) tBobinas.textContent = totalQtd;
}

// === OPERAÇÕES (CRUD) ===

function openBobinaModal(title) {
    if (title === 'Nova Bobina') {
        document.getElementById('form-bobina').reset();
        document.getElementById('bobina-id').value = '';
        currentEditId = null;
        const dr = document.getElementById('data-recebimento');
        if(dr) dr.valueAsDate = new Date();
    }
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-bobina').classList.add('is-active');
}

window.viewBobinaDetails = function(id) {
    const b = bobinaDatabase.find(i => i.ID === id);
    if (!b) return;
    currentEditId = id;

    const setText = (id, val) => {
        const el = document.getElementById(id);
        if(el) el.textContent = val;
    };

    setText('detalhe-lote', b.Lote);
    setText('detalhe-tipo', b.Tipo);
    setText('detalhe-espessura', b.Espessura + ' mm');
    setText('detalhe-largura', b.Largura + ' mm');
    setText('detalhe-peso', b.Peso.toFixed(2) + ' kg');
    setText('detalhe-fornecedor', b.Fornecedor);
    setText('detalhe-nota-fiscal', b.NotaFiscal);
    setText('detalhe-natureza', b.NaturezaOperacao);
    setText('detalhe-tipo-movimentacao', b.TipoMovimentacao);
    setText('detalhe-observacao', b.Observacao || 'Nenhuma');

    const badge = document.getElementById('detalhe-status');
    if(badge) {
        badge.textContent = b.Status;
        badge.className = `status-badge ${b.Status === 'Disponível' ? 'status-disponivel' : 'status-indisponivel'}`;
    }

    document.getElementById('modal-detalhes').classList.add('is-active');
};

window.editBobina = function(id) {
    const b = bobinaDatabase.find(i => i.ID === id);
    if (!b) return;

    document.getElementById('bobina-id').value = b.ID;
    document.getElementById('tipo-material').value = b.Tipo;
    document.getElementById('espessura-chapa').value = b.Espessura.toFixed(2);
    
    let larg = String(b.Largura);
    if (larg.endsWith('.0') || larg.endsWith('.00')) larg = parseInt(b.Largura);
    document.getElementById('largura-chapa').value = larg;

    document.getElementById('fornecedor').value = b.Fornecedor;
    document.getElementById('nota-fiscal').value = b.NotaFiscal;
    
    // Verifica se data existe
    if(b.DataRecebimento) {
        document.getElementById('data-recebimento').value = b.DataRecebimento.split(' ')[0];
    }
    
    document.getElementById('lote').value = b.Lote;
    document.getElementById('peso-bobina').value = b.Peso;
    document.getElementById('natureza-operacao').value = b.NaturezaOperacao || 'Entrada';
    document.getElementById('tipo-movimentacao').value = b.TipoMovimentacao || 'Compra';
    document.getElementById('observacao').value = b.Observacao || '';

    currentEditId = id;
    openBobinaModal('Editar Bobina');
};

window.openDeleteBobinaConfirmation = function(id, lote) {
    currentEditId = id;
    document.getElementById('lote-exclusao').textContent = lote;
    document.getElementById('modal-confirma-exclusao').classList.add('is-active');
};

async function handleBobinaFormSubmit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

    const id = document.getElementById('bobina-id').value;
    const isNew = !id;
    
    const payload = {
        tipo: document.getElementById('tipo-material').value,
        espessura: document.getElementById('espessura-chapa').value,
        largura: document.getElementById('largura-chapa').value,
        fornecedor: document.getElementById('fornecedor').value,
        notaFiscal: document.getElementById('nota-fiscal').value,
        dataRecebimento: document.getElementById('data-recebimento').value,
        lote: document.getElementById('lote').value,
        peso: document.getElementById('peso-bobina').value,
        naturezaOperacao: document.getElementById('natureza-operacao').value,
        tipoMovimentacao: document.getElementById('tipo-movimentacao').value,
        observacao: document.getElementById('observacao').value,
        usuario: window.getLoggedInUser() || 'Sistema'
    };

    const method = id ? 'PUT' : 'POST';
    const url = id ? `https://virtualcriacoes.com/sinergy/api/bobinas/${id}` : 'https://virtualcriacoes.com/sinergy/api/bobinas';

    try {
        const res = await fetch(url, {
            method: method,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error('Erro ao salvar');
        
        showNotification('Salvo com sucesso!', 'success');
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('is-active'));
        
        // Log de movimentação automático
        if (isNew) {
            await logBobinaMovimentacao('entrada', payload);
        } else {
            await logBobinaMovimentacao('ajuste', payload, 'Atualização de Bobina');
        }

        await loadBobinaData();
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Salvar'; }
    }
}

async function confirmDeleteBobina() {
    if (!currentEditId) return;
    const btn = document.getElementById('btn-confirma-exclusao');
    if(btn) { btn.disabled = true; btn.textContent = 'Excluindo...'; }

    try {
        const bobina = bobinaDatabase.find(b => b.ID === currentEditId);
        const res = await fetch(`https://virtualcriacoes.com/sinergy/api/bobinas/${currentEditId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Erro ao excluir');
        
        showNotification('Bobina excluída!', 'success');
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('is-active'));
        
        if (bobina) await logBobinaMovimentacao('saida', bobina, 'Exclusão de Bobina');
        
        await loadBobinaData();
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        if(btn) { btn.disabled = false; btn.textContent = 'Excluir'; }
        currentEditId = null;
    }
}

async function logBobinaMovimentacao(tipo, dados, desc = null) {
    try {
        await fetch('https://virtualcriacoes.com/sinergy/api/movimentacoes', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                timestamp: new Date().toISOString(),
                tipo: tipo,
                descricao: desc || dados.tipo,
                lote: dados.lote || dados.Lote,
                pesoKg: Number(dados.peso || dados.Peso),
                origemDestino: dados.fornecedor || dados.Fornecedor,
                observacao: dados.observacao || dados.Observacao,
                naturezaOperacao: dados.naturezaOperacao || dados.NaturezaOperacao,
                tipoMovimentacao: dados.tipoMovimentacao || dados.TipoMovimentacao,
                usuario: window.getLoggedInUser() || 'Sistema'
            })
        });
    } catch (e) { console.warn('Falha no log', e); }
}

function exportBobinasToCSV() {
    let csv = "Data;Fornecedor;NF;Tipo;Lote;Espessura;Largura;Peso;Status\n";
    filteredData.forEach(b => {
        csv += `${b.DataRecebimento};${b.Fornecedor};${b.NotaFiscal};${b.Tipo};${b.Lote};${b.Espessura};${b.Largura};${b.Peso.toString().replace('.', ',')};${b.Status}\n`;
    });
    const link = document.createElement("a");
    link.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    link.download = "estoque_bobinas.csv";
    link.click();
}

function showNotification(msg, type) {
    if (window.NotificationManager) {
        window.NotificationManager.show({ title: type === 'error' ? 'Erro' : 'Sucesso', message: msg, type: type });
    } else {
        alert(msg);
    }
}