/**
 * Movimentações - Integrado ao Backend
 * ATUALIZADO com Paginação "Carregar Mais"
 */

let allMovimentacoes = []; // Armazena TODAS as movimentações da API
let filteredMovimentacoes = []; // Armazena as movimentações filtradas
let currentPage = 1;
const itemsPerPage = 25; // Define quantos itens carregar por vez

// Lista de tipos de movimentação disponíveis
const TIPOS_MOVIMENTACAO = [
    'Compra',
    'Saída Perfuração',
    'Chegada Perfuração',
    'Produção',
    'Venda',
    'Exclusão de Bobina',
    'Atualização de Bobina',
    'Criação'
];

document.addEventListener("DOMContentLoaded", async () => { 
    await loadAllMovimentacoes(); 
    populateTypeFilter();
    setupEventListeners();
    applyFiltersAndRender(); // Renderiza a primeira página
});

/**
 * Carrega TODAS as movimentações da API UMA VEZ e armazena em 'allMovimentacoes'
 */
async function loadAllMovimentacoes() {
    const loader = document.getElementById('loader-overlay');
    if(loader) loader.style.display = 'flex';
    
    try {
        const response = await fetch('https://virtualcriacoes.com/sinergy/api/movimentacoes');
        if (!response.ok) {
            throw new Error('Falha ao carregar movimentações do servidor.');
        }
        const data = await response.json();
        // Ordena por data (mais recente primeiro)
        allMovimentacoes = data.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
    } catch (error) {
        console.error('Erro ao carregar movimentações:', error);
        if (window.NotificationManager) {
            window.NotificationManager.show({
                title: 'Erro',
                message: `Falha ao carregar movimentações: ${error.message}`,
                type: 'error'
            });
        }
    } finally {
        if(loader) loader.style.display = 'none';
    }
}

/**
 * Preenche o filtro de tipos dinamicamente
 */
function populateTypeFilter() {
    const typeFilter = document.getElementById("typeFilter");
    if (!typeFilter) return;

    typeFilter.innerHTML = '<option value="">Todos os Tipos</option>';
    const tiposDoBackend = [...new Set(allMovimentacoes.map(mov => mov.TipoMovimentacao).filter(Boolean))];
    const todosOsTipos = [...new Set([...TIPOS_MOVIMENTACAO, ...tiposDoBackend])];
    
    todosOsTipos.sort();
    todosOsTipos.forEach(tipo => {
        const option = document.createElement('option');
        option.value = tipo;
        option.textContent = tipo;
        typeFilter.appendChild(option);
    });
}

/**
 * Renderiza a tabela com os dados paginados
 * @param {boolean} isNewFilter - Se true, limpa a tabela antes de renderizar.
 */
function renderMovimentacoes(isNewFilter = false) {
    const tbody = document.querySelector("#movimentacoesTable tbody");
    const btnLoadMore = document.getElementById("btn-load-more");

    if (isNewFilter) {
        tbody.innerHTML = ''; // Limpa a tabela para novos filtros
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedData = filteredMovimentacoes.slice(startIndex, endIndex);

    // Se for um novo filtro e não houver resultados
    if (isNewFilter && filteredMovimentacoes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9">Nenhuma movimentação encontrada.</td></tr>';
        btnLoadMore.style.display = 'none';
        return;
    }
    
    // Se não houver mais itens para carregar (em uma página > 1)
    if (paginatedData.length === 0 && !isNewFilter) {
         btnLoadMore.style.display = 'none';
         return;
    }

    paginatedData.forEach(mov => {
        const row = tbody.insertRow();
        const date = new Date(mov.Timestamp);
        const formattedDate = date.toLocaleString('pt-BR');
        
        row.insertCell().textContent = formattedDate;
        row.insertCell().textContent = mov.TipoMovimentacao || 'N/A';
        row.insertCell().textContent = mov.NaturezaOperacao || 'N/A';
        row.insertCell().textContent = mov.Descricao || 'N/A';
        row.insertCell().textContent = mov.Lote || 'N/A';
        row.insertCell().textContent = mov.PesoKG !== undefined && !isNaN(Number(mov.PesoKG)) ? `${Number(mov.PesoKG).toFixed(2)} KG` : 'N/A';
        row.insertCell().textContent = mov.OrigemDestino || 'N/A';
        row.insertCell().textContent = mov.Observacao || 'N/A';
        row.insertCell().textContent = mov.Usuario || 'N/A';
    });
    
    // Atualiza o botão "Carregar Mais"
    if ((currentPage * itemsPerPage) >= filteredMovimentacoes.length) {
        btnLoadMore.style.display = 'none'; // Esconde se todos os itens foram carregados
    } else {
        btnLoadMore.style.display = 'block'; // Mostra se houver mais itens
    }
}

/**
 * Aplica os filtros e renderiza a primeira página de resultados
 */
function applyFiltersAndRender() {
    const searchInput = document.getElementById("searchInput");
    const typeFilter = document.getElementById("typeFilter");
    const startDateInput = document.getElementById("startDate");
    const endDateInput = document.getElementById("endDate");

    if (!searchInput || !typeFilter || !startDateInput || !endDateInput) {
        console.error('Alguns elementos de filtro não foram encontrados');
        return;
    }

    const searchTerm = searchInput.value.toLowerCase().trim();
    const selectedType = typeFilter.value.trim();
    const startDate = startDateInput.value ? new Date(startDateInput.value + "T00:00:00") : null;
    const endDate = endDateInput.value ? new Date(endDateInput.value + "T23:59:59") : null;

    filteredMovimentacoes = allMovimentacoes.filter(mov => {
        if (searchTerm) {
            const inSearch = (mov.Descricao && mov.Descricao.toLowerCase().includes(searchTerm)) ||
                             (mov.Lote && mov.Lote.toLowerCase().includes(searchTerm)) ||
                             (mov.OrigemDestino && mov.OrigemDestino.toLowerCase().includes(searchTerm)) ||
                             (mov.Observacao && mov.Observacao.toLowerCase().includes(searchTerm)) ||
                             (mov.TipoMovimentacao && mov.TipoMovimentacao.toLowerCase().includes(searchTerm)) ||
                             (mov.NaturezaOperacao && mov.NaturezaOperacao.toLowerCase().includes(searchTerm)) ||
                             (mov.Usuario && mov.Usuario.toLowerCase().includes(searchTerm));
            if (!inSearch) return false;
        }

        if (selectedType && mov.TipoMovimentacao !== selectedType) {
            return false;
        }

        const movDate = new Date(mov.Timestamp);
        if (startDate && movDate < startDate) {
            return false;
        }
        if (endDate && movDate > endDate) {
            return false;
        }
        
        return true;
    });

    currentPage = 1; // Reseta para a primeira página
    renderMovimentacoes(true); // Renderiza como um novo filtro
}

/**
 * Carrega a próxima página de itens
 */
function loadMoreItems() {
    currentPage++;
    renderMovimentacoes(false); // Renderiza sem limpar a tabela
}

/**
 * Configura os listeners de eventos na página.
 */
function setupEventListeners() {
    const applyFiltersButton = document.getElementById("applyFilters");
    const searchInput = document.getElementById("searchInput");
    const typeFilter = document.getElementById("typeFilter");
    const startDateInput = document.getElementById("startDate");
    const endDateInput = document.getElementById("endDate");
    const clearFiltersButton = document.getElementById("clearFilters");
    
    // Botão de Carregar Mais
    document.getElementById('btn-load-more').addEventListener('click', loadMoreItems);
    
    // Conecta a busca da barra superior ao campo de busca principal
    const topSearchInput = document.getElementById("search-movimentacao");
    if (topSearchInput) {
        topSearchInput.addEventListener("keyup", (event) => {
            if (event.key === "Enter") {
                if (searchInput) searchInput.value = topSearchInput.value;
                applyFiltersAndRender();
            }
        });
        topSearchInput.addEventListener("input", () => {
            if (searchInput) searchInput.value = topSearchInput.value;
            applyFiltersAndRender();
        });
    }

    if (applyFiltersButton) {
        applyFiltersButton.addEventListener("click", applyFiltersAndRender);
    }

    if (searchInput) {
        searchInput.addEventListener("keyup", (event) => {
            if (event.key === "Enter") {
                applyFiltersAndRender();
            }
        });
        searchInput.addEventListener("input", applyFiltersAndRender);
    }

    if (typeFilter) {
        typeFilter.addEventListener("change", applyFiltersAndRender);
    }

    if (startDateInput) {
        startDateInput.addEventListener("change", applyFiltersAndRender);
    }

    if (endDateInput) {
        endDateInput.addEventListener("change", applyFiltersAndRender);
    }

    if (clearFiltersButton) {
        clearFiltersButton.addEventListener("click", () => {
            if (topSearchInput) topSearchInput.value = "";
            if (searchInput) searchInput.value = "";
            if (typeFilter) typeFilter.value = "";
            if (startDateInput) startDateInput.value = "";
            if (endDateInput) endDateInput.value = "";
            applyFiltersAndRender();
        });
    }
}