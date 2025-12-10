/**
 * js/pedidos.js - Versão Final Consolidada
 * Inclui: Paginação, Dashboard, Edição, Cancelamento, PDF e Produção.
 */

document.addEventListener('DOMContentLoaded', () => {
    if (typeof ChartDataLabels !== 'undefined') {
        Chart.register(ChartDataLabels);
    }
    initializeAppPedidos();
});

// === CONSTANTES E VARIÁVEIS GLOBAIS ===
const API_URL = 'https://virtualcriacoes.com/sinergy/api';
let allPedidos = []; 
let produtosDB = []; 
let currentPedido = null; 
let pedidoParaCancelarId = null; 
let currentUserID = null;
let currentUserRole = null;
let currentUserName = null;

// Variáveis para Edição
let itensTempEdit = [];
let pedidoEmEdicaoID = null;

// Variáveis de Paginação
let currentPage = 1;
const itemsPerPage = 10;
let filteredPedidos = [];

// Variáveis para Gráficos
let chartVendasInstance = null;
let chartClientesInstance = null;
let chartProdutosInstance = null;

// === INICIALIZAÇÃO ===
async function initializeAppPedidos() {
    currentUserID = window.getLoggedInUserID(); 
    currentUserRole = window.getLoggedInUserRole(); 
    currentUserName = window.getLoggedInUserFullName(); 

    if (!currentUserID || !currentUserRole || !currentUserName) {
        showNotification('Sessão inválida ou expirada. Faça login novamente.', 'error');
        return;
    }
    
    setupEventListenersPedidos();
    
    await Promise.all([loadPedidos(), loadProdutos()]);
    
    if (currentUserRole === 'admin') {
        populateVendedorFilterPedidos();
    }
    
    renderizarTabelaPedidos();
    atualizarEstatisticasPedidos();

    const loader = document.getElementById('loader-overlay');
    if (loader) loader.style.display = 'none';
}

// === CARREGAMENTO DE DADOS ===
async function loadPedidos() {
    try {
        let url = `${API_URL}/pedidos`;
        if (currentUserRole === 'admin') {
            url += `?role=admin`;
        } else {
            url += `?role=vendedor&nomeVendedor=${encodeURIComponent(currentUserName)}`;
        }
        const response = await fetch(url);
        if (!response.ok) throw new Error('Falha ao carregar pedidos');
        allPedidos = await response.json();
    } catch (error) {
        showNotification(`Erro ao carregar pedidos: ${error.message}`, 'error');
        allPedidos = [];
    }
}

async function loadProdutos() {
    try {
        const response = await fetch(`${API_URL}/produtos`);
        if (response.ok) produtosDB = await response.json();
    } catch (error) { console.error("Erro ao carregar produtos", error); }
}

// === ESTATÍSTICAS (KPIs) ===
function atualizarEstatisticasPedidos() {
    const total = allPedidos.length;
    const aguardando = allPedidos.filter(p => p.StatusPedido.includes('Aguardando')).length;
    const producao = allPedidos.filter(p => p.StatusPedido === 'Em Produção' || p.StatusPedido === 'Pedido Alterado').length;
    const concluidos = allPedidos.filter(p => p.StatusPedido === 'Concluído').length;
    const cancelados = allPedidos.filter(p => p.StatusPedido === 'Cancelado').length;

    const updateText = (id, val) => { 
        const el = document.getElementById(id); 
        if (el) el.textContent = val; 
    };

    updateText('stat-total-pedidos', total);
    updateText('stat-aguardando', aguardando);
    updateText('stat-producao', producao);
    updateText('stat-concluidos', concluidos);
    updateText('stat-cancelados', cancelados);
}

// === CONFIGURAÇÃO DE EVENTOS ===
function setupEventListenersPedidos() {
    const resetPageAndRender = () => { 
        currentPage = 1; 
        renderizarTabelaPedidos(true); 
    };
    document.getElementById('search-input').addEventListener('input', resetPageAndRender);
    document.getElementById('filter-status').addEventListener('change', resetPageAndRender);
    document.getElementById('filter-vendedor-pedidos').addEventListener('change', resetPageAndRender);

    document.getElementById('btn-prev-page').addEventListener('click', () => {
        if (currentPage > 1) { currentPage--; renderizarTabelaPedidos(false); }
    });
    document.getElementById('btn-next-page').addEventListener('click', () => {
        const totalPages = Math.ceil(filteredPedidos.length / itemsPerPage);
        if (currentPage < totalPages) { currentPage++; renderizarTabelaPedidos(false); }
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
            btn.classList.add('active');
            const targetId = btn.dataset.tab;
            document.getElementById(targetId).style.display = 'block';
            if (targetId === 'view-relatorios') renderizarDashboardCompleto();
        });
    });

    const btnExcel = document.getElementById('btn-exportar-excel-vendas');
    if (btnExcel) btnExcel.addEventListener('click', exportarRelatorioExcel);

    const closeViewBtn = document.getElementById('close-view-pedido-modal');
    const btnFecharView = document.getElementById('btn-fechar-view-pedido');
    if (closeViewBtn) closeViewBtn.addEventListener('click', fecharModalViewPedido);
    if (btnFecharView) btnFecharView.addEventListener('click', fecharModalViewPedido);
    
    const btnBaixarOp = document.getElementById('btn-baixar-op');
    if (btnBaixarOp) btnBaixarOp.addEventListener('click', () => { if (currentPedido) exportarOrdemProducaoPDF(currentPedido.ID, 'download'); });
    const btnVisualizarOp = document.getElementById('btn-visualizar-op');
    if (btnVisualizarOp) btnVisualizarOp.addEventListener('click', () => { if (currentPedido) exportarOrdemProducaoPDF(currentPedido.ID, 'view'); });
    const btnIniciarProd = document.getElementById('btn-iniciar-producao');
    if (btnIniciarProd) btnIniciarProd.addEventListener('click', () => { if (currentPedido) atualizarStatusPedido(currentPedido.ID, 'Em Produção'); });
    const btnConcluirPed = document.getElementById('btn-concluir-pedido');
    if (btnConcluirPed) btnConcluirPed.addEventListener('click', () => { if (currentPedido) atualizarStatusPedido(currentPedido.ID, 'Concluído'); });
    const btnCancelModal = document.getElementById('btn-cancelar-pedido-modal');
    if (btnCancelModal) btnCancelModal.addEventListener('click', () => { if (currentPedido) abrirModalCancelamento(currentPedido.ID); });

    const closeCancelBtn = document.getElementById('close-cancel-modal');
    const btnVoltarCancel = document.getElementById('btn-voltar-cancelamento');
    const btnConfirmarCancel = document.getElementById('btn-confirmar-cancelamento');
    if (closeCancelBtn) closeCancelBtn.addEventListener('click', fecharModalCancelamento);
    if (btnVoltarCancel) btnVoltarCancel.addEventListener('click', fecharModalCancelamento);
    if (btnConfirmarCancel) btnConfirmarCancel.addEventListener('click', confirmarCancelamento);

    const closeEditBtn = document.getElementById('close-edit-pedido-modal');
    const btnCancelEdit = document.getElementById('btn-cancelar-edit');
    if(closeEditBtn) closeEditBtn.addEventListener('click', fecharModalEdicao);
    if(btnCancelEdit) btnCancelEdit.addEventListener('click', fecharModalEdicao);
    
    const formEdit = document.getElementById('form-editar-pedido');
    if(formEdit) formEdit.addEventListener('submit', salvarEdicaoPedido);

    const btnAddItem = document.getElementById('btn-add-item-edit');
    if(btnAddItem) btnAddItem.addEventListener('click', adicionarItemEdicao);
    const selectProd = document.getElementById('edit-select-produto');
    if(selectProd) selectProd.addEventListener('change', preencherDadosItemEdicao);
    document.getElementById('edit-check-frete').addEventListener('change', toggleFreteEdicao);
    document.getElementById('edit-valor-frete').addEventListener('input', atualizarTotaisEdicao);
    document.getElementById('edit-desconto-geral').addEventListener('input', atualizarTotaisEdicao);
    const selectProdEdit = document.getElementById('edit-select-produto');
    if(selectProdEdit) selectProdEdit.addEventListener('change', updateEditFieldsVisibility);
}

// === RENDERIZAÇÃO COM PAGINAÇÃO ===
function renderizarTabelaPedidos(reFilter = true) {
    const tbody = document.getElementById('pedidos-tbody');
    if (!tbody) return;
    
    if (reFilter) {
        const searchInput = document.getElementById('search-input');
        const statusInput = document.getElementById('filter-status');
        const vendInput = document.getElementById('filter-vendedor-pedidos');
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        const statusFilter = statusInput ? statusInput.value : 'todos';
        const vendedorFilter = vendInput ? vendInput.value : 'all';

        filteredPedidos = allPedidos.filter(pedido => {
            const matchSearch = (pedido.ClienteNome || '').toLowerCase().includes(searchTerm) || (pedido.NumeroPedido || '').toLowerCase().includes(searchTerm);
            const matchStatus = statusFilter === 'todos' || pedido.StatusPedido === statusFilter;
            const matchVendedor = (currentUserRole !== 'admin' || vendedorFilter === 'all') || pedido.VendedorNome === vendedorFilter;
            return matchSearch && matchStatus && matchVendedor;
        });
        
        filteredPedidos.sort((a, b) => b.ID - a.ID);
    }

    const totalItems = filteredPedidos.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const itemsToShow = filteredPedidos.slice(startIndex, endIndex);

    document.getElementById('page-info').textContent = `Página ${currentPage} de ${totalPages}`;
    document.getElementById('btn-prev-page').disabled = currentPage === 1;
    document.getElementById('btn-next-page').disabled = currentPage === totalPages;

    tbody.innerHTML = '';
    if (totalItems === 0) return tbody.innerHTML = '<tr><td colspan="7" class="text-center">Nenhum pedido encontrado</td></tr>';

    itemsToShow.forEach(pedido => {
        const tr = document.createElement('tr');
        let statusClass = pedido.StatusPedido.toLowerCase().replace(/ /g, '-').replace('ç', 'c').replace('ã', 'a').replace('õ', 'o').replace('í', 'i').replace('ú', 'u'); 
        
        let actionsHtml = '';
        if (pedido.StatusPedido.includes('Aguardando Produção')) {
            actionsHtml += `<button class="action-button start-prod" onclick="atualizarStatusPedido(${pedido.ID}, 'Em Produção')" title="Iniciar Produção"><i class="fas fa-play"></i></button>`;
        } else if (pedido.StatusPedido === 'Em Produção' || pedido.StatusPedido === 'Pedido Alterado') {
            actionsHtml += `<button class="action-button finish-prod" onclick="atualizarStatusPedido(${pedido.ID}, 'Concluído')" title="Concluir Produção"><i class="fas fa-check-circle"></i></button>`;
        }
        actionsHtml += `<button class="action-button view" onclick="visualizarPedido(${pedido.ID})" title="Visualizar Detalhes"><i class="fas fa-eye"></i></button><button class="action-button view-pdf" onclick="exportarOrdemProducaoPDF(${pedido.ID}, 'view')" title="Visualizar O.P."><i class="fas fa-search-plus"></i></button><button class="action-button download" onclick="exportarOrdemProducaoPDF(${pedido.ID}, 'download')" title="Baixar O.P."><i class="fas fa-file-pdf"></i></button>`;
        if (pedido.StatusPedido !== 'Cancelado' && pedido.StatusPedido !== 'Concluído') {
            actionsHtml += `<button class="action-button edit" onclick="abrirModalEdicao(${pedido.ID})" title="Editar Pedido"><i class="fas fa-edit"></i></button><button class="action-button delete" onclick="abrirModalCancelamento(${pedido.ID})" title="Cancelar Pedido"><i class="fas fa-ban"></i></button>`;
        }

        tr.innerHTML = `<td><strong>${pedido.NumeroPedido}</strong></td><td>${pedido.ClienteNome}</td><td>${formatarData(pedido.DataPedido)}</td><td><strong>${formatarMoeda(pedido.ValorTotal)}</strong></td><td>${pedido.VendedorNome}</td><td><span class="status-badge ${statusClass}">${pedido.StatusPedido}</span></td><td class="text-center"><div class="table-actions">${actionsHtml}</div></td>`;
        tbody.appendChild(tr);
    });
}

// === DASHBOARD ===
function renderizarDashboardCompleto() {
    const pedidosValidos = allPedidos.filter(p => p.StatusPedido !== 'Cancelado');
    renderChartVendedores(pedidosValidos);
    renderChartClientes(pedidosValidos);
    renderChartProdutos(pedidosValidos);
}

function renderChartVendedores(pedidos) {
    const ctx = document.getElementById('graficoVendasVendedor');
    if (!ctx) return;
    const dados = {};
    pedidos.forEach(p => {
        const vend = p.VendedorNome || 'N/A';
        if (!dados[vend]) dados[vend] = 0;
        dados[vend] += parseFloat(p.ValorTotal || 0);
    });
    const sorted = Object.entries(dados).sort((a, b) => b[1] - a[1]);
    if (chartVendasInstance) chartVendasInstance.destroy();
    chartVendasInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(i => i[0]),
            datasets: [{ label: 'Total Vendido (R$)', data: sorted.map(i => i[1]), backgroundColor: 'rgba(52, 152, 219, 0.7)', borderColor: 'rgba(52, 152, 219, 1)', borderWidth: 1, borderRadius: 4 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, layout: { padding: { top: 25 } },
            plugins: { legend: { display: false }, datalabels: { anchor: 'end', align: 'top', color: '#334155', font: {weight:'bold'}, formatter: (v) => 'R$ ' + v.toLocaleString('pt-BR', {compactDisplay: "short", notation: "compact"}) } },
            scales: { y: { beginAtZero: true, ticks: { callback: (val) => 'R$ ' + val.toLocaleString('pt-BR', {compactDisplay: "short", notation: "compact"}) } } }
        }
    });
}

function renderChartClientes(pedidos) {
    const ctx = document.getElementById('graficoTopClientes');
    if (!ctx) return;
    const dados = {};
    pedidos.forEach(p => {
        const cli = p.ClienteNome || 'N/A';
        if (!dados[cli]) dados[cli] = 0;
        dados[cli] += parseFloat(p.ValorTotal || 0);
    });
    const sorted = Object.entries(dados).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (chartClientesInstance) chartClientesInstance.destroy();
    chartClientesInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sorted.map(i => i[0]),
            datasets: [{ data: sorted.map(i => i[1]), backgroundColor: ['#2ecc71', '#3498db', '#9b59b6', '#f1c40f', '#e74c3c'], borderWidth: 0 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'right', labels: { boxWidth: 12 } }, datalabels: { color: '#fff', font: { weight: 'bold' }, formatter: (v) => 'R$ ' + v.toLocaleString('pt-BR', {compactDisplay: "short"}) } },
            layout: { padding: 0 }
        }
    });
}

function renderChartProdutos(pedidos) {
    const ctx = document.getElementById('graficoTopProdutos');
    if (!ctx) return;
    const dados = {};
    pedidos.forEach(p => {
        if (p.itens && Array.isArray(p.itens)) {
            p.itens.forEach(item => {
                const nome = item.ItemNome || 'Desconhecido';
                const qtd = parseFloat(item.Quantidade || 0);
                if (!dados[nome]) dados[nome] = 0;
                dados[nome] += qtd;
            });
        }
    });
    const sorted = Object.entries(dados).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (chartProdutosInstance) chartProdutosInstance.destroy();
    chartProdutosInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(i => i[0]),
            datasets: [{ label: 'Qtd', data: sorted.map(i => i[1]), backgroundColor: 'rgba(243, 156, 18, 0.7)', borderColor: 'rgba(243, 156, 18, 1)', borderWidth: 1, borderRadius: 4 }]
        },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false, layout: { padding: { right: 40 } },
            plugins: { legend: { display: false }, datalabels: { anchor: 'end', align: 'right', color: '#334155', font: {weight:'bold'}, formatter: (v) => v } },
            scales: { x: { beginAtZero: true } }
        }
    });
}

function exportarRelatorioExcel() {
    let csvContent = [];
    csvContent.push("Relatório de Vendas por Pedido;;;;;");
    csvContent.push(`Gerado em: ${new Date().toLocaleDateString('pt-BR')};;;;;`);
    csvContent.push("");
    csvContent.push("Número Pedido;Data;Cliente;Vendedor;Status;Valor Total");
    allPedidos.forEach(p => {
        const data = new Date(p.DataPedido).toLocaleDateString('pt-BR');
        const valor = parseFloat(p.ValorTotal || 0).toFixed(2).replace('.', ',');
        csvContent.push(`"${p.NumeroPedido}";"${data}";"${p.ClienteNome}";"${p.VendedorNome}";"${p.StatusPedido}";"${valor}"`);
    });
    const blob = new Blob(["\ufeff", csvContent.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "relatorio_vendas_atron.csv";
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

// === EDIÇÃO ===
async function abrirModalEdicao(id) {
    try {
        const res = await fetch(`${API_URL}/pedidos/${id}`);
        if (!res.ok) throw new Error('Erro ao buscar pedido');
        const pedido = await res.json();
        if (pedido.StatusPedido === 'Cancelado') { showNotification('Pedidos cancelados não podem ser editados.', 'warning'); return; }
        pedidoEmEdicaoID = id;
        const selProd = document.getElementById('edit-select-produto');
        selProd.innerHTML = '<option value="">Selecione...</option>';
        produtosDB.forEach(p => { const opt = document.createElement('option'); opt.value = p.ID; opt.textContent = p.NomeItem; opt.dataset.unidade = p.UnidadeMedida; opt.dataset.preco = p.PrecoConsumidor; selProd.appendChild(opt); });
        document.getElementById('edit-cliente-nome').value = pedido.ClienteNome; document.getElementById('edit-cliente-documento').value = pedido.ClienteDocumento || ''; document.getElementById('edit-cliente-endereco').value = pedido.ClienteEndereco || ''; document.getElementById('edit-cliente-cidade-uf').value = pedido.ClienteCidadeUF || ''; document.getElementById('edit-cliente-contato').value = pedido.ClienteContato || ''; document.getElementById('edit-cliente-email').value = pedido.ClienteEmail || ''; document.getElementById('edit-observacoes').value = pedido.Observacoes || ''; document.getElementById('edit-check-frete').checked = !!pedido.TemFrete; document.getElementById('edit-valor-frete').value = parseFloat(pedido.ValorFrete || 0).toFixed(2); document.getElementById('edit-desconto-geral').value = parseFloat(pedido.DescontoGeralPercent || 0).toFixed(2); toggleFreteEdicao();
        itensTempEdit = pedido.itens.map(item => ({ produtoId: item.ProdutoID, item: item.ItemNome, comprimento: parseFloat(item.Comprimento || 0), altura: parseFloat(item.Altura || 0), quantidade: parseFloat(item.Quantidade || 0), unidadeMedida: item.UnidadeMedida, valorUnitario: parseFloat(item.ValorUnitario), total: parseFloat(item.ValorTotalItem) }));
        renderizarItensEdicao(); atualizarTotaisEdicao(); limparCamposItemEdicao(); document.getElementById('modal-editar-pedido').classList.add('active');
    } catch (e) { showNotification(e.message, 'error'); }
}
function fecharModalEdicao() { document.getElementById('modal-editar-pedido').classList.remove('active'); pedidoEmEdicaoID = null; itensTempEdit = []; }
function updateEditFieldsVisibility() {
    const sel = document.getElementById('edit-select-produto'); const opt = sel.options[sel.selectedIndex]; const unidade = opt ? opt.dataset.unidade : ''; const nome = opt ? opt.textContent.toUpperCase() : ''; const gComp = document.getElementById('edit-group-comp'); const gAlt = document.getElementById('edit-group-alt'); const gQtd = document.getElementById('edit-group-qtd'); gComp.style.display = 'none'; gAlt.style.display = 'none'; gQtd.style.display = 'none'; if (!unidade) return; if (unidade === 'm²') { gComp.style.display = 'block'; gAlt.style.display = 'block'; } else if (unidade === 'm') { if (nome.includes('GUIA')) { gAlt.style.display = 'block'; gQtd.style.display = 'block'; } else { gComp.style.display = 'block'; gQtd.style.display = 'block'; } } else { gQtd.style.display = 'block'; }
}
function preencherDadosItemEdicao() { const sel = document.getElementById('edit-select-produto'); const opt = sel.options[sel.selectedIndex]; if (!opt || !opt.value) { limparCamposItemEdicao(); return; } document.getElementById('edit-item-unidade').value = opt.dataset.unidade; document.getElementById('edit-item-valor').value = parseFloat(opt.dataset.preco).toFixed(2); updateEditFieldsVisibility(); }
function limparCamposItemEdicao() { document.getElementById('edit-select-produto').value = ""; document.getElementById('edit-item-unidade').value = ""; document.getElementById('edit-item-comp').value = ""; document.getElementById('edit-item-alt').value = ""; document.getElementById('edit-item-qtd').value = "1"; document.getElementById('edit-item-valor').value = ""; updateEditFieldsVisibility(); }
function adicionarItemEdicao() {
    const sel = document.getElementById('edit-select-produto'); if (!sel.value) return showNotification('Selecione um produto', 'warning'); const opt = sel.options[sel.selectedIndex]; const unidade = opt.dataset.unidade; const nome = opt.textContent; const nomeUpper = nome.toUpperCase(); const valorUnit = parseFloat(document.getElementById('edit-item-valor').value) || 0; let comp = parseFloat(document.getElementById('edit-item-comp').value) || 0; let alt = parseFloat(document.getElementById('edit-item-alt').value) || 0; let qtd = parseFloat(document.getElementById('edit-item-qtd').value) || 0; let qtdCalc = 0; if (unidade === 'm²') { if (comp <= 0 || alt <= 0) return showNotification('Informe Altura e Comprimento', 'warning'); qtdCalc = comp * alt; qtd = 1; } else if (unidade === 'm') { if (nomeUpper.includes('GUIA')) { if (alt <= 0 || qtd <= 0) return showNotification('Informe Altura e Qtd', 'warning'); qtdCalc = alt * qtd; comp = 0; } else { if (comp <= 0 || qtd <= 0) return showNotification('Informe Comprimento e Qtd', 'warning'); qtdCalc = comp * qtd; alt = 0; } } else { if (qtd <= 0) return showNotification('Informe a Quantidade', 'warning'); qtdCalc = qtd; comp = 0; alt = 0; } const total = qtdCalc * valorUnit; itensTempEdit.push({ produtoId: parseInt(sel.value), item: nome, comprimento: comp, altura: alt, quantidade: qtdCalc, unidadeMedida: unidade, valorUnitario: valorUnit, total: total }); renderizarItensEdicao(); atualizarTotaisEdicao(); limparCamposItemEdicao();
}
function renderizarItensEdicao() { const tbody = document.getElementById('edit-itens-tbody'); tbody.innerHTML = ''; itensTempEdit.forEach((item, index) => { let displayComp = item.comprimento > 0 ? item.comprimento.toFixed(2) : '--'; let displayAlt = item.altura > 0 ? item.altura.toFixed(2) : '--'; let displayQtd = ''; if (item.unidadeMedida === 'm²') displayQtd = item.quantidade.toFixed(2) + ' m²'; else if (item.unidadeMedida === 'm') { let qtdUnit = 0; if (item.altura > 0) qtdUnit = item.quantidade / item.altura; else if (item.comprimento > 0) qtdUnit = item.quantidade / item.comprimento; displayQtd = Math.round(qtdUnit) + ' un'; } else displayQtd = item.quantidade + ' ' + item.unidadeMedida; const tr = document.createElement('tr'); tr.innerHTML = `<td>${item.item}</td><td class="text-right">${displayComp}</td><td class="text-right">${displayAlt}</td><td class="text-right">${displayQtd}</td><td class="text-right">${formatarMoeda(item.valorUnitario)}</td><td class="text-right">${formatarMoeda(item.total)}</td><td class="text-center"><button type="button" class="action-button delete" onclick="removerItemEdicao(${index})"><i class="fas fa-trash"></i></button></td>`; tbody.appendChild(tr); }); }
function removerItemEdicao(index) { itensTempEdit.splice(index, 1); renderizarItensEdicao(); atualizarTotaisEdicao(); }
function toggleFreteEdicao() { const check = document.getElementById('edit-check-frete'); document.getElementById('edit-valor-frete').style.display = check.checked ? 'inline-block' : 'none'; if (!check.checked) document.getElementById('edit-valor-frete').value = '0.00'; atualizarTotaisEdicao(); }
function atualizarTotaisEdicao() { const subtotal = itensTempEdit.reduce((acc, i) => acc + i.total, 0); const frete = parseFloat(document.getElementById('edit-valor-frete').value) || 0; const descPerc = parseFloat(document.getElementById('edit-desconto-geral').value) || 0; const total = (subtotal + frete) * (1 - descPerc / 100); document.getElementById('edit-valor-subtotal').textContent = formatarMoeda(subtotal); document.getElementById('edit-valor-total').textContent = formatarMoeda(total); }
async function salvarEdicaoPedido(e) {
    e.preventDefault(); if (itensTempEdit.length === 0) return showNotification('O pedido deve ter pelo menos um item.', 'warning'); const btn = document.getElementById('btn-salvar-edit'); btn.disabled = true; btn.textContent = 'Salvando...'; const subtotal = itensTempEdit.reduce((acc, i) => acc + i.total, 0); const frete = parseFloat(document.getElementById('edit-valor-frete').value) || 0; const descPerc = parseFloat(document.getElementById('edit-desconto-geral').value) || 0; const total = (subtotal + frete) * (1 - descPerc / 100); const payload = { clienteNome: document.getElementById('edit-cliente-nome').value, clienteDocumento: document.getElementById('edit-cliente-documento').value || '', clienteEndereco: document.getElementById('edit-cliente-endereco').value || '', clienteCidadeUF: document.getElementById('edit-cliente-cidade-uf').value || '', clienteContato: document.getElementById('edit-cliente-contato').value || '', clienteEmail: document.getElementById('edit-cliente-email').value || '', observacoes: document.getElementById('edit-observacoes').value || '', temFrete: document.getElementById('edit-check-frete').checked, valorFrete: frete, descontoGeralPercent: descPerc, subtotal: subtotal, valorTotal: total, itens: itensTempEdit };
    try { const res = await fetch(`${API_URL}/pedidos/${pedidoEmEdicaoID}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); let result; const responseText = await res.text(); try { result = JSON.parse(responseText); } catch (e) { throw new Error("O servidor retornou uma resposta inválida."); } if (!res.ok) throw new Error(result.error || 'Erro desconhecido ao salvar alterações'); showNotification('Pedido atualizado com sucesso!', 'success'); fecharModalEdicao(); await loadPedidos(); renderizarTabelaPedidos(); atualizarEstatisticasPedidos(); } catch (err) { showNotification(`Erro: ${err.message}`, 'error'); } finally { btn.disabled = false; btn.textContent = 'Salvar Alterações'; }
}
function abrirModalCancelamento(id) { pedidoParaCancelarId = id; const input = document.getElementById('input-motivo-cancelamento'); if(input) input.value = ''; document.getElementById('modal-motivo-cancelamento').classList.add('active'); }
function fecharModalCancelamento() { document.getElementById('modal-motivo-cancelamento').classList.remove('active'); pedidoParaCancelarId = null; }
async function confirmarCancelamento() { if (!pedidoParaCancelarId) return; const motivo = document.getElementById('input-motivo-cancelamento').value.trim(); if (motivo.length < 12) return showNotification('O motivo deve ter no mínimo 12 caracteres.', 'warning'); await atualizarStatusPedido(pedidoParaCancelarId, 'Cancelado', motivo); fecharModalCancelamento(); fecharModalViewPedido(); }
async function visualizarPedido(id) {
    const modal = document.getElementById('modal-visualizar-pedido'); const content = document.getElementById('view-pedido-content'); const divMotivo = document.getElementById('view-pedido-cancelamento'); if (!modal) return; content.innerHTML = '<p>Carregando dados...</p>'; if(divMotivo) divMotivo.style.display = 'none'; modal.classList.add('active');
    try {
        const res = await fetch(`${API_URL}/pedidos/${id}`); if (!res.ok) { const err = await response.json(); throw new Error(err.error || 'Falha ao buscar detalhes'); } const p = await res.json(); currentPedido = p;
        if(document.getElementById('view-pedido-title')) document.getElementById('view-pedido-title').textContent = `Pedido ${p.NumeroPedido}`;
        let html = `<div class="view-section"><h3>Dados do Pedido</h3><div class="view-info-grid"><div class="view-info-item"><span class="view-label">Cliente:</span><span class="view-value">${p.ClienteNome}</span></div><div class="view-info-item"><span class="view-label">Status:</span><span class="view-value">${p.StatusPedido}</span></div><div class="view-info-item"><span class="view-label">Data:</span><span class="view-value">${formatarData(p.DataPedido)}</span></div><div class="view-info-item"><span class="view-label">Vendedor:</span><span class="view-value">${p.VendedorNome}</span></div><div class="view-info-item"><span class="view-label">Contato:</span><span class="view-value">${p.ClienteContato || '--'}</span></div><div class="view-info-item"><span class="view-label">Email:</span><span class="view-value">${p.ClienteEmail || '--'}</span></div></div></div>`;
        html += `<div class="view-section"><h3>Itens (${p.itens.length})</h3><div class="itens-table-container"><table class="itens-table"><thead><tr><th>Item</th><th class="text-right">Comp. (m)</th><th class="text-right">Alt. (m)</th><th class="text-right">Qtd.</th><th class="text-right">Total</th></tr></thead><tbody>`;
        p.itens.forEach(i => { let compDisplay = '--', altDisplay = '--', qtdDisplay = ''; const nomeUpper = i.ItemNome.toUpperCase(); const unidade = i.UnidadeMedida.toLowerCase(); if (unidade === 'm²') { compDisplay = parseFloat(i.Comprimento).toFixed(2); altDisplay = parseFloat(i.Altura).toFixed(2); qtdDisplay = `${parseFloat(i.Quantidade).toFixed(2)} m²`; } else if (unidade === 'm' && nomeUpper.includes('GUIA')) { altDisplay = parseFloat(i.Altura).toFixed(2); qtdDisplay = `${i.Quantidade} un`; } else if (unidade === 'm' && (nomeUpper.includes('SOLEIRA') || nomeUpper.includes('TUBO'))) { compDisplay = parseFloat(i.Comprimento).toFixed(2); qtdDisplay = `${i.Quantidade} un`; } else { let u = i.UnidadeMedida; if (u === 'Unidade') u = 'un'; qtdDisplay = `${i.Quantidade} ${u}`; } html += `<tr><td>${i.ItemNome}</td><td class="text-right">${compDisplay}</td><td class="text-right">${altDisplay}</td><td class="text-right">${qtdDisplay}</td><td class="text-right"><strong>${formatarMoeda(i.ValorTotalItem)}</strong></td></tr>`; }); html += `</tbody></table></div></div>`; content.innerHTML = html;
        if (p.StatusPedido === 'Cancelado' && p.MotivoCancelamento && divMotivo) { document.getElementById('view-motivo-cancelamento').textContent = p.MotivoCancelamento; divMotivo.style.display = 'block'; }
        const btnProd = document.getElementById('btn-iniciar-producao'); const btnConc = document.getElementById('btn-concluir-pedido'); const btnCanc = document.getElementById('btn-cancelar-pedido-modal');
        if(btnProd) btnProd.style.display = 'none'; if(btnConc) btnConc.style.display = 'none'; if(btnCanc) btnCanc.style.display = 'none';
        if (p.StatusPedido.includes('Aguardando Produção')) { if(btnProd) btnProd.style.display = 'inline-flex'; if(btnCanc) btnCanc.style.display = 'inline-flex'; } else if (p.StatusPedido === 'Em Produção' || p.StatusPedido === 'Pedido Alterado') { if(btnConc) btnConc.style.display = 'inline-flex'; if(btnCanc) btnCanc.style.display = 'inline-flex'; }
    } catch (e) { showNotification(e.message, 'error'); fecharModalViewPedido(); }
}
async function atualizarStatusPedido(id, novoStatus, motivo = null) { try { const payload = { status: novoStatus, motivo }; const res = await fetch(`${API_URL}/pedidos/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); if (!res.ok) throw new Error('Erro ao atualizar status'); showNotification(`Status atualizado para: ${novoStatus}`, 'success'); await loadPedidos(); renderizarTabelaPedidos(); atualizarEstatisticasPedidos(); if (document.getElementById('modal-visualizar-pedido').classList.contains('active') && currentPedido && currentPedido.ID === id) visualizarPedido(id); } catch (e) { showNotification(`Erro ao atualizar status: ${e.message}`, 'error'); } }
function fecharModalViewPedido() { document.getElementById('modal-visualizar-pedido').classList.remove('active'); currentPedido = null; }
function populateVendedorFilterPedidos() { const sel = document.getElementById('filter-vendedor-pedidos'); if (!sel) return; sel.innerHTML = '<option value="all">Todos os Vendedores</option>'; [...new Set(allPedidos.map(p => p.VendedorNome))].sort().forEach(v => sel.innerHTML += `<option value="${v}">${v}</option>`); }
function calcularNumLaminas(nomeItem, alturaMetros) { if (!alturaMetros || alturaMetros <= 0) return ''; const alturaCm = alturaMetros * 100; if (nomeItem.includes('Super Cana')) return Math.ceil(alturaCm / 10.0); if (nomeItem.includes('Cana')) return Math.ceil(alturaCm / 7.5); return ''; }
async function exportarOrdemProducaoPDF(pedidoID, modo = 'download') {
    showNotification('Gerando Ordem de Produção... Aguarde.', 'info'); let pedido = currentPedido && currentPedido.ID === pedidoID ? currentPedido : null; if (!pedido) { try { const res = await fetch(`${API_URL}/pedidos/${pedidoID}`); if (!res.ok) throw new Error('Falha ao buscar dados'); pedido = await res.json(); } catch (e) { return showNotification(e.message, 'error'); } }
    const { jsPDF } = window.jspdf; const doc = new jsPDF(); const MARGEM = 15; let posY = 20;
    doc.setFont('Helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor('#2c3e50'); doc.text("ATRON", MARGEM, posY); doc.setFontSize(16); doc.text("ORDEM DE PRODUÇÃO", 195, posY, { align: "right" }); posY += 15;
    doc.setFontSize(10); doc.text(`Pedido: ${pedido.NumeroPedido}`, MARGEM, posY); doc.text(`Cliente: ${pedido.ClienteNome}`, MARGEM, posY + 5); doc.text(`Data: ${formatarData(pedido.DataPedido)}`, MARGEM, posY + 10); doc.text(`Vendedor: ${pedido.VendedorNome}`, MARGEM, posY + 15); posY += 25;
    const tableBody = pedido.itens.sort((a,b)=>a.ItemNome.localeCompare(b.ItemNome)).map((item, idx) => {
        const nomeUpper = item.ItemNome.toUpperCase(); const uni = item.UnidadeMedida.toLowerCase(); let c='--', a='--', q=item.Quantidade; if (uni === 'm²') { c=parseFloat(item.Comprimento).toFixed(3); a=parseFloat(item.Altura).toFixed(3); q=parseFloat(item.Quantidade).toFixed(2)+'m²'; } else if (uni === 'm') { if(nomeUpper.includes('GUIA')) a=parseFloat(item.Altura).toFixed(3); else c=parseFloat(item.Comprimento).toFixed(3); } let laminas = calcularNumLaminas(item.ItemNome, item.Altura); let transv = item.ItemNome.includes('Transvision') ? 'Sim' : '--'; let fechada = item.ItemNome.includes('Cana') && !item.ItemNome.includes('Transvision') ? 'Sim' : '--'; return [String(idx+1).padStart(3,'0'), item.ItemNome, c, a, q, laminas, transv, fechada];
    });
    doc.autoTable({ head: [[{content:'Item', rowSpan:2}, {content:'Descrição', rowSpan:2}, {content:'Dimensional', colSpan:2}, {content:'Qtd', rowSpan:2}, {content:'Tipo Lâmina', colSpan:3}], ['Comp(m)', 'Alt(m)', 'Lâminas', 'Transv', 'Fechada']], body: tableBody, startY: posY, theme: 'grid', styles: { fontSize: 9, cellPadding: 2 }, headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold', halign: 'center', valign: 'middle' }, columnStyles: { 2:{halign:'right'}, 3:{halign:'right'}, 4:{halign:'center'}, 5:{halign:'center'}, 6:{halign:'center'}, 7:{halign:'center'} } });
    if (modo === 'view') doc.output('dataurlnewwindow'); else doc.save(`OP_${pedido.NumeroPedido}.pdf`);
}
window.abrirModalCancelamento = abrirModalCancelamento; window.visualizarPedido = visualizarPedido; window.abrirModalEdicao = abrirModalEdicao; window.removerItemEdicao = removerItemEdicao;
function getLoggedInUserID() { return localStorage.getItem(USER_ID_KEY) || sessionStorage.getItem(USER_ID_KEY); }
function getLoggedInUserRole() { return localStorage.getItem(USER_ROLE_KEY) || sessionStorage.getItem(USER_ROLE_KEY); }
function getLoggedInUserFullName() { return localStorage.getItem(USER_NAME_KEY) || sessionStorage.getItem(USER_NAME_KEY); }
function formatarMoeda(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(v)||0); }
function formatarData(d) { return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR'); }
function showNotification(msg, type) { if (window.NotificationManager) window.NotificationManager.show({ title: type, message: msg, type: type }); else alert(msg); }