/**
 * expedicao.js - Controle de Separação com Seleção de Local
 * Versão Final: Com Modal de Picking
 */

const API_URL = 'https://virtualcriacoes.com/sinergy/api';
let filaExpedicao = [];
let historicoExpedicao = [];
let pedidoEmConferenciaID = null;

// ============================================================
// 1. INICIALIZAÇÃO
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    window.initExpedicao();
    
    // Filtro de busca
    const searchInput = document.getElementById('search-exp');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderizarExpedicao();
            renderizarHistorico();
        });
    }
    
    // Listener do formulário de picking (Novo Modal)
    const formPicking = document.getElementById('form-picking');
    if (formPicking) {
        formPicking.addEventListener('submit', (e) => {
            e.preventDefault();
            window.confirmarBaixaComLocal();
        });
    }
});

// Substitua a função window.initExpedicao existente por esta:

window.initExpedicao = async function(manual = false) {
    const loader = document.getElementById('loader-overlay');
    // Mostra o spinner
    if(loader) loader.style.display = 'flex';
    
    // Carrega os dados (passamos 'true' para as subfunções não mexerem no loader, deixamos o init controlar)
    await Promise.all([
        carregarFila(true), 
        carregarHistorico()
    ]);
    
    // Esconde o spinner
    if(loader) loader.style.display = 'none';

    // SE foi um clique manual (botão Atualizar), mostra o Toast
    if (manual && window.NotificationManager) {
        NotificationManager.show({ 
            title: 'Sincronizado', 
            message: 'Listas de expedição atualizadas.', 
            type: 'info', 
            duration: 2000 
        });
    }
};

window.switchTab = function(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    
    document.querySelectorAll('.view-section').forEach(v => v.style.display = 'none');
    document.getElementById(`view-${tab}`).style.display = 'block';
};

// ============================================================
// 2. CARREGAMENTO DE DADOS
// ============================================================

async function carregarFila(silent = false) {
    const loader = document.getElementById('loader-overlay');
    if(!silent && loader) loader.style.display = 'flex';
    
    try {
        const res = await fetch(`${API_URL}/expedicao/fila`);
        filaExpedicao = await res.json();
        if(!Array.isArray(filaExpedicao)) filaExpedicao = [];
        renderizarExpedicao();
    } catch(e) { console.error(e); }
    
    if(!silent && loader) loader.style.display = 'none';
}

async function carregarHistorico() {
    try {
        const res = await fetch(`${API_URL}/expedicao/historico`);
        historicoExpedicao = await res.json();
        if(!Array.isArray(historicoExpedicao)) historicoExpedicao = [];
        renderizarHistorico();
    } catch(e) { console.error(e); }
}

// ============================================================
// 3. RENDERIZAÇÃO
// ============================================================

function renderizarExpedicao() {
    const container = document.getElementById('expedition-grid');
    if(!container) return;
    container.innerHTML = '';

    const elSearch = document.getElementById('search-exp');
    const term = elSearch ? String(elSearch.value || "").toLowerCase() : "";

    const filtrados = filaExpedicao.filter(p => 
        (p.ClienteNome || "").toLowerCase().includes(term) || 
        (p.NumeroPedido || "").toLowerCase().includes(term)
    );

    if (filtrados.length === 0) {
        container.innerHTML = '<p style="grid-column:1/-1;text-align:center;padding:20px;color:#999;">Tudo separado!</p>';
        return;
    }

    filtrados.forEach(ped => {
        container.appendChild(createCard(ped, 'fila'));
    });
}

function renderizarHistorico() {
    const container = document.getElementById('history-grid');
    if(!container) return;
    container.innerHTML = '';

    const elSearch = document.getElementById('search-exp');
    const term = elSearch ? String(elSearch.value || "").toLowerCase() : "";

    const filtrados = historicoExpedicao.filter(p => 
        (p.ClienteNome || "").toLowerCase().includes(term) || 
        (p.NumeroPedido || "").toLowerCase().includes(term)
    );

    if (filtrados.length === 0) {
        container.innerHTML = '<p style="grid-column:1/-1;text-align:center;padding:20px;color:#999;">Histórico vazio.</p>';
        return;
    }

    filtrados.forEach(ped => {
        container.appendChild(createCard(ped, 'historico'));
    });
}

function createCard(ped, tipo) {
    const div = document.createElement('div');
    div.className = 'request-card';
    
    const isHistorico = tipo === 'historico';
    const color = isHistorico ? '#27ae60' : '#3498db';
    const statusText = isHistorico ? 'Concluído' : ped.status_visual;
    
    // Botão de ação
    const btn = isHistorico 
        ? `<button class="btn btn-secondary" style="width:100%" onclick="window.verDetalhesHistorico(${ped.ID})"><i class="fas fa-eye"></i> Ver Detalhes</button>`
        : `<button class="btn btn-primary" style="width:100%;background:${color};border:none;" onclick="window.abrirConferencia(${ped.ID})"><i class="fas fa-boxes"></i> Conferir</button>`;

    div.style.borderLeft = `5px solid ${color}`;
    div.innerHTML = `
        <div class="req-header">
            <span class="req-id">#${ped.NumeroPedido}</span>
            <span class="req-badge" style="background:${color}">${statusText}</span>
        </div>
        <div class="req-body">
            <h3 class="req-title">${ped.ClienteNome}</h3>
            <div class="req-meta">
                <span><i class="far fa-calendar"></i> ${new Date(ped.DataPedido).toLocaleDateString()}</span>
            </div>
        </div>
        <div class="req-footer">${btn}</div>
    `;
    return div;
}

// ============================================================
// 4. LÓGICA DE CONFERÊNCIA E SELEÇÃO DE LOCAL
// ============================================================

// No arquivo assets/js/expedicao.js

// === FUNÇÃO DO MODAL DE DETALHES (EXPEDIÇÃO) ===
window.verDetalhesItem = function(itemId) {
    let itemAlvo = null;
    for (let ped of filaExpedicao) { const found = ped.itens.find(i => i.ID == itemId); if (found) { itemAlvo = found; break; } }
    if (!itemAlvo && historicoExpedicao) { for (let ped of historicoExpedicao) { const found = ped.itens.find(i => i.ID == itemId); if (found) { itemAlvo = found; break; } } }
    
    if (!itemAlvo) return;

    document.getElementById('detalhe-nome').textContent = itemAlvo.ItemNome;
    document.getElementById('detalhe-qtd').textContent = parseFloat(itemAlvo.Quantidade);
    document.getElementById('detalhe-un').textContent = itemAlvo.UnidadeMedida;

    const uom = (itemAlvo.UnidadeMedida || '').toLowerCase();
    const isUnidade = ['un', 'unid', 'pc', 'pç', 'kit', 'cj'].some(s => uom.startsWith(s));

    const compReal = parseFloat(itemAlvo.Comprimento) || 0;
    const alturaReal = parseFloat(itemAlvo.Altura) || 0;
    const formata = (val) => (val > 0 ? val.toFixed(2) + 'm' : '-');

    if (isUnidade) {
        document.getElementById('detalhe-comp').textContent = '-';
        document.getElementById('detalhe-alt').textContent = '-';
    } else {
        document.getElementById('detalhe-comp').textContent = formata(compReal);
        document.getElementById('detalhe-alt').textContent = formata(alturaReal);
    }

    document.getElementById('modal-detalhes-item').classList.add('active');
};

window.abrirConferencia = function(id) {
    // Salva o ID globalmente para recarregar após ações
    pedidoEmConferenciaID = id;
    
    const ped = filaExpedicao.find(p => p.ID == id);
    if(!ped) return;

    document.getElementById('modal-ped-title').textContent = `Conferência - Pedido ${ped.NumeroPedido}`;
    const lista = document.getElementById('lista-itens-expedicao');
    lista.innerHTML = '';

    // Ordenação: Pendentes primeiro, Concluídos por último
    const itensOrdenados = [...ped.itens].sort((a, b) => {
        if (a.StatusExpedicao === b.StatusExpedicao) return 0;
        return a.StatusExpedicao === 'Pendente' ? -1 : 1;
    });

    itensOrdenados.forEach(item => {
        let statusClass = 'ready';
        let btnHTML = '';
        let infoExtra = '';

        // === LÓGICA DE MEDIDAS (Igual à Produção) ===
        let detalhesMedida = '';
        const comp = parseFloat(item.Comprimento) || 0;
        const altura = parseFloat(item.Altura) || 0;
        const uom = (item.UnidadeMedida || '').toLowerCase().trim();
        const isUnidade = ['un', 'unid', 'pç', 'pc', 'kit', 'cj', 'jg', 'par'].some(s => uom.startsWith(s));

        if (!isUnidade) {
            if (comp > 0 && altura > 0) {
                // Tem as duas
                detalhesMedida = `<span style="color:#2c3e50; font-weight:600; background:#e8f4fd; padding:1px 5px; border-radius:3px; font-size:12px; margin-left:5px;">
                    ${comp.toFixed(2)}m x ${altura.toFixed(2)}m
                </span>`;
            } else if (comp > 0) {
                // Só comprimento
                detalhesMedida = `<span style="color:#2c3e50; font-weight:600; background:#e8f4fd; padding:1px 5px; border-radius:3px; font-size:12px; margin-left:5px;">
                    Comp: ${comp.toFixed(2)}m
                </span>`;
            }
        }

        // Lógica de Status e Botões
        if (item.StatusExpedicao === 'Separado') {
            // Item já conferido pela expedição
            statusClass = 'done';
            btnHTML = '<span style="color:#27ae60; font-weight:bold; font-size:14px;"><i class="fas fa-check-double"></i> OK</span>';
        } else {
            // Item Pendente
            if (item.RequerProducao == 1) {
                // É item de FÁBRICA
                if (item.StatusProducao !== 'Concluido') {
                    // Produção ainda não terminou -> Bloqueia
                    statusClass = 'locked';
                    infoExtra = '<span class="badge-prod wait"><i class="fas fa-clock"></i> Aguardando Produção</span>';
                    btnHTML = '<button class="btn btn-sm" disabled style="opacity:0.5; cursor:not-allowed; background:#ccc; color:#666;">Bloqueado</button>';
                } else {
                    // Produção terminou -> Libera confirmação
                    infoExtra = '<span class="badge-prod ok"><i class="fas fa-check"></i> Produção OK</span>';
                    // Passa NULL no estoqueID pois item de produção não baixa estoque na expedição
                    btnHTML = `<button class="btn btn-sm btn-success" onclick="window.confirmarSeparacao(${item.ID}, null)">Confirmar</button>`;
                }
            } else {
                // É item de REVENDA -> Libera baixa de estoque
                infoExtra = '<span class="badge-prod"><i class="fas fa-box"></i> Pegar no Estoque</span>';
                // Abre modal de seleção de local
                btnHTML = `<button class="btn btn-sm btn-primary" onclick="window.abrirSelecaoLocal(${item.ID}, ${item.ProdutoID}, '${item.ItemNome}', ${item.Quantidade})">Baixar</button>`;
            }
        }

        // Botão do Olho
        const btnOlho = `<button class="btn-view-details" onclick="window.verDetalhesItem(${item.ID})" title="Ver Detalhes Completos"><i class="fas fa-eye"></i></button>`;

        // HTML Final da Linha
        lista.innerHTML += `
            <div class="exp-item ${statusClass}">
                <div style="flex:1;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <strong style="color:#2c3e50; font-size:15px;">${item.ItemNome}</strong>
                        ${btnOlho}
                    </div>
                    <div style="margin-top:2px;">${detalhesMedida}</div>
                    <div style="margin-top:4px;">${infoExtra}</div>
                    <small style="color:#666; display:block; margin-top:2px;">
                        Qtd: <strong>${parseFloat(item.Quantidade)}</strong> ${item.UnidadeMedida}
                    </small>
                </div>
                <div style="min-width:100px; text-align:right;">${btnHTML}</div>
            </div>`;
    });

    document.getElementById('modal-expedicao').classList.add('active');
};

// --- FUNÇÃO QUE ESTAVA FALTANDO ---
window.abrirSelecaoLocal = async function(itemID, produtoID, nomeItem, qtdNecessaria) {
    document.getElementById('picking-item-id').value = itemID;
    document.getElementById('desc-item-picking').innerHTML = `Separando: ${nomeItem}<br><small>Quantidade necessária: ${qtdNecessaria}</small>`;
    
    const sel = document.getElementById('select-local-estoque');
    sel.innerHTML = '<option value="">Carregando locais...</option>';
    
    document.getElementById('modal-selecionar-local').classList.add('active');

    try {
        const res = await fetch(`${API_URL}/estoque/locais-produto?id=${produtoID}`);
        const locais = await res.json();
        
        sel.innerHTML = '<option value="">Selecione o local...</option>';
        if (locais.length === 0) {
            sel.innerHTML += '<option disabled>Sem saldo em nenhum local!</option>';
        } else {
            locais.forEach(l => {
                const disponivel = parseFloat(l.Quantidade);
                const aviso = disponivel < qtdNecessaria ? ' (Saldo Insuficiente)' : '';
                sel.innerHTML += `<option value="${l.ID}">${l.Localizacao} - Saldo: ${disponivel}${aviso}</option>`;
            });
        }
    } catch(e) {
        sel.innerHTML = '<option disabled>Erro ao carregar locais</option>';
    }
};

window.fecharModalLocal = function() {
    document.getElementById('modal-selecionar-local').classList.remove('active');
};

window.confirmarBaixaComLocal = function() {
    const itemID = document.getElementById('picking-item-id').value;
    const estoqueID = document.getElementById('select-local-estoque').value;
    
    if (!estoqueID) { alert("Selecione um local!"); return; }
    
    window.confirmarSeparacao(itemID, estoqueID);
    window.fecharModalLocal();
};

// ============================================================
// 5. EFETIVAÇÃO DA BAIXA
// ============================================================

window.confirmarSeparacao = async function(itemID, estoqueID) {
    const payload = { ItemID: itemID };
    if (estoqueID) payload.EstoqueID = estoqueID;

    try {
        const res = await fetch(`${API_URL}/expedicao/baixar-item`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify(payload)
        });
        
        if (res.ok) {
            const data = await res.json();
            
            if (window.NotificationManager) {
                NotificationManager.show({ title: 'Sucesso', message: 'Baixa realizada!', type: 'success', duration: 2000 });
            }
            
            await carregarFila(true); // Recarrega silenciosamente
            
            if (data.pedidoConcluido) {
                document.getElementById('modal-expedicao').classList.remove('active');
                document.getElementById('modal-conclusao-pedido').classList.add('active');
                carregarHistorico();
            } else {
                if (pedidoEmConferenciaID) abrirConferencia(pedidoEmConferenciaID);
            }
        } else {
            const err = await res.json();
            alert('Erro: ' + (err.error || 'Erro desconhecido'));
        }
    } catch(e) { alert("Erro de conexão"); }
};

window.verDetalhesHistorico = function(id) {
    const ped = historicoExpedicao.find(p => p.ID == id);
    if(!ped) return;
    const content = document.getElementById('conteudo-historico');
    content.innerHTML = `<div style="border-bottom:1px solid #eee;padding-bottom:10px;"><h3>${ped.ClienteNome}</h3><p>#${ped.NumeroPedido} | ${new Date(ped.DataPedido).toLocaleDateString()}</p></div>`;
    ped.itens.forEach(item => {
        content.innerHTML += `<div class="exp-item done" style="opacity:1; background:#f9f9f9;"><div style="flex:1;"><strong>${item.NomeItem||item.ItemNome}</strong><br><small>Qtd: ${parseFloat(item.Quantidade)}</small></div><div style="color:#27ae60;font-weight:bold;"><i class="fas fa-check-double"></i> Conferido</div></div>`;
    });
    document.getElementById('modal-detalhes-historico').classList.add('active');
};