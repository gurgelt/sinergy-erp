/**
 * contasareceber.js - Gestão de Contas a Receber
 * Versão Final Completa - Blindada contra Nulos e Filtros
 */

document.addEventListener('DOMContentLoaded', () => {
    initializeAppContasReceber();
});

const API_URL = 'https://virtualcriacoes.com/sinergy/api';
let allContas = []; 
let currentUserID = null;

async function initializeAppContasReceber() {
    currentUserID = window.getLoggedInUserID ? window.getLoggedInUserID() : null;
    if (!currentUserID) return;
    
    setupEventListenersContasReceber();
    await loadContasReceber();

    const loader = document.getElementById('loader-overlay');
    if (loader) loader.style.display = 'none';
}

async function loadContasReceber() {
    try {
        const response = await fetch(`${API_URL}/contasareceber`);
        if (!response.ok) throw new Error('Falha ao carregar contas a receber');
        allContas = await response.json();
        
        if (!Array.isArray(allContas)) allContas = [];
        
        renderTabela();
        atualizarEstatisticas();
    } catch (error) {
        console.error(error);
        showNotification(error.message, 'error');
    }
}

function setupEventListenersContasReceber() {
    const searchInput = document.getElementById('search-input-main');
    if(searchInput) searchInput.addEventListener('input', renderTabela);
    
    const filterStatus = document.getElementById('filter-status');
    if(filterStatus) filterStatus.addEventListener('change', renderTabela);
    
    const btnClose = document.getElementById('close-modal-receber');
    if(btnClose) btnClose.addEventListener('click', fecharModalReceber);
    
    const btnCancel = document.getElementById('btn-cancelar-receber');
    if(btnCancel) btnCancel.addEventListener('click', fecharModalReceber);
    
    const form = document.getElementById('form-editar-receber');
    if(form) form.addEventListener('submit', salvarContaReceber);
}

function renderTabela() {
    const tbody = document.getElementById('tabela-receber-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const elSearch = document.getElementById('search-input-main');
    const term = elSearch ? String(elSearch.value || "").toLowerCase() : "";
    
    const elFilter = document.getElementById('filter-status');
    const statusFilter = elFilter ? elFilter.value : 'todos';

    if (!allContas || allContas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Nenhum registro.</td></tr>';
        return;
    }

    const filtered = allContas.filter(c => {
        try {
            if (!c) return false;
            
            // BLINDAGEM CRÍTICA: Converte para string antes de toLowerCase
            const cliente = (c.ClienteNome + "").toLowerCase();
            const pedido = (c.NumeroPedido + "").toLowerCase();
            
            const matchSearch = cliente.includes(term) || pedido.includes(term);
            
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
            return matchSearch && matchStatus;
        } catch (e) {
            return false; 
        }
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Nenhum registro encontrado.</td></tr>';
        return;
    }

    filtered.forEach(c => {
        try {
            let statusClass = 'aguardando';
            let statusLabel = c.Status || 'Aguardando';
            
            const venc = c.DataVencimento ? new Date(c.DataVencimento) : new Date();
            const hoje = new Date(); 
            hoje.setHours(0,0,0,0);

            if (c.Status === 'Pago') {
                statusClass = 'pago';
            } else if (venc < hoje) {
                statusClass = 'vencido';
                statusLabel = 'Vencido';
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${c.ClienteNome || '-'}</td>
                <td>${c.NumeroPedido || '-'}</td>
                <td>${formatarData(c.DataVencimento)}</td>
                <td><strong>${formatarMoeda(c.Valor)}</strong></td>
                <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
                <td>${c.FormaPagamento || '-'}</td>
                <td class="text-center">
                    <div class="table-actions">
                        ${c.Status !== 'Pago' ? 
                            `<button class="action-button pay" onclick="window.marcarRecebido(${c.ID})" title="Marcar como Recebido"><i class="fas fa-check"></i></button>` : 
                            `<button class="action-button undo" onclick="window.estornarRecebimento(${c.ID})" title="Estornar"><i class="fas fa-undo"></i></button>`
                        }
                        <button class="action-button edit" onclick="window.abrirModalEditarReceber(${c.ID})"><i class="fas fa-edit"></i></button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        } catch (e) {}
    });
    
    atualizarEstatisticas();
}

function atualizarEstatisticas() {
    if (!allContas) return;

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0); // Zera hora para comparar apenas datas

    // 1. Cálculo: Total a Receber (Pendente + Atrasado)
    const totalPendente = allContas
        .filter(c => c.Status !== 'Pago' && c.Status !== 'Recebido')
        .reduce((acc, c) => acc + parseFloat(c.Valor || 0), 0);

    // 2. Cálculo: Total Vencido (Não pago E data menor que hoje)
    const totalVencido = allContas
        .filter(c => {
            const statusOk = c.Status !== 'Pago' && c.Status !== 'Recebido';
            if (!statusOk) return false;
            
            // Verifica data
            const venc = c.DataVencimento ? new Date(c.DataVencimento + 'T00:00:00') : null;
            return venc && venc < hoje;
        })
        .reduce((acc, c) => acc + parseFloat(c.Valor || 0), 0);

    // 3. Cálculo: Total Recebido (Pago)
    const totalRecebido = allContas
        .filter(c => c.Status === 'Pago' || c.Status === 'Recebido')
        .reduce((acc, c) => acc + parseFloat(c.Valor || 0), 0);

    // Atualiza o HTML (Usando os IDs corretos do seu layout)
    setText('stat-a-receber', formatarMoeda(totalPendente));
    setText('stat-vencido', formatarMoeda(totalVencido));
    setText('stat-recebido', formatarMoeda(totalRecebido));
}

// === AÇÕES ===

async function marcarRecebido(id) {
    if(!confirm('Confirmar recebimento?')) return;
    try {
        await fetch(`${API_URL}/contasareceber/${id}`, {
            method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ marcarComoRecebido: true })
        });
        showNotification('Recebimento confirmado!', 'success');
        const elFilter = document.getElementById('filter-status');
        if(elFilter) elFilter.value = 'todos';
        loadContasReceber();
    } catch(e) { showNotification('Erro de conexão', 'error'); }
}

async function estornarRecebimento(id) {
    if(!confirm('Estornar este recebimento? O status voltará para Aguardando.')) return;
    try {
        await fetch(`${API_URL}/contasareceber/${id}`, {
            method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ marcarComoAguardando: true })
        });
        showNotification('Estorno realizado.', 'info');
        const elFilter = document.getElementById('filter-status');
        if(elFilter) elFilter.value = 'todos';
        loadContasReceber();
    } catch(e) { showNotification('Erro de conexão', 'error'); }
}

function abrirModalEditarReceber(id) {
    // Usa == para permitir string vs int
    const c = allContas.find(x => x.ID == id);
    if(!c) return;
    
    document.getElementById('receber-id').value = c.ID;
    document.getElementById('receber-cliente').value = c.ClienteNome || '';
    document.getElementById('receber-pedido').value = c.NumeroPedido || '';
    document.getElementById('receber-valor').value = parseFloat(c.Valor||0).toFixed(2);
    document.getElementById('receber-vencimento').value = c.DataVencimento || '';
    
    const statusEl = document.getElementById('receber-status');
    if(statusEl) statusEl.value = c.Status;
    
    const elPgto = document.getElementById('receber-tipo-pgto');
    if(elPgto) elPgto.value = c.TipoPagamento || 'À Vista';
    
    const elForma = document.getElementById('receber-forma-pgto');
    if(elForma) elForma.value = c.FormaPagamento || 'Pix';

    // CORREÇÃO AQUI: O ID correto no HTML é 'modal-conta-receber'
    document.getElementById('modal-conta-receber').classList.add('active');
}

function fecharModalReceber() { 
    // CORREÇÃO AQUI TAMBÉM
    document.getElementById('modal-conta-receber').classList.remove('active'); 
}

async function salvarContaReceber(e) {
    e.preventDefault();
    const id = document.getElementById('receber-id').value;
    const payload = {
        ClienteNome: document.getElementById('receber-cliente').value,
        NumeroPedido: document.getElementById('receber-pedido').value,
        Valor: parseFloat(document.getElementById('receber-valor').value),
        DataVencimento: document.getElementById('receber-vencimento').value,
        Status: document.getElementById('receber-status').value,
        TipoPagamento: document.getElementById('receber-tipo-pgto')?.value,
        FormaPagamento: document.getElementById('receber-forma-pgto')?.value
    };
    
    try {
        await fetch(`${API_URL}/contasareceber/${id}`, {
            method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
        });
        showNotification('Atualizado!', 'success');
        fecharModalReceber();
        loadContasReceber();
    } catch(e) {
        showNotification('Erro ao salvar', 'error');
    }
}

// Utils
function formatarMoeda(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0); }
function formatarData(d) { if(!d) return '-'; return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR'); }
function setText(id, t) { const el = document.getElementById(id); if(el) el.textContent = t; }
function showNotification(msg, type) { if(window.NotificationManager) window.NotificationManager.show({title:type, message:msg, type:type}); else alert(msg); }

// EXPOSIÇÃO GLOBAL DE FUNÇÕES (Para onclick no HTML funcionar)
window.marcarRecebido = marcarRecebido;
window.estornarRecebimento = estornarRecebimento;
window.abrirModalEditarReceber = abrirModalEditarReceber;