/**
 * saldo.js - Funcionalidades para a página de saldo de estoque (Corrigido)
 * Correção: Tratamento de casas decimais na Largura para agrupar corretamente.
 */

document.addEventListener('DOMContentLoaded', function() {
    initPage();
    setupEventListeners();
    loadSaldoData();
});

let bobinaDatabase = [];
let summarizedData = {};

// Códigos para exportação (Opcional)
const PRODUTO_CODIGOS = {
    'Meia-Cana 125mm': 19844,
    'Meia-Cana 136mm': 11699,
    'Meia-Cana Transvision': 11682,
    'Super-Cana': 19839,
    'Guia 50': 11647,
    'Guia 60': 11653,
    'Guia 70': 11660,
    'Guia 100': 11676,
    'Soleira': 11631,
    'Eixo': 11624
};

// Lista de tipos para garantir a ordem e a exibição
const ALL_MATERIAL_TYPES = [
    'Meia-Cana 125mm',
    'Meia-Cana 136mm',
    'Meia-Cana Transvision',
    'Super-Cana',
    'Guia 50',
    'Guia 60',
    'Guia 70',
    'Guia 100',
    'Soleira',
    'Eixo',
];

// Limites para colorir as badges (Baixo/Regular/Normal)
const limitesEstoque = {    
    'Meia-Cana 125mm': { baixo: 4999, regular: 6999 },
    'Meia-Cana 136mm': { baixo: 2999, regular: 3999 },
    'Meia-Cana Transvision': { baixo: 2500, regular: 5000 },
    'Super-Cana': { baixo: 2500, regular: 4000 },
    'Guia 50': { baixo: 1000, regular: 1500 },
    'Guia 60': { baixo: 1000, regular: 1500 },
    'Guia 70': { baixo: 1500, regular: 2000 },
    'Guia 100': { baixo: 1000, regular: 1500 },
    'Soleira': { baixo: 1000, regular: 1500 },
    'Eixo': { baixo: 1500, regular: 2500 },
};

function initPage() {}

function setupEventListeners() {
    document.getElementById('filter-saldo-tipo')?.addEventListener('change', applyFilters);
    document.getElementById('filter-saldo-status')?.addEventListener('change', applyFilters);
    document.getElementById('search-saldo')?.addEventListener('input', applyFilters);
    document.getElementById('export-excel-btn')?.addEventListener('click', exportTableToCSV);
}

async function loadSaldoData() {
    try {
        const response = await fetch('https://virtualcriacoes.com/sinergy/api/bobinas');
        if (!response.ok) {
            throw new Error('Falha ao carregar saldo de bobinas.');
        }
        bobinaDatabase = await response.json();
        
        // Garante que Peso seja número
        bobinaDatabase.forEach(bob => {
            bob.Peso = parseFloat(bob.Peso);
        });

        summarizeBobinasByType();
        applyFilters();
        updateSummaryCards();
    } catch (error) {
        console.error('Erro ao carregar dados de saldo:', error);
        showMessage('Falha ao carregar saldo de estoque.', 'error');
    }
}

function summarizeBobinasByType() {
    summarizedData = {};

    // Inicializa com zero para todos os tipos esperados
    ALL_MATERIAL_TYPES.forEach(type => {
        summarizedData[type] = {
            totalWeight: 0,
            status: 'Indisponível',
            countAvailable: 0,
            countUnavailable: 0
        };
    });

    bobinaDatabase.forEach(bobina => {
        let tipo = bobina.Tipo;
        const peso = Number(bobina.Peso);
        const status = bobina.Status;
        
        // --- CORREÇÃO DA LÓGICA ---
        // Se for "Meia-Cana" ou "Lâmina 1/2 Cana", normaliza e adiciona a largura formatada
        if (tipo === 'Meia-Cana' || tipo === 'Lâmina 1/2 Cana') {
            // Converte para float para remover zeros decimais (ex: "136.00" -> 136)
            const largura = parseFloat(bobina.Largura);
            tipo = `Meia-Cana ${largura}mm`; 
        }
        // --------------------------

        // Se o tipo não existe na lista inicial (ex: novo material), cria ele
        if (!summarizedData[tipo]) {
             summarizedData[tipo] = {
                totalWeight: 0,
                status: 'Indisponível',
                countAvailable: 0,
                countUnavailable: 0
            };
        }

        // Soma os pesos
        summarizedData[tipo].totalWeight += peso;

        if (status === 'Disponível') {
            summarizedData[tipo].countAvailable++;
        } else {
            summarizedData[tipo].countUnavailable++;
        }
    });

    // Calcula Total Geral de Meia-Cana (Opcional, para exibir linha de total)
    const totalMeiaCanaPeso = (summarizedData['Meia-Cana 125mm']?.totalWeight || 0) + (summarizedData['Meia-Cana 136mm']?.totalWeight || 0);
    const totalMeiaCanaStatus = totalMeiaCanaPeso > 0 ? 'Disponível' : 'Indisponível';
    
    summarizedData['Total Meia-Cana'] = {
        totalWeight: totalMeiaCanaPeso,
        status: totalMeiaCanaStatus,
    };

    // Define status final baseado no peso total acumulado
    Object.keys(summarizedData).forEach(tipo => {
        const data = summarizedData[tipo];
        if (data.totalWeight > 0) {
            data.status = 'Disponível';
        } else {
            data.status = 'Indisponível';
        }
    });
}

function applyFilters() {
    const tipoFilter = document.getElementById('filter-saldo-tipo').value;
    const statusFilter = document.getElementById('filter-saldo-status').value;
    const searchTerm = document.getElementById('search-saldo').value.toLowerCase();

    const filteredTypes = Object.keys(summarizedData).filter(tipo => {
        const data = summarizedData[tipo];
        
        // Filtro de Tipo
        if (tipoFilter) {
            // Se o filtro for "Meia-Cana", mostra todas as variações
            if (tipoFilter === 'Meia-Cana') {
                if (!tipo.startsWith('Meia-Cana')) return false;
                if (tipo === 'Total Meia-Cana') return true; // Mantém o total
            } 
            // Senão, busca exato
            else if (tipo !== tipoFilter) {
                return false;
            }
        }

        // Filtro de Status
        if (statusFilter && data.status !== statusFilter) {
            return false;
        }

        // Busca por Texto
        if (searchTerm && !tipo.toLowerCase().includes(searchTerm)) {
            return false;
        }

        // Esconde a linha de "Total" se não houver filtro específico de Meia-Cana
        if (tipo === 'Total Meia-Cana' && tipoFilter !== 'Meia-Cana') return false;

        return true;
    });

    renderSaldoTable(filteredTypes);
}

function renderSaldoTable(filteredTypes) {
    const tableBody = document.querySelector('#tabela-saldo tbody');
    tableBody.innerHTML = '';

    if (filteredTypes.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding: 20px; color: #7f8c8d;">Nenhum material encontrado.</td></tr>`;
        return;
    }

    // Ordem de exibição na tabela
    const ordemDesejada = [
        'Super-Cana',
        'Meia-Cana 125mm',
        'Meia-Cana 136mm',
        'Meia-Cana Transvision',
        'Guia 50',
        'Guia 60',
        'Guia 70',
        'Guia 100',
        'Soleira',
        'Eixo',
        'Total Meia-Cana'
    ];

    const itemsToRender = filteredTypes.sort((a, b) => {
        let idxA = ordemDesejada.indexOf(a);
        let idxB = ordemDesejada.indexOf(b);
        // Se não estiver na lista, vai pro fim
        if (idxA === -1) idxA = 999;
        if (idxB === -1) idxB = 999;
        return idxA - idxB;
    });

    itemsToRender.forEach(tipo => {
        const data = summarizedData[tipo];
        let nivelEstoque = '';
        let nivelEstoqueClass = '';
        
        const peso = data.totalWeight;
        const limites = limitesEstoque[tipo];

        const estoqueMinimo = limites ? limites.baixo.toFixed(0) : '-';
        const estoqueRegular = limites ? limites.regular.toFixed(0) : '-';

        // Lógica de Cores (Badge)
        if (!limites) {
            nivelEstoque = '-';
            nivelEstoqueClass = 'status-info';
        } else {
            if (peso <= 0) {
                nivelEstoque = 'Zerado';
                nivelEstoqueClass = 'status-vazio';
            } else if (peso <= limites.baixo) {
                nivelEstoque = 'Baixo';
                nivelEstoqueClass = 'status-baixo';
            } else if (peso <= limites.regular) {
                nivelEstoque = 'Regular';
                nivelEstoqueClass = 'status-regular';
            } else {
                nivelEstoque = 'Saudável';
                nivelEstoqueClass = 'status-saudavel';
            }
        }

        const statusClass = data.status === 'Disponível' ? 'status-disponivel' : 'status-indisponivel';
        
        // Estilo especial para linha de Total
        let tipoDisplay = tipo;
        let rowClass = '';
        if (tipo.startsWith('Total')) {
            tipoDisplay = `<strong>${tipo}</strong>`;
            rowClass = 'total-row';
            nivelEstoque = ''; 
            nivelEstoqueClass = '';
        }

        const row = document.createElement('tr');
        row.className = rowClass;
        row.innerHTML = `
            <td>${tipoDisplay}</td>
            <td><strong>${peso.toLocaleString('pt-BR', {minimumFractionDigits: 2})} kg</strong></td>
            <td>${estoqueMinimo} kg</td>
            <td>${estoqueRegular} kg</td>
            <td>${nivelEstoque ? `<span class="status-badge ${nivelEstoqueClass}">${nivelEstoque}</span>` : ''}</td>
            <td><span class="status-badge ${statusClass}">${data.status}</span></td>
        `;
        tableBody.appendChild(row);
    });
}

function updateSummaryCards() {
    let totalPesoGeral = 0;
    let totalTipos = 0;

    Object.keys(summarizedData).forEach(tipo => {
        if (!tipo.startsWith('Total')) { // Não soma a linha de total
            const data = summarizedData[tipo];
            totalPesoGeral += data.totalWeight;
            if (data.totalWeight > 0) {
                totalTipos++;
            }
        }
    });

    document.getElementById('total-saldo-peso').textContent = `${totalPesoGeral.toLocaleString('pt-BR', {minimumFractionDigits: 2})} kg`;
    document.getElementById('total-saldo-tipos').textContent = totalTipos;
}

function exportTableToCSV() {
    let csvContent = [];
    const now = new Date();
    const formattedDate = now.toLocaleDateString('pt-BR');

    const newHeaders = ['Data', 'Material', 'Peso Total (kg)', 'Status'];
    csvContent.push(newHeaders.join(';'));
    
    // Exporta apenas o que está visível/filtrado
    const tiposVisiveis = Object.keys(summarizedData).filter(t => !t.startsWith('Total'));

    tiposVisiveis.forEach(tipo => {
        const data = summarizedData[tipo];
        if (data.totalWeight > 0) { // Exporta apenas o que tem saldo
            const pesoFormatado = data.totalWeight.toFixed(2).replace('.', ',');
            const rowData = [
                `"${formattedDate}"`,
                `"${tipo}"`,
                `"${pesoFormatado}"`,
                `"${data.status}"`
            ];
            csvContent.push(rowData.join(';'));
        }
    });
    
    const csvString = csvContent.join('\n');
    const bom = '\ufeff';
    const encodedUri = "data:text/csv;charset=utf-8," + encodeURIComponent(bom + csvString);
    
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `saldo_estoque_${now.getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function showMessage(message, type = 'info') {
    if (window.NotificationManager) {
        NotificationManager.show({
            title: type.charAt(0).toUpperCase() + type.slice(1),
            message: message,
            type: type
        });
    } else {
        console.log(message);
    }
}