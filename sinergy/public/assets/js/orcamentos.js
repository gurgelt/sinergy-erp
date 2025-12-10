/**
 * js/orcamentos.js - Versão Final Completa (Corrigida e Otimizada)
 * Correção: Ajuste na API_URL para '/sinergy/api' e tratamento de erros de carga.
 */

document.addEventListener('DOMContentLoaded', () => {
    if (typeof ChartDataLabels !== 'undefined') {
        Chart.register(ChartDataLabels);
    }
    initializeApp();
});

// === CONSTANTES E VARIÁVEIS GLOBAIS ===
// CORREÇÃO PRINCIPAL: Adicionado '/sinergy' no caminho da API
const API_URL = 'https://virtualcriacoes.com/sinergy/api';

let orcamentos = []; 
let produtosDB = []; 
let tipoOrcamentoAtual = null; 
let itensTemp = []; 
let orcamentoAtual = null; 
let orcamentoParaExcluir = null;
let modalMode = 'create';
let currentUserID = null;
let currentUserRole = null;
let allClientes = []; 
let currentEditClienteID = null; 
let clienteParaExcluir = null;  
let assistenteAlturaFinal = null; 
let assistenteComprimentoFinal = null;
let assistenteKitTipo = null;
let assistenteClienteSelecionado = null;
let assistenteTipoMotor = 'AC';
let isAddingFromAssistant = false; 

// Variáveis de Paginação
let currentPage = 1;
const itemsPerPage = 10;
let filteredOrcamentos = [];

// Variáveis dos Gráficos
let chartStatusInstance = null;
let chartValoresInstance = null;
let chartVendedorInstance = null;

// === DADOS TÉCNICOS (Fatores de Engenharia) ===
const DADOS_TECNICOS_LAMINAS = {
    '1/2 Cana Galvanizada (Fechada)': { fator: 0.8, alturaCm: 7.5 },
    '1/2 Cana Transvision (Furada)': { fator: 0.7, alturaCm: 7.5 },
    'Super Cana': { fator: 1.48, alturaCm: 10.0 }
};

const DESCRICOES_ITENS = {
    '1/2 Cana Galvanizada': 'Lâmina fechada em aço galvanizado. Maior segurança e privacidade.',
    '1/2 Cana Transvision': 'Lâmina com microfuros. Permite ventilação e visualização interna.',
    'Super Cana': 'Lâmina reforçada (10cm). Ideal para grandes vãos e resistência ao vento.',
    'Tubo Octogonal': 'Eixo superior onde a porta se enrola. Dimensionado conforme o peso.',
    'Guia': 'Perfil lateral (trilho) por onde a porta corre.',
    'Soleira': "Perfil inferior reforçado em 'L' ou 'T'. Garante rigidez e acabamento.",
    'Motor AC': 'Motor de corrente alternada. Robusto e eficiente para uso padrão.',
    'Motor DC': 'Motor com NOBREAK integrado. Funciona mesmo sem energia elétrica.',
    'Trava': 'Peças laterais que impedem o deslizamento horizontal das lâminas.',
    'Perfil PVC': 'Fita aplicada nas guias para reduzir atrito e ruído.',
    'Borracha': 'Acabamento amortecedor para a soleira. Melhora a vedação.',
    'Antiqueda': 'Dispositivo de segurança. Trava a porta em caso de falha do motor.',
    'Central': 'Placa eletrônica de comando para controles remotos.',
    'Controle': 'Transmissor para acionamento à distância.',
    'KIT CENTRAL': 'Kit contendo central receptora e controles remotos.'
};

function getItemDescription(nomeItem) {
    if (!nomeItem) return null;
    const nomeUpper = nomeItem.toUpperCase();
    for (const [chave, desc] of Object.entries(DESCRICOES_ITENS)) {
        if (nomeUpper.includes(chave.toUpperCase())) return desc;
    }
    return null;
}

const MOTORES_DISPONIVEIS = [
    { peso: 200, alturaMax: 4.0, nome: 'AC 200 (J) CONJUNTO' },
    { peso: 300, alturaMax: 6.0, nome: 'AC 300 (J) CONJUNTO' },
    { peso: 400, alturaMax: 6.0, nome: 'AC 400 (J) CONJUNTO' },
    { peso: 500, alturaMax: 6.0, nome: 'AC 500 (J) CONJUNTO' },
    { peso: 600, alturaMax: 6.0, nome: 'AC 600 (J) CONJUNTO' },
    { peso: 700, alturaMax: 6.0, nome: 'AC 700 (J) CONJUNTO' },
    { peso: 800, alturaMax: 7.0, nome: 'AC 800 (J) CONJUNTO' },
    { peso: 1000, alturaMax: 7.0, nome: 'AC 1000 (J) CONJUNTO' },
    { peso: 1500, alturaMax: 8.0, nome: 'AC 1500 (J) 220V CONJUNTO' },
    { peso: 1500, alturaMax: 8.0, nome: 'AC 1500 (J) 380V CONJUNTO' },
    { peso: 2000, alturaMax: 8.0, nome: 'AC 2000 (J) 220V CONJUNTO' },
    { peso: 2000, alturaMax: 8.0, nome: 'AC 2000 (J) 380V CONJUNTO' }
];

const MOTORES_DC_DISPONIVEIS = [
    { peso: 200, alturaMax: 4.0, nome: 'DC 200 (J) CONJUNTO' },
    { peso: 300, alturaMax: 6.0, nome: 'DC 300 (J) CONJUNTO' },
    { peso: 400, alturaMax: 6.0, nome: 'DC 400 (J) CONJUNTO' },
    { peso: 500, alturaMax: 6.0, nome: 'DC 500 (J) CONJUNTO' },
    { peso: 600, alturaMax: 6.0, nome: 'DC 600 (J) CONJUNTO' },
    { peso: 700, alturaMax: 6.0, nome: 'DC 700 (J) CONJUNTO' }
];

// === INICIALIZAÇÃO ===
async function initializeApp() {
    currentUserID = window.getLoggedInUserID(); 
    currentUserRole = window.getLoggedInUserRole(); 

    if (!currentUserID || !currentUserRole) {
        showNotification('Erro de sessão. Você não está logado.', 'error');
        return;
    }
    
    initGlobalTooltip();
    setupEventListeners();
    
    // Carregamento inicial
    try {
        await Promise.all([
            loadProdutos(),
            loadOrcamentos(),
            loadClientes(),
            loadVendedoresParaSelect()
        ]);

        populateVendedorFilter();
        renderizarTabela();
        atualizarEstatisticas();
    } catch (error) {
        console.error("Erro na inicialização:", error);
        showNotification('Erro ao conectar com o servidor.', 'error');
    }

    const loader = document.getElementById('loader-overlay');
    if (loader) loader.style.display = 'none';
}

// === CARREGAMENTO DE DADOS ===
async function loadProdutos() {
    try {
        const response = await fetch(`${API_URL}/produtos`);
        if (response.ok) produtosDB = await response.json();
    } catch (error) { console.error("Erro produtos:", error); }
}

async function loadOrcamentos() {
    try {
        let url = `${API_URL}/orcamentos`;
        if (currentUserRole !== 'admin') url += `?usuarioID=${currentUserID}`;
        const response = await fetch(url);
        if (response.ok) orcamentos = await response.json();
    } catch (error) { 
        console.error("Erro orçamentos:", error);
        orcamentos = []; 
    }
}

async function loadClientes() {
    try {
        // Garante que a query string está correta
        let url = `${API_URL}/clientes?role=${currentUserRole}`;
        if (currentUserRole !== 'admin') url += `&usuarioID=${currentUserID}`;
        
        const res = await fetch(url);
        if (res.ok) {
            allClientes = await res.json();
        } else {
            throw new Error('Falha ao buscar clientes');
        }
    } catch (e) { 
        console.error("Erro clientes:", e);
        allClientes = [];
    }
}

async function loadVendedoresParaSelect() {
    try {
        const response = await fetch(`${API_URL}/vendedores`);
        const select = document.getElementById('cliente-vendedor');
        if (!select) return;
        
        // Limpa e adiciona opção padrão
        select.innerHTML = '<option value="">Selecione o vendedor...</option>';
        
        if (response.ok) {
            const vendedores = await response.json();
            vendedores.forEach(nome => {
                const opt = document.createElement('option');
                opt.value = nome; 
                opt.textContent = nome;
                select.appendChild(opt);
            });
            
            // Seleciona automaticamente o usuário atual se ele for um vendedor
            const currentUser = window.getLoggedInUserFullName();
            if (currentUser && vendedores.includes(currentUser)) {
                select.value = currentUser;
            }
        }
    } catch (error) { 
        console.error("Erro vendedores:", error);
        const select = document.getElementById('cliente-vendedor');
        if(select) select.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

// === EVENT LISTENERS ===
function setupEventListeners() {
    const addListener = (id, event, handler) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, handler);
    };

    // Navegação de Abas
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
            btn.classList.add('active');
            const targetId = btn.dataset.tab;
            document.getElementById(targetId).style.display = 'block';
            
            if (targetId === 'view-relatorios') renderizarDashboardOrcamentos();
        });
    });

    // Excel
    addListener('btn-exportar-excel-orcamentos', 'click', exportarRelatorioExcel);

    // Modais de Tipo e Kit
    addListener('btn-novo-orcamento', 'click', abrirModalTipo);
    addListener('close-tipo-modal', 'click', fecharModalTipo);
    addListener('close-kit-modal', 'click', fecharModalKit);
    addListener('close-motor-modal', 'click', fecharModalTipoMotor);

    // Botões de Seleção (Delegation)
    const typeButtons = document.getElementById('orcamento-selection-buttons');
    if (typeButtons) {
        typeButtons.addEventListener('click', (e) => {
            const button = e.target.closest('.btn-tipo');
            if (button && button.dataset.tipo) selecionarTipoOrcamento(button.dataset.tipo);
        });
    }
    const kitButtons = document.getElementById('kit-selection-buttons');
    if (kitButtons) {
        kitButtons.addEventListener('click', (e) => {
            const button = e.target.closest('.btn-tipo');
            if (button && button.dataset.kit) selecionarTipoKit(button.dataset.kit);
        });
    }
    const motorButtons = document.getElementById('motor-selection-buttons');
    if (motorButtons) {
        motorButtons.addEventListener('click', (e) => {
            const button = e.target.closest('.btn-tipo');
            if (button && button.dataset.motor) selecionarTipoMotor(button.dataset.motor);
        });
    }

    // Clientes
    addListener('btn-cadastrar-cliente', 'click', abrirModalCliente);
    addListener('close-cliente-modal', 'click', fecharModalCliente);
    addListener('btn-cancelar-cliente', 'click', fecharModalCliente);
    addListener('form-cliente', 'submit', salvarCliente);
    addListener('btn-ver-clientes', 'click', abrirModalListaClientes);
    addListener('close-lista-clientes-modal', 'click', fecharModalListaClientes);
    addListener('search-cliente-modal', 'input', renderizarTabelaClientes);
    addListener('btn-add-endereco-extra', 'click', () => adicionarLinhaEnderecoExtra());

    // Tabela Clientes
    const clientesTbody = document.getElementById('clientes-tbody');
    if (clientesTbody) {
        clientesTbody.addEventListener('click', (e) => {
            const btn = e.target.closest('.action-button');
            if (!btn) return;
            e.stopPropagation();
            const id = parseInt(btn.closest('.table-actions').dataset.clientId);
            if (btn.classList.contains('edit')) abrirModalEditarCliente(id);
        });
    }

    // Combobox Cliente
    const clienteInput = document.getElementById('input-cliente-nome');
    const optionsContainer = document.getElementById('clientes-list-options');
    if (clienteInput) {
        clienteInput.addEventListener('input', filterAndShowClienteDropdown);
        clienteInput.addEventListener('focus', filterAndShowClienteDropdown);
    }
    if (optionsContainer) {
        optionsContainer.addEventListener('click', (e) => {
            const item = e.target.closest('.combobox-option-item');
            if (item) selectCliente(item.dataset.id);
        });
    }
    document.addEventListener('click', (e) => {
        const box = document.getElementById('cliente-combobox');
        if (box && optionsContainer && !box.contains(e.target)) optionsContainer.classList.remove('visible');
    });

    // Modal Orçamento
    addListener('close-modal', 'click', fecharModal);
    addListener('btn-cancelar', 'click', fecharModal);
    addListener('form-orcamento', 'submit', salvarOrcamento);
    addListener('btn-adicionar-item', 'click', adicionarItem);
    
    const selectProduto = document.getElementById('select-item-produto');
    if (selectProduto) {
        selectProduto.addEventListener('change', () => {
            preencherDadosItem();
            atualizarInfoTecnica();
        });
    }
    
    addListener('input-item-altura', 'input', atualizarInfoTecnica);
    addListener('input-item-comprimento', 'input', atualizarInfoTecnica);
    addListener('check-frete', 'change', toggleFrete);
    addListener('input-valor-frete', 'input', atualizarTotaisFinais);
    addListener('input-desconto-geral', 'input', atualizarTotaisFinais);

    // Tabela Itens (Modal)
    const itensTbody = document.getElementById('itens-tbody');
    if (itensTbody) {
        itensTbody.addEventListener('click', (e) => {
            const editButton = e.target.closest('.action-button.edit');
            if (editButton) iniciarEdicaoItem(parseInt(editButton.dataset.index));
            const deleteButton = e.target.closest('.action-button.delete');
            if (deleteButton) removerItemTemp(parseInt(deleteButton.dataset.index));
        });
    }

    // Filtros e Paginação
    const resetPageAndRender = () => { currentPage = 1; renderizarTabela(true); };
    addListener('search-input', 'input', resetPageAndRender);
    addListener('filter-status', 'change', resetPageAndRender);
    addListener('filter-vendedor', 'change', resetPageAndRender);
    
    const dateRange = document.getElementById('filter-date-range');
    if (dateRange) {
        dateRange.addEventListener('change', () => {
            const custom = document.getElementById('custom-date-range');
            if (custom) custom.classList.toggle('active', dateRange.value === 'custom');
            resetPageAndRender();
        });
    }
    addListener('filter-date-start', 'change', resetPageAndRender);
    addListener('filter-date-end', 'change', resetPageAndRender);

    // Botões Paginação
    document.getElementById('btn-prev-page').addEventListener('click', () => {
        if (currentPage > 1) { currentPage--; renderizarTabela(false); }
    });
    document.getElementById('btn-next-page').addEventListener('click', () => {
        const totalPages = Math.ceil(filteredOrcamentos.length / itemsPerPage);
        if (currentPage < totalPages) { currentPage++; renderizarTabela(false); }
    });

    // Visualização
    addListener('close-view-modal', 'click', fecharModalView);
    addListener('btn-fechar-view', 'click', fecharModalView);
    const btnAprovar = document.getElementById('btn-aprovar');
    if (btnAprovar) btnAprovar.addEventListener('click', () => atualizarStatusOrcamento('aprovado'));
    const btnRejeitar = document.getElementById('btn-rejeitar');
    if (btnRejeitar) btnRejeitar.addEventListener('click', () => atualizarStatusOrcamento('rejeitado'));
    const btnBaixar = document.getElementById('btn-baixar-pdf');
    if (btnBaixar) btnBaixar.addEventListener('click', () => exportarPDF(orcamentoAtual?.ID, 'download'));
    const btnVisu = document.getElementById('btn-visualizar-pdf');
    if (btnVisu) btnVisu.addEventListener('click', () => exportarPDF(orcamentoAtual?.ID, 'view'));

    // Modal de Aviso (Validação Cliente)
    addListener('close-aviso-cliente', 'click', fecharModalAvisoCliente);
    addListener('btn-cancelar-aviso', 'click', fecharModalAvisoCliente);
    addListener('btn-ir-cadastro', 'click', redirecionarParaCadastro);
    
    // Exclusão
    addListener('close-exclusao-modal', 'click', fecharModalExclusao);
    addListener('btn-cancelar-exclusao', 'click', fecharModalExclusao);
    addListener('btn-confirmar-exclusao', 'click', executarExclusao);

    // Assistente
    addListener('close-assistente-cliente-modal', 'click', fecharModalAssistenteCliente);
    addListener('btn-cancelar-assistente-cliente', 'click', fecharModalAssistenteCliente);
    addListener('btn-proximo-assistente-cliente', 'click', assistentePassoMedidas);
    addListener('close-assistente-medidas-modal', 'click', fecharModalAssistenteMedidas);
    addListener('btn-voltar-assistente-medidas', 'click', assistenteVoltarParaCliente);
    addListener('btn-confirmar-assistente-medidas', 'click', assistenteConfirmarMedidas);

    const btnNovoClienteAssistente = document.getElementById('btn-assistente-novo-cliente');
    if (btnNovoClienteAssistente) {
        btnNovoClienteAssistente.addEventListener('click', () => {
            isAddingFromAssistant = true;
            fecharModalAssistenteCliente();
            abrirModalCliente();
        });
    }

    const assInput = document.getElementById('input-assistente-cliente-nome');
    const assOptions = document.getElementById('assistente-clientes-list-options');
    if (assInput) {
        assInput.addEventListener('input', filterAndShowAssistenteClienteDropdown);
        assInput.addEventListener('focus', filterAndShowAssistenteClienteDropdown);
    }
    if (assOptions) {
        assOptions.addEventListener('click', (e) => {
            const item = e.target.closest('.combobox-option-item');
            if (item) selectAssistenteCliente(item.dataset.id);
        });
    }
    document.addEventListener('click', (e) => {
        const box = document.getElementById('assistente-cliente-combobox');
        if (box && assOptions && !box.contains(e.target)) assOptions.classList.remove('visible');
    });
}

// === RENDERIZAÇÃO DA TABELA COM PAGINAÇÃO ===
function renderizarTabela(reFilter = true) {
    const tbody = document.getElementById('orcamentos-tbody');
    if (!tbody) return;
    
    if (reFilter) {
        const searchTerm = document.getElementById('search-input').value.toLowerCase();
        const stat = document.getElementById('filter-status').value;
        const vend = document.getElementById('filter-vendedor').value;
        const dateRange = document.getElementById('filter-date-range').value;
        const dateStartInput = document.getElementById('filter-date-start').value;
        const dateEndInput = document.getElementById('filter-date-end').value;
        let startDate = null;
        let endDate = new Date(); endDate.setHours(23, 59, 59, 999); 

        if (dateRange !== 'all' && dateRange !== 'custom') {
            startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(dateRange));
            startDate.setHours(0, 0, 0, 0); 
        } else if (dateRange === 'custom') {
            if (dateStartInput) startDate = new Date(dateStartInput + 'T00:00:00');
            if (dateEndInput) endDate = new Date(dateEndInput + 'T23:59:59');
        }

        filteredOrcamentos = orcamentos.filter(o => {
            const matchS = (o.ClienteNome || '').toLowerCase().includes(searchTerm) || (o.NumeroOrcamento || '').toLowerCase().includes(searchTerm) || (o.VendedorNome || '').toLowerCase().includes(searchTerm);
            const matchSt = stat === 'todos' || o.Status === stat;
            const matchV = (currentUserRole !== 'admin' || vend === 'all') || o.VendedorNome === vend;
            let matchDate = true;
            if (startDate) {
                const orcDate = new Date(o.DataOrcamento + 'T00:00:00');
                if (orcDate < startDate || orcDate > endDate) matchDate = false;
            }
            return matchS && matchSt && matchV && matchDate;
        });
        
        filteredOrcamentos.sort((a, b) => b.ID - a.ID);
    }

    // Paginação
    const totalItems = filteredOrcamentos.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
    
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const itemsToShow = filteredOrcamentos.slice(startIndex, endIndex);

    document.getElementById('page-info').textContent = `Página ${currentPage} de ${totalPages}`;
    document.getElementById('btn-prev-page').disabled = currentPage === 1;
    document.getElementById('btn-next-page').disabled = currentPage === totalPages;

    tbody.innerHTML = '';
    if (totalItems === 0) return tbody.innerHTML = '<tr><td colspan="8" class="text-center">Nenhum orçamento encontrado</td></tr>';

    itemsToShow.forEach(orc => {
        let acoesHTML = '';
        if (orc.Status === 'pendente') {
            acoesHTML += `<button class="action-button quick-approve" data-id="${orc.ID}" title="Aprovar"><i class="fas fa-check-circle" style="font-size: 1.1em;"></i></button><button class="action-button quick-reject" data-id="${orc.ID}" title="Rejeitar"><i class="fas fa-times-circle" style="font-size: 1.1em;"></i></button><button class="action-button edit" data-id="${orc.ID}" title="Editar"><i class="fas fa-edit"></i></button>`;
        }
        acoesHTML += `<button class="action-button view" data-id="${orc.ID}" title="Visualizar"><i class="fas fa-eye"></i></button><button class="action-button view-pdf" data-id="${orc.ID}" data-mode="view" title="PDF"><i class="fas fa-search-plus"></i></button><button class="action-button download" data-id="${orc.ID}" data-mode="download" title="Baixar"><i class="fas fa-file-pdf"></i></button>`;

        const tr = document.createElement('tr');
        tr.innerHTML = `<td><strong>${orc.NumeroOrcamento}</strong></td><td>${orc.ClienteNome}</td><td>${orc.TipoOrcamento === 'serralheria' ? 'Serralheria' : 'Cons. Final'}</td><td>${formatarData(orc.DataOrcamento)}</td><td><strong>${formatarMoeda(orc.ValorTotal)}</strong></td><td>${orc.VendedorNome}</td><td><span class="status-badge ${orc.Status}">${orc.Status}</span></td><td class="text-center"><div class="table-actions">${acoesHTML}</div></td>`;
        tbody.appendChild(tr);
    });

    // Re-anexa listeners
    tbody.querySelectorAll('.action-button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(btn.dataset.id);
            if (btn.classList.contains('view')) visualizarOrcamento(id);
            else if (btn.classList.contains('view-pdf')) exportarPDF(id, btn.dataset.mode);
            else if (btn.classList.contains('download')) exportarPDF(id, 'download');
            else if (btn.classList.contains('edit')) editarOrcamento(id);
            else if (btn.classList.contains('quick-approve')) atualizarStatusOrcamento(id, 'aprovado');
            else if (btn.classList.contains('quick-reject')) atualizarStatusOrcamento(id, 'rejeitado');
        });
    });
}

// === DASHBOARD E RELATÓRIOS ===
function renderizarDashboardOrcamentos() {
    renderChartStatus();
    renderChartValoresStatus();
    renderChartVendedores();
}

function renderChartStatus() {
    const ctx = document.getElementById('graficoStatusOrcamento');
    if (!ctx) return;
    const stats = { pendente: 0, aprovado: 0, rejeitado: 0 };
    orcamentos.forEach(o => { if (stats[o.Status] !== undefined) stats[o.Status]++; });

    if (chartStatusInstance) chartStatusInstance.destroy();
    chartStatusInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Pendente', 'Aprovado', 'Rejeitado'],
            datasets: [{
                data: [stats.pendente, stats.aprovado, stats.rejeitado],
                backgroundColor: ['#f1c40f', '#2ecc71', '#e74c3c'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 12 } },
                datalabels: { color: '#fff', font: { weight: 'bold' }, formatter: (v) => v > 0 ? v : '' }
            }, layout: { padding: 10 }
        }
    });
}

function renderChartValoresStatus() {
    const ctx = document.getElementById('graficoValoresStatus');
    if (!ctx) return;
    const vals = { pendente: 0, aprovado: 0, rejeitado: 0 };
    orcamentos.forEach(o => { if (vals[o.Status] !== undefined) vals[o.Status] += parseFloat(o.ValorTotal || 0); });

    if (chartValoresInstance) chartValoresInstance.destroy();
    chartValoresInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Pendente', 'Aprovado', 'Rejeitado'],
            datasets: [{
                label: 'Valor Total (R$)',
                data: [vals.pendente, vals.aprovado, vals.rejeitado],
                backgroundColor: ['rgba(241, 196, 15, 0.7)', 'rgba(46, 204, 113, 0.7)', 'rgba(231, 76, 60, 0.7)'],
                borderColor: ['#f1c40f', '#2ecc71', '#e74c3c'],
                borderWidth: 1, borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false, layout: { padding: { right: 50 } },
            plugins: { legend: { display: false }, datalabels: { anchor: 'end', align: 'right', color: '#334155', formatter: (v) => formatarMoeda(v) } }
        }
    });
}

function renderChartVendedores() {
    const ctx = document.getElementById('graficoVendedorOrcamento');
    if (!ctx) return;
    const dados = {};
    orcamentos.forEach(o => {
        if (o.Status === 'aprovado') {
            const vend = o.VendedorNome || 'N/A';
            if (!dados[vend]) dados[vend] = 0;
            dados[vend] += parseFloat(o.ValorTotal || 0);
        }
    });
    const sorted = Object.entries(dados).sort((a, b) => b[1] - a[1]);

    if (chartVendedorInstance) chartVendedorInstance.destroy();
    chartVendedorInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(i => i[0]),
            datasets: [{ label: 'Valor Aprovado (R$)', data: sorted.map(i => i[1]), backgroundColor: 'rgba(52, 152, 219, 0.7)', borderColor: '#3498db', borderWidth: 1, borderRadius: 4 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, layout: { padding: { top: 25 } },
            plugins: { legend: { display: false }, datalabels: { anchor: 'end', align: 'top', color: '#334155', formatter: (v) => 'R$ ' + v.toLocaleString('pt-BR', {compactDisplay: "short", notation: "compact"}) } }
        }
    });
}

function exportarRelatorioExcel() {
    let csvContent = [];
    csvContent.push("Relatório de Orçamentos;;;;;");
    csvContent.push(`Gerado em: ${new Date().toLocaleDateString('pt-BR')};;;;;`);
    csvContent.push("");
    csvContent.push("Número;Data;Cliente;Vendedor;Status;Valor Total");
    orcamentos.forEach(o => {
        const data = new Date(o.DataOrcamento).toLocaleDateString('pt-BR');
        const valor = parseFloat(o.ValorTotal || 0).toFixed(2).replace('.', ',');
        csvContent.push(`"${o.NumeroOrcamento}";"${data}";"${o.ClienteNome}";"${o.VendedorNome}";"${o.Status}";"${valor}"`);
    });
    const blob = new Blob(["\ufeff", csvContent.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "relatorio_orcamentos_atron.csv";
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

// === MODAIS E FLUXO ===
function abrirModalTipo() { document.getElementById('modal-tipo-orcamento').classList.add('active'); }
function fecharModalTipo() { document.getElementById('modal-tipo-orcamento').classList.remove('active'); }
function selecionarTipoOrcamento(tipo) { tipoOrcamentoAtual = tipo; fecharModalTipo(); abrirModalKit(); }
function abrirModalKit() { document.getElementById('modal-tipo-kit').classList.add('active'); }
function fecharModalKit() { document.getElementById('modal-tipo-kit').classList.remove('active'); }
function abrirModalTipoMotor() { document.getElementById('modal-tipo-motor').classList.add('active'); }
function fecharModalTipoMotor() { document.getElementById('modal-tipo-motor').classList.remove('active'); }

function selecionarTipoKit(kitTipo) { 
    assistenteKitTipo = kitTipo; 
    fecharModalKit(); 
    if (kitTipo === 'manual') abrirModal('create'); 
    else if (kitTipo === 'automatica') abrirModalTipoMotor(); 
    else { assistenteTipoMotor = null; abrirModalAssistenteCliente(); } 
}

function selecionarTipoMotor(tipo) { 
    assistenteTipoMotor = tipo; 
    fecharModalTipoMotor(); 
    abrirModalAssistenteCliente(); 
}

function fecharModal() { document.getElementById('modal-orcamento').classList.remove('active'); limparFormulario(); }
function fecharModalView() { document.getElementById('modal-visualizar').classList.remove('active'); orcamentoAtual = null; }
function fecharModalExclusao() { document.getElementById('modal-confirmar-exclusao').classList.remove('active'); orcamentoParaExcluir = null; }

function abrirModal(mode, prefillData = null) {
    modalMode = mode; const btnSalvar = document.getElementById('btn-salvar');
    if (mode === 'create') {
        if (!prefillData) limparFormulario(); else {
            document.getElementById('form-orcamento').reset(); itensTemp = []; orcamentoAtual = null;
            renderizarItensTemp(); atualizarTotaisFinais();
            document.getElementById('input-valor-frete').style.display = 'none'; document.getElementById('check-frete').checked = false;
            atualizarVisibilidadeCamposItem(null, null); limparCamposItem();
        }
        document.getElementById('input-numero-orcamento').value = "";
        const title = document.getElementById('modal-title'); const labelDoc = document.getElementById('label-documento'); const inputDoc = document.getElementById('input-cliente-documento');
        if (tipoOrcamentoAtual === 'serralheria') { title.textContent = 'Novo Orçamento - Serralheria'; labelDoc.textContent = 'CNPJ'; inputDoc.placeholder = 'Digite o CNPJ'; }
        else { title.textContent = 'Novo Orçamento - Consumidor Final'; labelDoc.textContent = 'CPF'; inputDoc.placeholder = 'Digite o CPF'; }
        btnSalvar.textContent = 'Salvar Orçamento';
        document.getElementById('input-data-orcamento').valueAsDate = new Date();
        const validade = new Date(); validade.setDate(validade.getDate() + 7);
        document.getElementById('input-data-validade').value = validade.toISOString().split('T')[0];
        if (prefillData) {
            if (prefillData.cliente) { document.getElementById('input-cliente-nome').value = prefillData.cliente.Nome; selectCliente(prefillData.cliente.ID); document.getElementById('input-cliente-nome').readOnly = true; }
            if (prefillData.medidas) {
                document.getElementById('input-item-altura').value = prefillData.medidas.altura; document.getElementById('input-item-comprimento').value = prefillData.medidas.comprimento;
                const checkRolo = document.getElementById('check-incluir-rolo');
                if (checkRolo) { checkRolo.checked = false; checkRolo.disabled = true; let help = document.getElementById('rolo-assistente-aviso'); if (!help) { help = document.createElement('small'); help.id = 'rolo-assistente-aviso'; help.style.color = "#3498db"; help.style.marginTop = "5px"; help.textContent = "A altura do rolo já foi definida pelo assistente."; checkRolo.parentElement.appendChild(help); } }
            }
        }
    } else if (mode === 'edit') {
        if (!orcamentoAtual) return showNotification('Erro: Orçamento não carregado.', 'error');
        preencherFormulario(orcamentoAtual); document.getElementById('modal-title').textContent = 'Editar Orçamento'; btnSalvar.textContent = 'Salvar Alterações';
    }
    popularDropdownProdutos(); atualizarVisibilidadeCamposItem(null, null); atualizarInfoTecnica(); document.getElementById('modal-orcamento').classList.add('active');
}

// === ASSISTENTE ===
function abrirModalAssistenteCliente() { document.getElementById('input-assistente-cliente-nome').value = ''; document.getElementById('assistente-clientes-list-options').innerHTML = ''; document.getElementById('btn-proximo-assistente-cliente').disabled = false; document.getElementById('assistente-cliente-detalhes').style.display = 'none'; assistenteClienteSelecionado = null; loadClientes().then(() => document.getElementById('modal-selecionar-cliente').classList.add('active')); }
function fecharModalAssistenteCliente() { document.getElementById('modal-selecionar-cliente').classList.remove('active'); }
function assistentePassoMedidas() { if (!assistenteClienteSelecionado) { const txt = document.getElementById('input-assistente-cliente-nome').value; if (txt.trim()) showNotification('Cliente não cadastrado ou não selecionado. Clique em "+ Novo".', 'warning'); else showNotification('Selecione um cliente.', 'warning'); return; } fecharModalAssistenteCliente(); abrirModalAssistenteMedidas(); }
function abrirModalAssistenteMedidas() { document.getElementById('form-assistente-medidas').reset(); document.getElementById('modal-definir-medidas').classList.add('active'); document.getElementById('assistente-altura').focus(); }
function fecharModalAssistenteMedidas() { document.getElementById('modal-definir-medidas').classList.remove('active'); }
function assistenteVoltarParaCliente() { fecharModalAssistenteMedidas(); abrirModalAssistenteCliente(); }
function assistenteConfirmarMedidas() { const alt = parseFloat(document.getElementById('assistente-altura').value); const comp = parseFloat(document.getElementById('assistente-comprimento').value); const check = document.getElementById('assistente-check-rolo').checked; if (!alt || alt <= 0 || !comp || comp <= 0) return showNotification('Medidas inválidas.', 'warning'); assistenteAlturaFinal = check ? alt : alt + 0.6; assistenteComprimentoFinal = comp; const prefill = { cliente: assistenteClienteSelecionado, medidas: { altura: assistenteAlturaFinal, comprimento: comp } }; fecharModalAssistenteMedidas(); abrirModal('create', prefill); preencherKit(assistenteKitTipo); }

// === CÁLCULOS E ITENS ===
function normalizeString(str) { return typeof str === 'string' ? str.replace(/\s+/g, ' ').trim() : ''; }
function atualizarInfoTecnica() {
    const container = document.getElementById('info-tecnica-container'); if (!container) return;
    const select = document.getElementById('select-item-produto'); let nomeItem = select.value ? select.options[select.selectedIndex].textContent : '';
    let alt = assistenteAlturaFinal || parseFloat(document.getElementById('input-item-altura').value) || 0; let comp = assistenteComprimentoFinal || parseFloat(document.getElementById('input-item-comprimento').value) || 0;
    if (!nomeItem) nomeItem = alt > 7 ? 'Super Cana' : '1/2 Cana Galvanizada (Fechada)';
    const dados = DADOS_TECNICOS_LAMINAS[normalizeString(nomeItem)];
    if (!dados || alt <= 0 || comp <= 0) { container.style.display = 'none'; return; }
    container.style.display = 'block'; const qtd = Math.ceil((alt * 100) / dados.alturaCm); const peso = qtd * (dados.fator * comp); document.getElementById('info-qtd-laminas').textContent = qtd; document.getElementById('info-peso-porta').textContent = `${peso.toFixed(2)} kg`; document.getElementById('info-peso-total').textContent = `${(peso * 1.40).toFixed(2)} kg`;
}

function preencherKit(kitTipo) {
    let laminaRecomendada = '1/2 Cana Galvanizada (Fechada)';
    if (assistenteAlturaFinal > 7) laminaRecomendada = 'Super Cana';

    let motorSelecionado = ''; 
    let pesoMotorSelecionado = 0;

    if (kitTipo === 'automatica' && assistenteAlturaFinal && assistenteComprimentoFinal) {
        const dados = DADOS_TECNICOS_LAMINAS[laminaRecomendada];
        if (dados) {
            const qtd = Math.ceil((assistenteAlturaFinal * 100) / dados.alturaCm);
            const peso = qtd * (dados.fator * assistenteComprimentoFinal);
            const pesoSeg = peso * 1.40;
            
            let listaMotores = (assistenteTipoMotor === 'DC') ? MOTORES_DC_DISPONIVEIS : MOTORES_DISPONIVEIS;
            const motoresComPesoSuficiente = listaMotores.filter(m => m.peso >= pesoSeg);

            if (motoresComPesoSuficiente.length > 0) {
                let motorIdeal = motoresComPesoSuficiente.find(m => m.alturaMax >= assistenteAlturaFinal);
                if (motorIdeal) {
                    motorSelecionado = motorIdeal.nome;
                    pesoMotorSelecionado = motorIdeal.peso;
                } else {
                    let motorAlternativo = motoresComPesoSuficiente[0];
                    motorSelecionado = motorAlternativo.nome;
                    pesoMotorSelecionado = motorAlternativo.peso;
                    showNotification(`Atenção: Altura excede limite do motor.`, 'warning');
                }
            } else {
                let motorMaisForte = listaMotores[listaMotores.length - 1];
                motorSelecionado = motorMaisForte.nome;
                pesoMotorSelecionado = motorMaisForte.peso;
                showNotification(`Atenção: Peso excede capacidade máxima.`, 'warning');
            }
        }
    }

    let tuboRecomendado = '';
    if (assistenteComprimentoFinal) {
        if (assistenteComprimentoFinal <= 4) {
            tuboRecomendado = 'Tubo Octogonal (m) até 4m';
        } else {
            tuboRecomendado = pesoMotorSelecionado <= 700 ? 'TUBO 4.1/2" 2.25mm (metro)' : 'TUBO 6.1/2" 2.65mm (metro)';
        }
    }

    let guiaRecomendada = 'Guia Lateral 70';
    if (assistenteComprimentoFinal > 7 || laminaRecomendada.includes('Super Cana')) {
        guiaRecomendada = 'Guia Lateral 100';
    }

    let antiqueda = '';
    if (pesoMotorSelecionado <= 700) antiqueda = 'Antiqueda até 700kg (SB 404)';
    else if (pesoMotorSelecionado <= 1000) antiqueda = 'Antiqueda 800-1000kg (SB 708)';
    else antiqueda = 'Antiqueda 1500-2000kg (SB 708)';

    const kitComum = ['Soleira', 'Trava Lâmina Esquerdo (Pacote 25 unid.)', 'Trava Lâmina Direito (Pacote 25 unid.)', 'Perfil PVC (50m)', 'Borracha Soleira (10m)'];
    let kitAuto = [];
    if (assistenteTipoMotor === 'DC') {
        kitAuto = [motorSelecionado, 'Botoeira DC', antiqueda, 'Infravermelho DC'];
    } else {
        kitAuto = [motorSelecionado, antiqueda, 'Infravermelho AC', 'KIT CENTRAL 99A'];
    }

    let itensAdd = [...kitComum];
    if (kitTipo === 'automatica') itensAdd.push(...kitAuto);
    if (assistenteAlturaFinal !== null) { 
        itensAdd.push(laminaRecomendada); 
        itensAdd.push(guiaRecomendada); 
    }
    if (tuboRecomendado) itensAdd.push(tuboRecomendado);

    itensTemp = [];
    let naoEncontrados = [];

    itensAdd.forEach(nome => {
        const limpo = normalizeString(nome);
        const prod = produtosDB.find(p => normalizeString(p.NomeItem) === limpo);
        
        if (prod) {
            const preco = tipoOrcamentoAtual === 'serralheria' ? prod.PrecoSerralheria : prod.PrecoConsumidor;
            let comp = 1, alt = 1, qtd = 1, total = parseFloat(preco);
            const upper = prod.NomeItem.toUpperCase();

            if (prod.UnidadeMedida === 'm²' && prod.NomeItem === laminaRecomendada) {
                comp = assistenteComprimentoFinal; 
                alt = assistenteAlturaFinal;
                qtd = comp * alt; 
                total = qtd * parseFloat(preco);
            } 
            else if (upper.includes('TUBO OCTOGONAL')) {
                qtd = 1; 
                comp = assistenteComprimentoFinal || 4; 
                total = comp * parseFloat(preco); 
            } 
            else if (prod.UnidadeMedida === 'm' && (upper.includes('TUBO') || upper.includes('SOLEIRA'))) {
                qtd = 1; 
                comp = assistenteComprimentoFinal || 1; 
                total = comp * parseFloat(preco);
            } 
            else if (prod.UnidadeMedida === 'm' && upper.includes('GUIA')) {
                qtd = 2; 
                alt = Math.max(0, (assistenteAlturaFinal || 0) - 0.5); 
                total = alt * qtd * parseFloat(preco);
            } 
            else if (upper.includes('TRAVA LÂMINA')) {
                const dados = DADOS_TECNICOS_LAMINAS[laminaRecomendada];
                if (dados && assistenteAlturaFinal) {
                    const qtdL = Math.ceil((assistenteAlturaFinal * 100) / dados.alturaCm);
                    const travasLado = Math.ceil(qtdL / 2);
                    qtd = Math.ceil(travasLado / 25); // Pacotes
                    total = qtd * parseFloat(preco);
                }
            }

            itensTemp.push({
                id: Date.now() + Math.random(), 
                produtoId: prod.ID, 
                item: prod.NomeItem,
                comprimento: comp, 
                altura: alt, 
                quantidade: qtd,
                unidadeMedida: prod.UnidadeMedida, 
                valorUnitario: parseFloat(preco),
                descontoPercent: 0, 
                total: total
            });
        } else {
            naoEncontrados.push(nome);
        }
    });

    if (naoEncontrados.length > 0) showNotification('Itens não encontrados no cadastro: ' + naoEncontrados.join(', '), 'warning');
    renderizarItensTemp();
    atualizarTotaisFinais();
}

function renderizarItensTemp() {
    const tbody = document.getElementById('itens-tbody');
    tbody.innerHTML = '';
    
    const section = document.getElementById('section-itens');
    section.style.display = itensTemp.length > 0 ? 'block' : 'none';
    
    const ordenados = itensTemp.map((item, index) => ({...item, originalIndex: index}))
                               .sort((a, b) => a.item.localeCompare(b.item));
    
    ordenados.forEach(item => {
        let comp = '--', alt = '--', qtd = '';
        const upper = item.item.toUpperCase();
        
        if (item.unidadeMedida === 'm²') {
            comp = parseFloat(item.comprimento).toFixed(2);
            alt = parseFloat(item.altura).toFixed(2);
            qtd = `${parseFloat(item.quantidade).toFixed(2)} m²`;
        } else if (item.unidadeMedida === 'm' && upper.includes('GUIA')) {
            alt = parseFloat(item.altura).toFixed(2);
            qtd = `${item.quantidade} un`;
        } else if (item.unidadeMedida === 'm' && (upper.includes('SOLEIRA') || upper.includes('TUBO'))) {
            const c = item.comprimento > 0 ? item.comprimento : (upper.includes('OCTOGONAL') ? 6 : 0);
            comp = parseFloat(c).toFixed(2);
            qtd = `${item.quantidade} un`;
        } else {
            let u = item.unidadeMedida; if (u === 'Unidade') u = 'un';
            qtd = `${item.quantidade} ${u}`;
        }

        let infoIcon = '';
        const descricao = getItemDescription(item.item);
        if (descricao) {
            infoIcon = `<span class="info-icon" data-tooltip="${descricao}" title="${descricao}">i</span>`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="display: flex; align-items: center; gap: 8px;">${item.item} ${infoIcon}</td>
            <td class="text-right">${comp}</td>
            <td class="text-right">${alt}</td>
            <td class="text-right">${qtd}</td>
            <td class="text-right">${formatarMoeda(item.valorUnitario)}</td>
            <td class="text-right">${item.descontoPercent}%</td>
            <td class="text-right"><strong>${formatarMoeda(item.total)}</strong></td>
            <td class="text-center">
                <button type="button" class="action-button edit" onclick="iniciarEdicaoItem(${item.originalIndex})" title="Editar"><i class="fas fa-edit"></i></button>
                <button type="button" class="action-button delete" onclick="removerItemTemp(${item.originalIndex})" title="Excluir"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function removerItemTemp(index) { itensTemp.splice(index, 1); renderizarItensTemp(); atualizarTotaisFinais(); }
function iniciarEdicaoItem(index) {
    const item = itensTemp[index]; if (!item) return;
    document.getElementById('select-item-produto').value = item.produtoId; document.getElementById('input-item-unidade').value = item.unidadeMedida; document.getElementById('input-item-valor').value = item.valorUnitario.toFixed(2); document.getElementById('input-item-desconto').value = item.descontoPercent; document.getElementById('input-item-comprimento').value = item.comprimento; document.getElementById('input-item-altura').value = item.altura; document.getElementById('input-item-quantidade').value = item.unidadeMedida === 'm²' ? 1 : item.quantidade;
    const checkRolo = document.getElementById('check-incluir-rolo'); if(checkRolo) checkRolo.checked = false;
    const btn = document.getElementById('btn-adicionar-item'); btn.innerHTML = '<i class="fas fa-check"></i> Atualizar Item'; btn.dataset.editIndex = index; atualizarVisibilidadeCamposItem(item.unidadeMedida, item.item); atualizarInfoTecnica(); document.getElementById('select-item-produto').focus();
}
function limparCamposItem() {
    document.getElementById('select-item-produto').value = ''; document.getElementById('input-item-unidade').value = '(auto)'; document.getElementById('input-item-comprimento').value = '1'; document.getElementById('input-item-altura').value = '1'; document.getElementById('input-item-quantidade').value = '1'; document.getElementById('input-item-valor').value = '0.00'; document.getElementById('input-item-desconto').value = '0';
    const btn = document.getElementById('btn-adicionar-item'); btn.innerHTML = '<i class="fas fa-plus"></i> Adicionar Item'; btn.dataset.editIndex = "-1"; atualizarVisibilidadeCamposItem(null, null); atualizarInfoTecnica();
}

function popularDropdownProdutos() {
    const sel = document.getElementById('select-item-produto'); sel.innerHTML = '<option value="">Selecione um item</option>';
    produtosDB.forEach(p => { const opt = document.createElement('option'); opt.value = p.ID; opt.textContent = p.NomeItem; opt.dataset.unidade = p.UnidadeMedida; opt.dataset.precoSerralheria = p.PrecoSerralheria; opt.dataset.precoConsumidor = p.PrecoConsumidor; opt.dataset.nome = p.NomeItem; sel.appendChild(opt); });
}

function preencherDadosItem() {
    const sel = document.getElementById('select-item-produto'); if (!sel.value) { limparCamposItem(); return; }
    const opt = sel.options[sel.selectedIndex]; document.getElementById('input-item-unidade').value = opt.dataset.unidade; atualizarVisibilidadeCamposItem(opt.dataset.unidade, opt.dataset.nome);
    let preco = tipoOrcamentoAtual === 'serralheria' ? opt.dataset.precoSerralheria : opt.dataset.precoConsumidor; document.getElementById('input-item-valor').value = parseFloat(preco).toFixed(2);
}

function adicionarItem() {
    const sel = document.getElementById('select-item-produto'); if (!sel.value) return showNotification('Selecione um item.', 'warning');
    const opt = sel.options[sel.selectedIndex]; const unidade = opt.dataset.unidade; const nome = opt.dataset.nome; const nomeUpper = nome.toUpperCase();
    const valor = parseFloat(document.getElementById('input-item-valor').value); const desc = parseFloat(document.getElementById('input-item-desconto').value) || 0; let comp = parseFloat(document.getElementById('input-item-comprimento').value) || 0; let alt = parseFloat(document.getElementById('input-item-altura').value) || 0; let qtd = parseInt(document.getElementById('input-item-quantidade').value) || 0;
    let qtdCalc = 0, total = 0;
    if (unidade === 'm²') { if (comp <= 0 || alt <= 0) return showNotification('Medidas inválidas.', 'warning'); qtdCalc = comp * alt; total = (valor * qtdCalc) * (1 - desc / 100); }
    else if (unidade === 'm' && nomeUpper.includes('GUIA')) { if (alt <= 0 || qtd <= 0) return showNotification('Medidas inválidas.', 'warning'); qtdCalc = alt * qtd; total = (valor * qtdCalc) * (1 - desc / 100); comp = 0; }
    else if (unidade === 'm' && (nomeUpper.includes('SOLEIRA') || nomeUpper.includes('TUBO'))) { if (comp <= 0 || qtd <= 0) return showNotification('Medidas inválidas.', 'warning'); qtdCalc = comp * qtd; total = (valor * qtdCalc) * (1 - desc / 100); alt = 0; }
    else { if (qtd <= 0) return showNotification('Qtd inválida.', 'warning'); qtdCalc = qtd; total = (valor * qtdCalc) * (1 - desc / 100); comp = 0; alt = 0; }
    const novo = { id: Date.now(), produtoId: parseInt(sel.value), item: nome, comprimento: comp, altura: alt, quantidade: qtdCalc, unidadeMedida: unidade, valorUnitario: valor, descontoPercent: desc, total: total };
    const btn = document.getElementById('btn-adicionar-item'); const idx = parseInt(btn.dataset.editIndex || "-1"); if (idx > -1) itensTemp[idx] = novo; else itensTemp.push(novo); renderizarItensTemp(); atualizarTotaisFinais(); limparCamposItem(); return true;
}

function atualizarVisibilidadeCamposItem(unidade, nome) {
    const gComp = document.getElementById('group-comprimento'); const gAlt = document.getElementById('group-altura'); const gQtd = document.getElementById('group-quantidade'); gComp.style.display = 'none'; gAlt.style.display = 'none'; gQtd.style.display = 'none';
    if (!unidade || !nome) return; const nomeUpper = nome.toUpperCase();
    if (unidade === 'm²') { gComp.style.display = 'block'; gAlt.style.display = 'block'; } else if (unidade === 'm' && nomeUpper.includes('GUIA')) { gAlt.style.display = 'block'; gQtd.style.display = 'block'; } else if (unidade === 'm' && (nomeUpper.includes('SOLEIRA') || nomeUpper.includes('TUBO'))) { gComp.style.display = 'block'; gQtd.style.display = 'block'; } else { gQtd.style.display = 'block'; }
}

function toggleFrete() { const check = document.getElementById('check-frete'); document.getElementById('input-valor-frete').style.display = check.checked ? 'block' : 'none'; if (!check.checked) document.getElementById('input-valor-frete').value = '0.00'; atualizarTotaisFinais(); }
function atualizarTotaisFinais() { const sub = itensTemp.reduce((a, b) => a + b.total, 0); const frete = parseFloat(document.getElementById('input-valor-frete').value) || 0; const desc = parseFloat(document.getElementById('input-desconto-geral').value) || 0; const total = (sub + frete) * (1 - desc / 100); document.getElementById('valor-subtotal').textContent = formatarMoeda(sub); document.getElementById('valor-total').textContent = formatarMoeda(total); }

async function salvarOrcamento(event) {
    event.preventDefault(); 
    
    const sel = document.getElementById('select-item-produto'); 
    if (sel.value) if (!adicionarItem()) return; 
    
    const btnSalvar = document.getElementById('btn-salvar'); if (itensTemp.length === 0) return showNotification('Adicione pelo menos um item ao orçamento.', 'warning'); btnSalvar.disabled = true; btnSalvar.innerHTML = 'Salvando...';
    const sub = itensTemp.reduce((a, b) => a + b.total, 0); 
    const frete = parseFloat(document.getElementById('input-valor-frete').value) || 0; 
    const desc = parseFloat(document.getElementById('input-desconto-geral').value) || 0; 
    const total = (sub + frete) * (1 - desc / 100);
    const parcelasEl = document.getElementById('input-parcelas');
    const parcelasVal = parcelasEl ? parseInt(parcelasEl.value) : 1;
    const payload = { 
        usuarioID: currentUserID, 
        tipo: tipoOrcamentoAtual, 
        status: (modalMode === 'edit' && orcamentoAtual) ? orcamentoAtual.Status : 'pendente', 
        dataOrcamento: document.getElementById('input-data-orcamento').value, 
        dataValidade: document.getElementById('input-data-validade').value, 
        clienteNome: document.getElementById('input-cliente-nome').value, 
        clienteDocumento: document.getElementById('input-cliente-documento').value, 
        clienteEndereco: document.getElementById('input-cliente-endereco').value, 
        clienteCidadeUF: document.getElementById('input-cliente-cidade-uf').value, 
        clienteContato: document.getElementById('input-cliente-contato').value, 
        clienteEmail: document.getElementById('input-cliente-email').value, 
        itens: itensTemp, 
        tipoPagamento: document.getElementById('input-tipo-pgto').value,
        formaPagamento: document.getElementById('input-forma-pgto').value,
        parcelas: parcelasVal,
        subtotal: sub, 
        temFrete: document.getElementById('check-frete').checked, 
        valorFrete: frete, 
        descontoGeralPercent: desc, 
        valorTotal: total, 
        observacoes: document.getElementById('input-observacoes').value };

    try { 
        let url = `${API_URL}/orcamentos`; 
        let method = 'POST'; 
        if (modalMode === 'edit' && orcamentoAtual) { url += `/${orcamentoAtual.ID}`; method = 'PUT'; } 
        const res = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); 
        if (!res.ok) throw new Error('Falha ao salvar'); 
        showNotification('Salvo com sucesso!', 'success'); 
        fecharModal(); 
        await loadOrcamentos(); 
        renderizarTabela(); 
        atualizarEstatisticas(); 
    } catch (e) { showNotification(e.message, 'error'); } finally { btnSalvar.disabled = false; btnSalvar.textContent = 'Salvar'; }
}

async function visualizarOrcamento(id) {
    const modal = document.getElementById('modal-visualizar'); const content = document.getElementById('view-content'); const title = document.getElementById('view-modal-title'); content.innerHTML = '<p>Carregando dados...</p>'; modal.classList.add('active');
    try {
        const res = await fetch(`${API_URL}/orcamentos/${id}`); if (!res.ok) throw new Error('Erro'); orcamentoAtual = await res.json(); title.textContent = `Orçamento ${orcamentoAtual.NumeroOrcamento}`;
        let itensHtml = `<table class="itens-table"><thead><tr><th>Item</th><th class="text-right">Comp. (m)</th><th class="text-right">Alt. (m)</th><th class="text-right">Qtd.</th><th class="text-right">Total</th></tr></thead><tbody>`;
        orcamentoAtual.itens.forEach(item => {
            let c = '--', a = '--', q = '';
            if (item.UnidadeMedida === 'm²') { c = parseFloat(item.Comprimento).toFixed(2); a = parseFloat(item.Altura).toFixed(2); q = `${parseFloat(item.Quantidade).toFixed(2)} m²`; }
            else if (item.UnidadeMedida === 'm' && item.Item.toUpperCase().includes('GUIA')) { a = parseFloat(item.Altura).toFixed(2); q = `${item.Quantidade} un`; }
            else if (item.UnidadeMedida === 'm') { let cx = parseFloat(item.Comprimento) > 0 ? parseFloat(item.Comprimento) : (item.Item.toUpperCase().includes('OCTOGONAL') ? 6 : 0); c = cx.toFixed(2); q = `${item.Quantidade} un`; }
            else { let u = item.UnidadeMedida; if (u === 'Unidade') u = 'un'; q = `${item.Quantidade} ${u}`; }
            itensHtml += `<tr><td>${item.Item}</td><td class="text-right">${c}</td><td class="text-right">${a}</td><td class="text-right">${q}</td><td class="text-right">${formatarMoeda(item.ValorTotalItem)}</td></tr>`;
        });
        itensHtml += `</tbody></table>`; content.innerHTML = `<div class="view-section"><h3>Cliente: ${orcamentoAtual.ClienteNome}</h3></div><div class="view-section">${itensHtml}</div><div class="view-section"><h3>Total: ${formatarMoeda(orcamentoAtual.ValorTotal)}</h3></div>`;
    } catch (e) { showNotification(e.message, 'error'); fecharModalView(); }
}

async function atualizarStatusOrcamentoPorId(id, status) {
    // Validação de cliente antes de aprovar
    if (status === 'aprovado') { 
        let orc = orcamentoAtual || orcamentos.find(o => o.ID === id); 
        if (orc) { 
            const val = validarClienteParaAprovacao(orc); 
            if (!val.valido) { 
                abrirModalAvisoCliente(val.msg); 
                return; 
            } 
        } 
    }

    try { 
        const res = await fetch(`${API_URL}/orcamentos/${id}`, { 
            method: 'PUT', 
            headers: {'Content-Type':'application/json'}, 
            body: JSON.stringify({status}) 
        }); 
        
        if (!res.ok) {
            // CORREÇÃO: Lê a mensagem real de erro do servidor
            const err = await res.json();
            throw new Error(err.error || 'Erro desconhecido no servidor');
        } 
        
        showNotification(`Status alterado para ${status}!`, 'success'); 
        fecharModalView(); 
        await loadOrcamentos(); 
        renderizarTabela(); 
        atualizarEstatisticas(); 
        
    } catch (e) { 
        console.error(e);
        showNotification(e.message, 'error'); 
    }
}

function atualizarStatusOrcamento(id, status) { if (typeof id === 'string') atualizarStatusOrcamentoPorId(orcamentoAtual.ID, id); else atualizarStatusOrcamentoPorId(id, status); }
function excluirOrcamento(id, num) { console.warn('Função desativada'); }
async function executarExclusao() { if (clienteParaExcluir) executingExclusaoCliente(); }
async function editarOrcamento(id) { try { const res = await fetch(`${API_URL}/orcamentos/${id}`); if (res.ok) { orcamentoAtual = await res.json(); abrirModal('edit'); } } catch (e) { showNotification(e.message, 'error'); } }
async function exportarPDF(id, modo = 'download') {
    showNotification('Gerando PDF...', 'info'); try { const res = await fetch(`${API_URL}/orcamentos/${id}`); if (!res.ok) throw new Error('Erro'); const orc = await res.json();
    const { jsPDF } = window.jspdf; const doc = new jsPDF(); const MARGEM = 15; let posY = 20;
    doc.setFont('Helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor('#2c3e50'); doc.text("ORÇAMENTO", MARGEM, posY); doc.setFont('Helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor('#34495e'); doc.text("Atron", 195, posY, { align: "right" }); posY += 5; doc.text("Rua João Mafra, 375 - Vila Brasílio Machado, São Paulo/SP", 195, posY, { align: "right" }); posY += 5; doc.text("Telefone: (11) 3168-6600", 195, posY, { align: "right" }); posY += 10; doc.line(MARGEM, posY, 195, posY); posY += 10;
    doc.setFont('Helvetica', 'bold'); doc.text(`Orçamento ${orc.NumeroOrcamento}`, MARGEM, posY); doc.setFont('Helvetica', 'normal'); doc.text(`Cliente: ${orc.ClienteNome}`, MARGEM, posY + 5); doc.text(`Data: ${formatarData(orc.DataOrcamento)}`, MARGEM, posY + 10); doc.text(`Validade: ${formatarData(orc.DataValidade)}`, MARGEM, posY + 15); let y = posY + 25;
    const tableBody = orc.itens.map(item => { let c='--', a='--', q=item.Quantidade; if (item.UnidadeMedida === 'm²') { c=parseFloat(item.Comprimento).toFixed(2); a=parseFloat(item.Altura).toFixed(2); q=parseFloat(item.Quantidade).toFixed(2)+'m²'; } else if (item.UnidadeMedida === 'm') { if(item.Item.toUpperCase().includes('GUIA')) a=parseFloat(item.Altura).toFixed(2); else c=parseFloat(item.Comprimento).toFixed(2); } return [item.Item, c, a, q, formatarMoeda(item.ValorUnitario), `${item.DescontoPercent}%`, formatarMoeda(item.ValorTotalItem)]; });
    doc.autoTable({ head: [["Item", "Comp. (m)", "Alt. (m)", "Qtd.", "Vl. Unit.", "Desc.%", "Total"]], body: tableBody, startY: y, theme: 'striped', headStyles: { fillColor: [44, 62, 80], textColor: 255 }, styles: { font: 'Helvetica', fontSize: 9 }, columnStyles: { 1: {halign:'right'}, 2: {halign:'right'}, 3: {halign:'right'}, 4: {halign:'right'}, 5: {halign:'right'}, 6: {halign:'right'} } });
    let finalY = doc.lastAutoTable.finalY + 10; doc.text(`Subtotal: ${formatarMoeda(orc.Subtotal)}`, 195, finalY, { align: 'right' }); finalY += 5; if (orc.TemFrete) { doc.text(`Frete: ${formatarMoeda(orc.ValorFrete)}`, 195, finalY, { align: 'right' }); finalY += 5; } if (orc.DescontoGeralPercent > 0) { doc.text(`Desconto Geral: ${orc.DescontoGeralPercent}%`, 195, finalY, { align: 'right' }); finalY += 5; } doc.setFont('Helvetica', 'bold'); doc.setFontSize(12); doc.text(`TOTAL: ${formatarMoeda(orc.ValorTotal)}`, 195, finalY + 2, { align: 'right' }); if (modo === 'view') doc.output('dataurlnewwindow'); else doc.save(`Orcamento_${orc.NumeroOrcamento}.pdf`);
    } catch (e) { showNotification(e.message, 'error'); }
}
function validarClienteParaAprovacao(orcamento) { const c = allClientes.find(x => x.Nome.trim().toLowerCase() === orcamento.ClienteNome.trim().toLowerCase()); if (!c) return { valido: false, msg: `O cliente "${orcamento.ClienteNome}" não possui cadastro.` }; const empty = (v) => !v || String(v).trim() === ''; const e = []; if (empty(c.Documento)) e.push('Documento'); if (empty(c.Endereco)) e.push('Endereço'); if (empty(c.CidadeUF)) e.push('Cidade/UF'); if (empty(c.Contato)) e.push('Contato'); if (e.length > 0) return { valido: false, msg: `Cadastro incompleto: ${e.join(', ')}.` }; return { valido: true }; }
function abrirModalAvisoCliente(msg) { document.getElementById('msg-aviso-cliente').textContent = msg; document.getElementById('modal-aviso-cliente').classList.add('active'); }
function fecharModalAvisoCliente() { document.getElementById('modal-aviso-cliente').classList.remove('active'); }
function redirecionarParaCadastro() { fecharModalAvisoCliente(); fecharModalView(); abrirModalCliente(); }
function adicionarLinhaEnderecoExtra(dados = { endereco: '', cidade: '', tipo: 'Entrega' }) { const c = document.getElementById('container-enderecos-extras'); const d = document.createElement('div'); d.className = 'endereco-extra-row'; d.style.cssText = "display: flex; gap: 10px; align-items: center; background: #f8f9fa; padding: 8px; border-radius: 4px; border: 1px solid #e9ecef;"; d.innerHTML = `<select class="form-control extra-tipo" style="width: 100px;"><option value="Entrega" ${dados.tipo === 'Entrega' ? 'selected' : ''}>Entrega</option><option value="Cobrança" ${dados.tipo === 'Cobrança' ? 'selected' : ''}>Cobrança</option><option value="Outro" ${dados.tipo === 'Outro' ? 'selected' : ''}>Outro</option></select><input type="text" class="form-control extra-end" placeholder="Endereço completo" value="${dados.endereco}" style="flex: 2;"><input type="text" class="form-control extra-cid" placeholder="Cidade/UF" value="${dados.cidade}" style="flex: 1;"><button type="button" class="btn-icon delete" onclick="this.parentElement.remove()" style="color: #e74c3c;"><i class="fas fa-trash"></i></button>`; c.appendChild(d); }
function getEnderecosExtrasDoFormulario() {
    const e = [];
    document.querySelectorAll('.endereco-extra-row').forEach(r => {
        const t = r.querySelector('.extra-tipo').value;
        const ad = r.querySelector('.extra-end').value.trim();
        const ci = r.querySelector('.extra-cid').value.trim();
        
        // CORREÇÃO: Mapeia as variáveis 't', 'ad' e 'ci' para as chaves corretas
        if (ad) e.push({ tipo: t, endereco: ad, cidade: ci });
    });
    return e;
}
function populateVendedorFilter() { const s = document.getElementById('filter-vendedor'); if (currentUserRole !== 'admin') { s.style.display = 'none'; return; } s.style.display = 'block'; s.innerHTML = '<option value="all">Todos</option>'; [...new Set(orcamentos.map(o => o.VendedorNome))].sort().forEach(v => { s.innerHTML += `<option value="${v}">${v}</option>`; }); }
function atualizarEstatisticas() { document.getElementById('stat-total').textContent = orcamentos.length; document.getElementById('stat-pendentes').textContent = orcamentos.filter(o => o.Status === 'pendente').length; document.getElementById('stat-aprovados').textContent = orcamentos.filter(o => o.Status === 'aprovado').length; document.getElementById('stat-rejeitados').textContent = orcamentos.filter(o => o.Status === 'rejeitado').length; document.getElementById('stat-valor').textContent = formatarMoeda(orcamentos.filter(o => o.Status === 'aprovado').reduce((a,b)=>a+parseFloat(b.ValorTotal),0)); }
function filterAndShowClienteDropdown() {
    const input = document.getElementById('input-cliente-nome');
    const div = document.getElementById('clientes-list-options');
    
    div.innerHTML = '';
    const term = input.value.toLowerCase();

    // Lógica alterada: Se não tiver termo digitado, mostra os primeiros 20 clientes
    let fil = [];
    if (term.length === 0) {
        fil = allClientes.slice(0, 20); 
    } else {
        fil = allClientes.filter(c => c.Nome.toLowerCase().includes(term));
    }

    if (fil.length === 0) {
        const d = document.createElement('div');
        d.className = 'combobox-option-item';
        d.style.color = '#e74c3c';
        d.style.fontStyle = 'italic';
        d.style.cursor = 'default';
        const msg = term.length > 0 ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado.';
        d.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${msg}`;
        div.appendChild(d);
    } else {
        fil.forEach(c => {
            const d = document.createElement('div');
            d.className = 'combobox-option-item';
            d.dataset.id = c.ID;
            const docInfo = c.Documento ? ` <small style="color:#666">(${c.Documento})</small>` : '';
            d.innerHTML = `${c.Nome}${docInfo}`;
            div.appendChild(d);
        });
        
        if (term.length === 0 && allClientes.length > 20) {
            const info = document.createElement('div');
            info.className = 'combobox-option-item';
            info.style.color = '#64748b';
            info.style.fontSize = '12px';
            info.style.textAlign = 'center';
            info.style.backgroundColor = '#f8fafc';
            info.style.cursor = 'default';
            info.innerHTML = `<em>Digite para buscar mais clientes...</em>`;
            div.appendChild(info);
        }
    }
    
    div.classList.add('visible');
}
function selectCliente(id) { const c = allClientes.find(x => x.ID == id); if (c) { document.getElementById('input-cliente-nome').value = c.Nome; document.getElementById('input-cliente-documento').value = c.Documento||''; document.getElementById('input-cliente-endereco').value = c.Endereco||''; document.getElementById('input-cliente-cidade-uf').value = c.CidadeUF||''; document.getElementById('input-cliente-contato').value = c.Contato||''; document.getElementById('input-cliente-email').value = c.Email||''; document.getElementById('clientes-list-options').classList.remove('visible'); } }
function filterAndShowAssistenteClienteDropdown() {
    assistenteClienteSelecionado = null; 
    document.getElementById('assistente-cliente-detalhes').style.display = 'none';
    
    const input = document.getElementById('input-assistente-cliente-nome'); 
    const div = document.getElementById('assistente-clientes-list-options'); 
    
    div.innerHTML = '';
    const term = input.value.toLowerCase();
    
    let fil = [];
    if (term.length === 0) {
        fil = allClientes.slice(0, 20);
    } else {
        fil = allClientes.filter(c => c.Nome.toLowerCase().includes(term));
    }
    
    if (fil.length === 0) { 
        const d = document.createElement('div'); 
        d.className = 'combobox-option-item'; 
        d.style.color = '#e74c3c'; 
        d.style.fontStyle = 'italic'; 
        d.style.cursor = 'default';
        const msg = term.length > 0 ? 'Cliente não encontrado.' : 'Nenhum cliente cadastrado.';
        d.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${msg} <br><small style="color:#666; margin-left: 18px;">Clique em "+ Novo" para cadastrar.</small>`; 
        div.appendChild(d); 
    } else { 
        fil.forEach(c => { 
            const d = document.createElement('div'); 
            d.className = 'combobox-option-item'; 
            d.dataset.id = c.ID; 
            d.innerHTML = `${c.Nome} <small>(${c.Documento||''})</small>`; 
            div.appendChild(d); 
        }); 
        
        if (term.length === 0 && allClientes.length > 20) {
            const info = document.createElement('div');
            info.className = 'combobox-option-item';
            info.style.color = '#64748b';
            info.style.fontSize = '12px';
            info.style.textAlign = 'center';
            info.style.backgroundColor = '#f8fafc';
            info.innerHTML = `<em>Digite para buscar mais...</em>`;
            div.appendChild(info);
        }
    }
    div.classList.add('visible');
}
function selectAssistenteCliente(id) { const c = allClientes.find(x => x.ID == id); if (c) { assistenteClienteSelecionado = c; document.getElementById('input-assistente-cliente-nome').value = c.Nome; if(document.getElementById('detalhe-nome')) document.getElementById('detalhe-nome').textContent = c.Nome; if(document.getElementById('detalhe-doc')) document.getElementById('detalhe-doc').textContent = c.Documento||'N/A'; if(document.getElementById('detalhe-end')) document.getElementById('detalhe-end').textContent = (c.Endereco||'')+' '+(c.CidadeUF||''); document.getElementById('assistente-cliente-detalhes').style.display = 'block'; document.getElementById('assistente-clientes-list-options').classList.remove('visible'); } }
function abrirModalCliente() { document.getElementById('form-cliente').reset(); document.getElementById('container-enderecos-extras').innerHTML = ''; document.getElementById('modal-cliente').classList.add('active'); }
function fecharModalCliente() { document.getElementById('modal-cliente').classList.remove('active'); currentEditClienteID = null; document.getElementById('modal-cliente-title').textContent = 'Cadastrar Novo Cliente'; document.getElementById('btn-salvar-cliente').textContent = 'Salvar Cliente'; }
async function salvarCliente(e) { e.preventDefault(); const btn = document.getElementById('btn-salvar-cliente'); btn.disabled = true; btn.innerHTML = 'Salvando...'; const ex = getEnderecosExtrasDoFormulario(); const data = { UsuarioID: currentUserID, Nome: document.getElementById('cliente-nome').value, Documento: document.getElementById('cliente-documento').value, Endereco: document.getElementById('cliente-endereco').value, CidadeUF: document.getElementById('cliente-cidade-uf').value, Contato: document.getElementById('cliente-contato').value, Email: document.getElementById('cliente-email').value, TipoCliente: document.getElementById('cliente-tipo').value, VendedorResponsavel: document.getElementById('cliente-vendedor').value, EnderecosAdicionais: ex }; let url = `${API_URL}/clientes`; let m = 'POST'; if (currentEditClienteID) { url += `/${currentEditClienteID}`; m = 'PUT'; } try { const r = await fetch(url, { method: m, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); if (r.ok) { showNotification(currentEditClienteID ? 'Cliente atualizado!' : 'Cliente salvo!', 'success'); await loadClientes(); if (isAddingFromAssistant && m === 'POST') { const res = await r.json(); fecharModalCliente(); abrirModalAssistenteCliente(); if(res.ID) setTimeout(() => selectAssistenteCliente(res.ID), 200); isAddingFromAssistant = false; } else { fecharModalCliente(); if(document.getElementById('modal-lista-clientes').classList.contains('active')) renderizarTabelaClientes(); } } else { const err = await r.json(); throw new Error(err.error); } } catch(e) { showNotification(e.message, 'error'); } finally { btn.disabled = false; btn.textContent = currentEditClienteID ? 'Salvar Alterações' : 'Salvar Cliente'; } }
function abrirModalListaClientes() { loadClientes().then(() => { renderizarTabelaClientes(); document.getElementById('modal-lista-clientes').classList.add('active'); }); }
function fecharModalListaClientes() { document.getElementById('modal-lista-clientes').classList.remove('active'); }
function renderizarTabelaClientes() { const tb = document.getElementById('clientes-tbody'); const t = document.getElementById('search-cliente-modal').value.toLowerCase(); const f = allClientes.filter(c => (c.Nome||'').toLowerCase().includes(t) || (c.Documento||'').includes(t)); tb.innerHTML = ''; if (!f.length) return tb.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum cliente encontrado.</td></tr>'; f.forEach(c => { tb.innerHTML += `<tr><td>${c.Nome}</td><td>${c.Documento||'--'}</td><td>${c.Contato||'--'}</td><td>${c.Email||'--'}</td><td>${c.VendedorResponsavel||'--'}</td><td class="text-center"><div class="table-actions" data-client-id="${c.ID}"><button class="action-button edit"><i class="fas fa-pen"></i></button></div></td></tr>`; }); tb.querySelectorAll('.action-button.edit').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); abrirModalEditarCliente(parseInt(b.closest('.table-actions').dataset.clientId)); })); }
async function abrirModalEditarCliente(id) { try { const r = await fetch(`${API_URL}/clientes/${id}`); if (!r.ok) throw new Error('Erro'); const c = await r.json(); currentEditClienteID = c.ID; document.getElementById('cliente-nome').value = c.Nome; document.getElementById('cliente-documento').value = c.Documento||''; document.getElementById('cliente-endereco').value = c.Endereco||''; document.getElementById('cliente-cidade-uf').value = c.CidadeUF||''; document.getElementById('cliente-contato').value = c.Contato||''; document.getElementById('cliente-email').value = c.Email||''; document.getElementById('cliente-tipo').value = c.TipoCliente||'Consumidor Final'; if(c.VendedorResponsavel) document.getElementById('cliente-vendedor').value = c.VendedorResponsavel; const con = document.getElementById('container-enderecos-extras'); con.innerHTML = ''; if (c.EnderecosAdicionais && Array.isArray(c.EnderecosAdicionais)) c.EnderecosAdicionais.forEach(end => adicionarLinhaEnderecoExtra(end)); document.getElementById('modal-cliente-title').textContent = 'Editar Cliente'; document.getElementById('btn-salvar-cliente').textContent = 'Salvar Alterações'; fecharModalListaClientes(); document.getElementById('modal-cliente').classList.add('active'); } catch (e) { showNotification(e.message, 'error'); } }
function confirmarExcluirCliente(id, nome) { clienteParaExcluir = {id, nome}; const m = document.getElementById('modal-confirmar-exclusao'); document.getElementById('exclusao-modal-title').textContent = 'Excluir Cliente'; document.getElementById('exclusao-mensagem').textContent = 'Tem certeza que deseja excluir o cliente?'; document.getElementById('exclusao-orcamento-numero').textContent = nome; const b = document.getElementById('btn-confirmar-exclusao'); const nb = b.cloneNode(true); b.parentNode.replaceChild(nb, b); nb.addEventListener('click', executingExclusaoCliente); fecharModalListaClientes(); m.classList.add('active'); }
async function executingExclusaoCliente() { if (!clienteParaExcluir) return; const btn = document.getElementById('btn-confirmar-exclusao'); btn.disabled = true; try { const r = await fetch(`${API_URL}/clientes/${clienteParaExcluir.id}`, { method: 'DELETE' }); if (r.ok) { showNotification('Cliente excluído!', 'success'); await loadClientes(); fecharModalExclusao(); abrirModalListaClientes(); } else { const e = await r.json(); showNotification(e.error, 'error'); } } catch (e) { showNotification(e.message, 'error'); } finally { btn.disabled = false; clienteParaExcluir = null; } }
function getLoggedInUserID() { return localStorage.getItem(USER_ID_KEY) || sessionStorage.getItem(USER_ID_KEY); }
function getLoggedInUserRole() { return localStorage.getItem(USER_ROLE_KEY) || sessionStorage.getItem(USER_ROLE_KEY); }
function getLoggedInUserFullName() { return localStorage.getItem(USER_NAME_KEY) || sessionStorage.getItem(USER_NAME_KEY); }
function formatarMoeda(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(v)||0); }
function formatarData(d) { return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR'); }
function showNotification(msg, type) { if (window.NotificationManager) window.NotificationManager.show({ title: type, message: msg, type: type }); else alert(msg); }

/**
 * Função crucial que faltava: Limpa os campos do formulário de orçamento
 */
function limparFormulario() {
    document.getElementById('form-orcamento').reset();
    itensTemp = [];
    orcamentoAtual = null;
    modalMode = 'create';
    
    assistenteKitTipo = null;
    assistenteClienteSelecionado = null;
    assistenteAlturaFinal = null; 
    assistenteComprimentoFinal = null;

    renderizarItensTemp();
    atualizarTotaisFinais();
    
    document.getElementById('input-valor-frete').style.display = 'none';
    document.getElementById('check-frete').checked = false;
    atualizarVisibilidadeCamposItem(null, null); 
    limparCamposItem(); 

    document.getElementById('input-cliente-nome').readOnly = false;
    const checkRoloPrincipal = document.getElementById('check-incluir-rolo');
    if (checkRoloPrincipal) {
        checkRoloPrincipal.disabled = false;
        const aviso = document.getElementById('rolo-assistente-aviso');
        if (aviso) aviso.remove();
    }
}

// === SISTEMA DE TOOLTIP GLOBAL (FLUTUANTE) ===
function initGlobalTooltip() {
    let tooltip = document.getElementById('sinergy-global-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'sinergy-global-tooltip';
        document.body.appendChild(tooltip);
    }
    const spacing = 10; 
    document.body.addEventListener('mouseover', (e) => {
        if (e.target.classList.contains('info-icon')) {
            const text = e.target.getAttribute('data-tooltip');
            if (!text) return;
            tooltip.textContent = text;
            tooltip.classList.add('visible');
            const iconRect = e.target.getBoundingClientRect();
            const tooltipRect = tooltip.getBoundingClientRect();
            let left = iconRect.left + (iconRect.width / 2) - (tooltipRect.width / 2);
            let top = iconRect.top - tooltipRect.height - spacing;
            if (top < 0) top = iconRect.bottom + spacing;
            if (left < 10) left = 10;
            if (left + tooltipRect.width > window.innerWidth) left = window.innerWidth - tooltipRect.width - 10;
            tooltip.style.top = `${top}px`;
            tooltip.style.left = `${left}px`;
        }
    });
    document.body.addEventListener('mouseout', (e) => {
        if (e.target.classList.contains('info-icon')) tooltip.classList.remove('visible');
    });
}

/**
 * Preenche o formulário com os dados de um orçamento existente para edição.
 */
function preencherFormulario(orcamento) {
    tipoOrcamentoAtual = orcamento.TipoOrcamento; 
    
    itensTemp = orcamento.itens.map(item => ({
        id: item.ID,
        produtoId: item.ProdutoID,
        item: item.Item,
        comprimento: parseFloat(item.Comprimento),
        altura: parseFloat(item.Altura),
        quantidade: parseFloat(item.Quantidade), 
        unidadeMedida: item.UnidadeMedida,
        valorUnitario: parseFloat(item.ValorUnitario),
        descontoPercent: parseFloat(item.DescontoPercent),
        total: parseFloat(item.ValorTotalItem)
    }));

    document.getElementById('input-numero-orcamento').value = orcamento.NumeroOrcamento;
    document.getElementById('input-data-orcamento').value = orcamento.DataOrcamento;
    document.getElementById('input-data-validade').value = orcamento.DataValidade;
    
    document.getElementById('input-cliente-nome').value = orcamento.ClienteNome;
    document.getElementById('input-cliente-documento').value = orcamento.ClienteDocumento || '';
    document.getElementById('input-cliente-endereco').value = orcamento.ClienteEndereco || '';
    document.getElementById('input-cliente-cidade-uf').value = orcamento.ClienteCidadeUF || '';
    document.getElementById('input-cliente-contato').value = orcamento.ClienteContato || '';
    document.getElementById('input-cliente-email').value = orcamento.ClienteEmail || '';
    
    document.getElementById('check-frete').checked = !!orcamento.TemFrete;
    document.getElementById('input-valor-frete').value = parseFloat(orcamento.ValorFrete || 0).toFixed(2);
    document.getElementById('input-desconto-geral').value = parseFloat(orcamento.DescontoGeralPercent || 0).toFixed(2);
    document.getElementById('input-observacoes').value = orcamento.Observacoes || '';
    
    const tipoPgto = document.getElementById('input-tipo-pgto');
    const formaPgto = document.getElementById('input-forma-pgto');
    const parcelas = document.getElementById('input-parcelas'); 

    if (tipoPgto) tipoPgto.value = orcamento.TipoPagamento || 'À Vista';
    if (formaPgto) formaPgto.value = orcamento.FormaPagamento || 'Pix';
    if (parcelas) parcelas.value = orcamento.Parcelas || 1;

    document.getElementById('input-cliente-nome').readOnly = true;

    renderizarItensTemp(); 
    atualizarTotaisFinais(); 
    toggleFrete();
    atualizarVisibilidadeCamposItem(null, null); 
    atualizarInfoTecnica();
}