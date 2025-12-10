/**
 * contasapagar.js - Gestão de Contas a Pagar
 * Versão Corrigida: IDs alinhados com HTML v1.1
 */

document.addEventListener('DOMContentLoaded', () => {
    initializeAppContas();
});

const API_URL = 'https://virtualcriacoes.com/sinergy/api';
let allContas = []; 
let currentUserID = null;
let currentEditID = null;
let contaParaExcluir = null;

async function initializeAppContas() {
    currentUserID = window.getLoggedInUserID ? window.getLoggedInUserID() : null;
    if (!currentUserID) return;
    
    setupEventListenersContas();
    await loadContas();

    const loader = document.getElementById('loader-overlay');
    if (loader) loader.style.display = 'none';
}

async function loadContas() {
    try {
        // Tenta buscar os dados
        const res = await fetch(`${API_URL}/contas-pagar`);
        
        // Se a resposta não for OK (ex: 404 ou 500)
        if (!res.ok) {
            const texto = await res.text();
            throw new Error(`Erro no Servidor (${res.status}): ${texto}`);
        }

        const dados = await res.json();
        
        // Verifica se o PHP devolveu um erro formatado em JSON
        if (dados.error) {
            throw new Error(`Erro da API: ${dados.error}`);
        }

        const tbody = document.getElementById('contasapagar-tbody');
        if (!tbody) return;
        
        // Se chegou aqui, os dados são válidos
        allContas = Array.isArray(dados) ? dados : [];
        
        console.log("Dados recebidos:", allContas); // Para você ver no F12
        renderTabela();
        
    } catch (error) {
        console.error("Erro fatal ao carregar:", error);
        // Mostra o erro na tela para você saber o que é
        const tbody = document.getElementById('contasapagar-tbody');
        if(tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="color:red; padding:20px;"><strong>Ocorreu um erro:</strong><br>${error.message}</td></tr>`;
    }
}

function setupEventListenersContas() {
    const btnNovo = document.getElementById('btn-novo-lancamento');
    if (btnNovo) btnNovo.addEventListener('click', () => abrirModal('create'));

    const btnClose = document.getElementById('close-modal');
    if (btnClose) btnClose.addEventListener('click', fecharModal);
    
    const btnCancel = document.getElementById('btn-cancelar');
    if (btnCancel) btnCancel.addEventListener('click', fecharModal);
    
    const form = document.getElementById('form-conta');
    if (form) form.addEventListener('submit', salvarConta);
    
    // Filtros
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.addEventListener('input', renderTabela);
    
    const filterStatus = document.getElementById('filter-status');
    if (filterStatus) filterStatus.addEventListener('change', renderTabela);

    const filterCat = document.getElementById('filter-categoria');
    if (filterCat) filterCat.addEventListener('change', renderTabela);
    
    // Exclusão
    const btnCloseExclusao = document.getElementById('close-exclusao-modal');
    if (btnCloseExclusao) btnCloseExclusao.addEventListener('click', fecharModalExclusao);
    
    const btnCancelExclusao = document.getElementById('btn-cancelar-exclusao');
    if (btnCancelExclusao) btnCancelExclusao.addEventListener('click', fecharModalExclusao);
    
    const btnConfirmExclusao = document.getElementById('btn-confirmar-exclusao');
    if (btnConfirmExclusao) btnConfirmExclusao.addEventListener('click', confirmarExclusaoAcao);
}

function renderTabela() {
    const tbody = document.getElementById('contasapagar-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const elSearch = document.getElementById('search-input');
    const term = elSearch ? String(elSearch.value || "").toLowerCase() : "";
    
    const elFilter = document.getElementById('filter-status');
    const statusFilter = elFilter ? elFilter.value : 'todos';

    const elCat = document.getElementById('filter-categoria');
    const catFilter = elCat ? elCat.value : 'todas';

    if (!allContas || allContas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Sem dados lançados.</td></tr>';
        return;
    }

    const filtered = allContas.filter(c => {
        try {
            if (!c) return false;
            
            // Blindagem de strings
            const desc = (c.Descricao + "").toLowerCase();
            const forn = (c.Fornecedor + "").toLowerCase();
            
            const matchSearch = desc.includes(term) || forn.includes(term);
            
            let matchStatus = true;
            if (statusFilter !== 'todos') {
                const venc = c.DataVencimento ? new Date(c.DataVencimento) : new Date();
                const hoje = new Date(); 
                hoje.setHours(0,0,0,0);
                
                if (statusFilter === 'Vencido') {
                    matchStatus = c.Status !== 'Pago' && venc < hoje;
                } else {
                    matchStatus = c.Status === statusFilter;
                }
            }

            let matchCat = true;
            if (catFilter !== 'todas') {
                matchCat = c.Categoria === catFilter;
            }

            return matchSearch && matchStatus && matchCat;
        } catch (e) { return false; }
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Nenhum registro encontrado.</td></tr>';
        return;
    }

    filtered.forEach(c => {
        try {
            let statusClass = 'pendente';
            let statusLabel = c.Status || 'Pendente';
            
            const venc = c.DataVencimento ? new Date(c.DataVencimento) : new Date();
            const hoje = new Date(); 
            hoje.setHours(0,0,0,0);

            if (c.Status === 'Pago') {
                statusClass = 'pago';
            } else if (venc < hoje) {
                statusClass = 'vencido';
                statusLabel = 'Vencido';
            }

            // Escapa aspas para não quebrar o HTML do onclick
            const descSafe = (c.Descricao || '').replace(/'/g, ""); 

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${c.Descricao || ''}</td>
                <td>${c.Fornecedor || '-'}</td>
                <td>${c.Categoria || '-'}</td>
                <td>${formatarData(c.DataVencimento)}</td>
                <td><strong>${formatarMoeda(c.Valor)}</strong></td>
                <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
                <td class="text-center">
                    <div class="table-actions">
                        ${c.Status !== 'Pago' ? 
                            `<button class="action-button pay" onclick="window.marcarComoPago(${c.ID})" title="Pagar"><i class="fas fa-check"></i></button>` : 
                            `<button class="action-button undo" onclick="window.estornarPagamento(${c.ID})" title="Estornar"><i class="fas fa-undo"></i></button>`
                        }
                        <button class="action-button edit" onclick="window.abrirModal('edit', ${c.ID})"><i class="fas fa-edit"></i></button>
                        <button class="action-button delete" onclick="window.abrirModalExclusao(${c.ID}, '${descSafe}')" ${c.Status === 'Pago' ? 'disabled style="opacity:0.3"' : ''}><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        } catch (e) { console.error(e); }
    });
    
    atualizarStats(allContas); // Atualiza estatísticas (se existirem cards)
}

function abrirModal(mode, id = null) {
    const modal = document.getElementById('modal-conta');
    document.getElementById('form-conta').reset();
    currentEditID = id;
    
    if (mode === 'edit' && id) {
        const c = allContas.find(x => x.ID == id);
        if (c) {
            document.getElementById('modal-title').textContent = 'Editar Conta';
            document.getElementById('input-descricao').value = c.Descricao || '';
            document.getElementById('input-fornecedor').value = c.Fornecedor || '';
            document.getElementById('input-categoria').value = c.Categoria || '';
            document.getElementById('input-valor').value = parseFloat(c.Valor || 0).toFixed(2);
            document.getElementById('input-vencimento').value = c.DataVencimento || '';
            document.getElementById('input-observacoes').value = c.Observacoes || '';
            
            const elPgto = document.getElementById('input-tipo-pgto');
            if(elPgto) elPgto.value = c.TipoPagamento || 'À Vista';
            
            const elForma = document.getElementById('input-forma-pgto');
            if(elForma) elForma.value = c.FormaPagamento || 'Pix';
        }
    } else {
        document.getElementById('modal-title').textContent = 'Nova Conta a Pagar';
        document.getElementById('input-vencimento').valueAsDate = new Date();
    }
    modal.classList.add('active');
}

function fecharModal() { 
    document.getElementById('modal-conta').classList.remove('active'); 
}

async function salvarConta(e) {
    e.preventDefault();
    
    const payload = {
        UsuarioID: currentUserID,
        Descricao: document.getElementById('input-descricao').value,
        Fornecedor: document.getElementById('input-fornecedor').value,
        Categoria: document.getElementById('input-categoria').value,
        Valor: document.getElementById('input-valor').value,
        DataVencimento: document.getElementById('input-vencimento').value,
        Observacoes: document.getElementById('input-observacoes').value,
        TipoPagamento: document.getElementById('input-tipo-pgto')?.value || 'À Vista',
        FormaPagamento: document.getElementById('input-forma-pgto')?.value || 'Pix',
        Status: 'Pendente'
    };

    let url = `${API_URL}/contas-pagar`;
    let method = 'POST';
    
    // Se for edição, ajusta URL e Método
    if (currentEditID) { 
        url += `/${currentEditID}`; 
        method = 'PUT'; 
    }

    try {
        const res = await fetch(url, { 
            method, 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify(payload) 
        });
        
        if(res.ok) {
            showNotification('Salvo com sucesso!', 'success');
            fecharModal();
            loadContas();
        } else {
            throw new Error('Erro ao salvar');
        }
    } catch(e) { 
        showNotification(e.message, 'error'); 
    }
}

async function marcarComoPago(id) {
    if(!confirm('Confirmar pagamento desta conta?')) return;
    try {
        await fetch(`${API_URL}/contas-pagar/${id}`, {
            method: 'PUT', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ marcarComoPago: true })
        });
        showNotification('Conta paga!', 'success');
        document.getElementById('filter-status').value = 'todos'; // Reseta filtro para ver
        loadContas();
    } catch(e) { showNotification('Erro', 'error'); }
}

async function estornarPagamento(id) {
    if(!confirm('Deseja estornar este pagamento? Ele voltará a ser Pendente.')) return;
    try {
        await fetch(`${API_URL}/contas-pagar/${id}`, {
            method: 'PUT', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ marcarComoPendente: true })
        });
        showNotification('Estorno realizado.', 'info');
        document.getElementById('filter-status').value = 'todos';
        loadContas();
    } catch(e) { showNotification('Erro', 'error'); }
}

function abrirModalExclusao(id, nome) {
    contaParaExcluir = id;
    const elMsg = document.getElementById('exclusao-orcamento-numero');
    if(elMsg) elMsg.textContent = nome;
    document.getElementById('modal-confirmar-exclusao').classList.add('active');
}

function fecharModalExclusao() { 
    document.getElementById('modal-confirmar-exclusao').classList.remove('active'); 
}

async function confirmarExclusaoAcao() {
    if(!contaParaExcluir) return;
    try {
        const res = await fetch(`${API_URL}/contas-pagar/${contaParaExcluir}`, { method: 'DELETE' });
        if(res.ok) { 
            showNotification('Excluído!', 'success'); 
            fecharModalExclusao(); 
            loadContas(); 
        } else { 
            const e = await res.json(); 
            showNotification(e.error, 'error'); 
        }
    } catch(e) { showNotification('Erro', 'error'); }
}

// Stats Placeholder (Caso adicione os cards no futuro)
function atualizarStats(dados) {
    if(!dados) return;
    const total = dados.reduce((acc, c) => acc + parseFloat(c.Valor || 0), 0);
    const pendentes = dados.filter(c => c.Status !== 'Pago').length;
    
    const elTotal = document.getElementById('stat-total');
    if(elTotal) elTotal.textContent = formatarMoeda(total);
    
    const elPend = document.getElementById('stat-pendentes');
    if(elPend) elPend.textContent = pendentes;
}


// Utils
function formatarMoeda(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0); }
function formatarData(d) { if(!d) return '-'; return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR'); }
function showNotification(msg, type) { if(window.NotificationManager) window.NotificationManager.show({title:type, message:msg, type:type}); else alert(msg); }

// Global Exports
window.abrirModal = abrirModal;
window.marcarComoPago = marcarComoPago;
window.estornarPagamento = estornarPagamento;
window.abrirModalExclusao = abrirModalExclusao;