/**
 * js/diretoria.js - Painel Executivo
 * Versão Final: Com Comex (Containers) Ativado
 */

document.addEventListener('DOMContentLoaded', () => {
    initDiretoria();
});

const API_URL = 'https://virtualcriacoes.com/sinergy/api';
let charts = {}; 
let currentSolicitacaoID = null;

async function initDiretoria() {
    const dataEl = document.getElementById('data-hoje');
    if(dataEl) dataEl.textContent = new Date().toLocaleDateString('pt-BR', {weekday:'long', day:'numeric', month:'long'});

    setupModals();
    await loadDashboardData();
    
    const loader = document.getElementById('loader-overlay');
    if (loader) loader.style.display = 'none';
    
    setInterval(loadDashboardData, 60000);
}

function setupModals() {
    const modal = document.getElementById('modal-detalhes-solicitacao');
    if (modal) {
        modal.querySelectorAll('.close-modal, .btn-secondary').forEach(btn => 
            btn.addEventListener('click', () => modal.classList.remove('active'))
        );
    }
}

async function loadDashboardData() {
    try {
        const res = await fetch(`${API_URL}/diretoria/dashboard`);
        if (!res.ok) throw new Error('Falha API');
        const data = await res.json();

        updateKPIs(data);
        renderCharts(data);
        renderApprovalList(data.pendencias);
        renderProductionList(data.producao);
        renderComexList(data.comex); // Agora implementado

    } catch (e) {
        console.error("Erro Dashboard:", e);
    }
}

function updateKPIs(data) {
    const setText = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
    
    if(data.financeiro) {
        setText('kpi-saldo', formatCurrency(data.financeiro.saldo));
        setText('kpi-a-pagar', formatCurrency(data.financeiro.aPagar));
        setText('kpi-a-receber', formatCurrency(data.financeiro.aReceber));
    }
    if(data.comercial) {
        setText('kpi-pedidos-abertos', data.comercial.pedidosAbertos);
        setText('kpi-faturamento', formatCurrency(data.comercial.faturamentoTotal));
    }
    if(data.rh) {
        setText('kpi-funcionarios', data.rh.qtdFuncionarios);
        setText('kpi-custo-func', formatCurrency(data.rh.custoMedio));
    }
    
    if(data.manutencao) setText('kpi-manutencao-ativa', data.manutencao.emAndamento);
    if(data.compras) setText('kpi-compras-aguardando', data.compras.aguardando);
    
    setText('count-pendencias', data.pendencias ? data.pendencias.length : 0);
}

function renderCharts(data) {
    if(data.comercial && data.comercial.porVendedor) {
        createChart('chartVendedores', 'bar', {
            labels: data.comercial.porVendedor.map(d => d.VendedorNome),
            datasets: [{ label: 'Faturamento', data: data.comercial.porVendedor.map(d => d.total), backgroundColor: '#3498db', borderRadius: 4 }]
        }, { indexAxis: 'y' });
    }
    if(data.comercial && data.comercial.porCliente) {
        createChart('chartClientes', 'bar', {
            labels: data.comercial.porCliente.map(d => d.ClienteNome.substring(0,15)),
            datasets: [{ label: 'Total', data: data.comercial.porCliente.map(d => d.total), backgroundColor: '#2ecc71', borderRadius: 4 }]
        });
    }
    if(data.estoque) {
        createChart('chartEstoque', 'doughnut', {
            labels: data.estoque.map(d => d.Tipo),
            datasets: [{ data: data.estoque.map(d => d.pesoTotal), backgroundColor: ['#f1c40f', '#e67e22', '#e74c3c', '#9b59b6', '#34495e'] }]
        });
    }
    if(data.compras && data.compras.porSetor) {
        createChart('chartComprasSetor', 'doughnut', {
            labels: data.compras.porSetor.map(d => d.Setor),
            datasets: [{ data: data.compras.porSetor.map(d => d.qtd), backgroundColor: ['#1abc9c', '#16a085', '#27ae60', '#2980b9'] }]
        });
    }
    if(data.manutencao && data.manutencao.causas) {
        createChart('chartManutencao', 'pie', {
            labels: data.manutencao.causas.map(d => d.ProblemaDefeito),
            datasets: [{ data: data.manutencao.causas.map(d => d.qtd), backgroundColor: ['#e74c3c', '#c0392b', '#d35400'] }]
        });
    }
}

function createChart(canvasId, type, data, extraOptions = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (!data.labels || data.labels.length === 0) return;
    if (charts[canvasId]) charts[canvasId].destroy();
    const ctx = canvas.getContext('2d');
    charts[canvasId] = new Chart(ctx, { type: type, data: data, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } }, ...extraOptions } });
}

function renderApprovalList(lista) {
    const container = document.getElementById('approval-list');
    if(!container) return;
    container.innerHTML = '';
    if (!lista || lista.length === 0) {
        container.innerHTML = '<div style="padding:20px; text-align:center; color:#95a5a6;">Nenhuma pendência.</div>';
        return;
    }
    lista.forEach(item => {
        const div = document.createElement('div');
        div.className = `approval-item type-${item.Tipo}`;
        const icon = item.Tipo === 'Compra' ? '<i class="fas fa-shopping-cart"></i>' : '<i class="fas fa-file-contract"></i>';
        const valor = item.Valor ? `<br><span style="font-weight:bold; color:#2c3e50;">${formatCurrency(item.Valor)}</span>` : '';
        div.innerHTML = `
            <div class="app-info"><strong>${icon} ${item.DescricaoLista || item.Titulo}</strong><div>${item.Autor} • ${new Date(item.Data).toLocaleDateString()}</div>${valor}</div>
            <button class="btn-icon" onclick="window.verDetalhesPendencia(${item.ID}, '${item.Tipo}')"><i class="fas fa-eye"></i></button>
        `;
        container.appendChild(div);
    });
}

function renderProductionList(lista) {
    const el = document.getElementById('list-producao');
    if(!el) return;
    el.innerHTML = '';
    if(!lista || lista.length === 0) { el.innerHTML = '<li>Nenhuma produção ativa.</li>'; return; }
    lista.forEach(p => { el.innerHTML += `<li><strong>#${p.NumPedido}</strong> - ${p.NomeCliente.split(' ')[0]}</li>`; });
}

// === IMPLEMENTAÇÃO DO COMEX (CONTAINERS) ===
function renderComexList(lista) {
    console.log('[COMEX DEBUG] renderComexList chamado com:', lista);

    const el = document.getElementById('list-comex');

    console.log('[COMEX DEBUG] Elemento #list-comex encontrado:', el ? 'SIM' : 'NÃO');

    if(!el) return;

    el.innerHTML = '';

 

    if(!lista || lista.length === 0) {

        console.log('[COMEX DEBUG] Lista vazia ou null');

        el.innerHTML = '<li style="color:#999; text-align:center; padding:10px;">Nenhum container rastreado.</li>';

        return;

    }

 

    console.log('[COMEX DEBUG] Renderizando', lista.length, 'containers');
    
    lista.forEach(c => {
        const eta = c.DataETA ? new Date(c.DataETA).toLocaleDateString('pt-BR') : 'N/A';
        // HTML do Card de Container
        const li = document.createElement('li');
        li.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #f0f0f0;";
        li.innerHTML = `
            <div>
                <div style="font-weight:bold; color:#2c3e50; font-size:13px;">
                    <i class="fas fa-ship" style="color:#3498db; margin-right:5px;"></i> ${c.ContainerNumero}
                </div>
                <div style="font-size:11px; color:#7f8c8d; margin-top:2px;">${c.StatusAtual}</div>
            </div>
            <div style="text-align:right;">
                <div style="font-size:10px; color:#95a5a6; text-transform:uppercase;">Chegada</div>
                <div style="font-weight:bold; color:#e67e22; font-size:12px;">${eta}</div>
            </div>
        `;
        el.appendChild(li);
    });
}

// === DETALHES E APROVAÇÃO ===
window.verDetalhesPendencia = function(id, tipo) {
    currentSolicitacaoID = id;
    const modal = document.getElementById('modal-detalhes-solicitacao');
    const content = document.getElementById('modal-detalhes-content');
    content.innerHTML = '<div style="text-align:center; padding:30px;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
    modal.classList.add('active');

    fetch(`${API_URL}/diretoria/dashboard`).then(r=>r.json()).then(data => {
        const item = data.pendencias.find(p => p.ID == id && p.Tipo == tipo);
        if(item) {
            if (tipo === 'Compra') renderDetalhesCompra(item, content);
            else renderDetalhesOrcamento(item, content);
        } else { content.innerHTML = '<p class="error">Item não encontrado.</p>'; }
    });
};

function renderDetalhesCompra(sol, container) {
    let htmlCota = '<div style="padding:15px; background:#f8f9fa; border-radius:8px; margin-top:10px; color:#7f8c8d;">Sem cotação.</div>';
    if (sol.CotacaoJSON) {
        try {
            const cot = JSON.parse(sol.CotacaoJSON);
            const esc = sol.FornecedorEscolhido;
            htmlCota = `<div class="cotacao-review" style="margin-top:15px;"><h4 style="margin-bottom:10px; color:#2c3e50;">Mapa Comparativo</h4><table class="table-cotacao"><thead><tr style="background:#ecf0f1;"><th></th><th>Forn 1</th><th>Forn 2</th><th>Forn 3</th></tr></thead><tbody><tr><td><strong>Empresa</strong></td><td>${cot.fornecedor1?.nome||'-'}</td><td>${cot.fornecedor2?.nome||'-'}</td><td>${cot.fornecedor3?.nome||'-'}</td></tr><tr><td><strong>Preço</strong></td><td class="${esc==1?'text-success bold':''}">${formatCurrency(cot.fornecedor1?.preco)}</td><td class="${esc==2?'text-success bold':''}">${formatCurrency(cot.fornecedor2?.preco)}</td><td class="${esc==3?'text-success bold':''}">${formatCurrency(cot.fornecedor3?.preco)}</td></tr><tr><td><strong>Condição</strong></td><td>${cot.fornecedor1?.pagamento||'-'}</td><td>${cot.fornecedor2?.pagamento||'-'}</td><td>${cot.fornecedor3?.pagamento||'-'}</td></tr><tr><td><strong>Ação</strong></td><td>${cot.fornecedor1?.nome?`<button class="btn-mini-select" onclick="window.escolherVencedor(1)">${esc==1?'Vencedor':'Escolher'}</button>`:''}</td><td>${cot.fornecedor2?.nome?`<button class="btn-mini-select" onclick="window.escolherVencedor(2)">${esc==2?'Vencedor':'Escolher'}</button>`:''}</td><td>${cot.fornecedor3?.nome?`<button class="btn-mini-select" onclick="window.escolherVencedor(3)">${esc==3?'Vencedor':'Escolher'}</button>`:''}</td></tr></tbody></table><div style="margin-top:10px; padding:10px; background:#fff3cd; color:#856404; font-size:13px; border-radius:4px;"><strong>Obs:</strong> ${sol.ObservacaoCotacao||'Nenhuma.'}</div></div>`;
        } catch(e) { htmlCota = '<p class="error">Erro cotação.</p>'; }
    }
    container.innerHTML = `<div class="detalhe-header" style="border-bottom:1px solid #eee; padding-bottom:10px; margin-bottom:15px;"><h3 style="margin:0; color:#2c3e50;">Solicitação #${sol.ID} - ${sol.Material}</h3><span class="badge badge-info">${sol.Status}</span></div><div class="info-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:14px;"><div><strong>Qtd:</strong> ${sol.Quantidade} ${sol.Unidade}</div><div><strong>Setor:</strong> ${sol.Setor}</div><div><strong>Solicitante:</strong> ${sol.Autor||'Sistema'}</div><div style="grid-column:1/-1;"><strong>Descrição:</strong> ${sol.Descricao||'-'}</div></div>${htmlCota}<div class="modal-actions" style="margin-top:20px; display:flex; justify-content:flex-end; gap:10px;"><button class="btn btn-danger" onclick="window.rejeitarItem(${sol.ID}, 'Compra')">Recusar</button><button class="btn btn-success" onclick="window.aprovarCompra(${sol.ID})">Aprovar e Gerar Pedido</button></div>`;
}

function renderDetalhesOrcamento(orc, container) {
    container.innerHTML = `<h3>Orçamento #${orc.ID} - ${orc.Titulo}</h3><p><strong>Valor:</strong> ${formatCurrency(orc.ValorTotal)}</p><p><strong>Vendedor:</strong> ${orc.Autor}</p><hr><div style="display:flex; justify-content:flex-end; margin-top:20px;"><button class="btn btn-danger" onclick="window.rejeitarItem(${orc.ID}, 'Orcamento')">Rejeitar</button></div>`;
}

window.escolherVencedor = async function(idx) {
    await fetch(`${API_URL}/solicitacoes-compras/${currentSolicitacaoID}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({FornecedorEscolhido:idx}) });
    window.verDetalhesPendencia(currentSolicitacaoID, 'Compra');
};

window.aprovarCompra = async function(id) {
    if(!confirm('Aprovar compra?')) return;
    try {
        const res = await fetch(`${API_URL}/solicitacoes-compras/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({Status:'Aprovado'}) });
        if(res.ok) { alert('Aprovado!'); document.getElementById('modal-detalhes-solicitacao').classList.remove('active'); loadDashboardData(); }
        else { const e = await res.json(); alert('Erro: ' + e.error); }
    } catch(e) { alert('Erro conexão'); }
};

window.rejeitarItem = async function(id, tipo) {
    const m = prompt('Motivo:'); if(!m) return;
    const url = tipo === 'Compra' ? `${API_URL}/solicitacoes-compras/${id}` : `${API_URL}/orcamentos/${id}`;
    const pl = tipo === 'Compra' ? {Status:'Recusado', MotivoRecusa:m} : {status:'rejeitado'};
    await fetch(url, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(pl)});
    document.getElementById('modal-detalhes-solicitacao').classList.remove('active');
    loadDashboardData();
};

function formatCurrency(v) { return new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(v||0); }