// relatorios.js

document.addEventListener('DOMContentLoaded', function() {
    initPage();
    setupEventListeners();
    loadData();
});

let charts = {};
let reportData = {};

/**
 * Inicializa a página e popula os filtros de ano.
 */
function initPage() {
    initModals();
}

/**
 * Popula o filtro de ano dinamicamente com base nos anos presentes nos dados de produção.
 * @param {Array<object>} producoes - Array de produções carregadas da API.
 */
function populateYearFilter() {
    const yearFilter = document.getElementById('filtro-ano');
    const currentYear = new Date().getFullYear();
    const startYear = 2024; // Defina um ano de início para a sua empresa

    yearFilter.innerHTML = '<option value="">Todos os Anos</option>';
    for (let year = currentYear; year >= startYear; year--) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearFilter.appendChild(option);
    }
}


/**
 * Configuração dos listeners de eventos.
 */
function setupEventListeners() {
    document.getElementById('filtro-periodo').addEventListener('change', function() {
        const periodoValue = this.value;
        const periodoCustom = document.getElementById('periodo-custom');
        
        if (periodoValue === 'custom') {
            periodoCustom.classList.add('visible');
        } else {
            periodoCustom.classList.remove('visible');
            applyPeriodFilter(periodoValue);
        }
    });

    document.getElementById('btn-aplicar-filtros').addEventListener('click', function() {
        loadData();
    });
    
    document.getElementById('filtro-mes').addEventListener('change', function() {
        document.getElementById('filtro-periodo').value = '';
        document.getElementById('periodo-custom').classList.remove('visible');
    });
    
    document.getElementById('filtro-ano').addEventListener('change', function() {
        document.getElementById('filtro-periodo').value = '';
        document.getElementById('periodo-custom').classList.remove('visible');
    });

    document.getElementById('btn-aplicar-periodo').addEventListener('click', function() {
        document.getElementById('filtro-periodo').value = 'custom';
        loadData();
    });
    
    document.getElementById('btn-exportar').addEventListener('click', function() {
        document.getElementById('modal-exportacao').style.display = 'block';
    });
    
    document.getElementById('btn-confirma-exportacao').addEventListener('click', function() {
        exportReport();
    });
}

/**
 * Carrega e exibe os dados.
 */
async function loadData() {
    // Carregar dados da API
    const bobinaDatabase = await getBobinaDatabase();
    const producaoDatabase = await getProdutoDatabase();
    
    populateYearFilter(); // Garante que o filtro de ano é populado ao carregar
    
    processReportData(bobinaDatabase, producaoDatabase);
    updateKPIs();
    updateDetailsTable();
    renderCharts();
}

/**
 * Recupera dados de bobinas da API
 */
async function getBobinaDatabase() {
    try {
        const response = await fetch('https://virtualcriacoes.com/sinergy/api/bobinas');
        if (!response.ok) throw new Error('Falha ao carregar bobinas para relatórios.');
        const data = await response.json();
        return data.map(bobina => ({
            ...bobina,
            Peso: parseFloat(bobina.Peso),
            DataRecebimento: new Date(bobina.DataRecebimento + 'T00:00:00') 
        }));
    } catch (e) {
        console.error("Erro ao ler bobinas da API para relatórios:", e);
        return [];
    }
}

/**
 * Recupera dados de produções da API
 */
async function getProdutoDatabase() {
    try {
        const response = await fetch('https://virtualcriacoes.com/sinergy/api/producoes');
        if (!response.ok) throw new Error('Falha ao carregar produções para relatórios.');
        const data = await response.json();
        return data.map(producao => ({
            ...producao,
            DataProducao: (() => {
                const d = new Date(producao.DataProducao);
                return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
            })(),
            itens: producao.itens.map(item => ({
                ...item,
                Peso: parseFloat(item.Peso),
                SucataEsperada: parseFloat(item.SucataEsperada || 0),
                bobinasUsadas: item.bobinasUsadas.map(bu => ({
                    ...bu,
                    PesoUsado: parseFloat(bu.PesoUsado),
                    SucataGerada: parseFloat(bu.SucataGerada || 0)
                }))
            }))
        }));
    } catch (e) {
        console.error("Erro ao ler produções da API para relatórios:", e);
        return [];
    }
}

/**
 * Processa os dados para geração dos relatórios.
 */
function processReportData(bobinaDatabase, producaoDatabase) {
    reportData = {
        totalEstoque: 0,
        totalProducao: 0,
        totalSucata: 0,
        taxaAproveitamento: 0,
        totalBobinas: 0,
        totalProdutos: 0,
        porTipo: {},
        porPeriodo: {},
        filteredStartDate: null,
        filteredEndDate: null
    };

    const filterPeriodo = document.getElementById('filtro-periodo').value;
    const filterMes = document.getElementById('filtro-mes').value;
    const filterAno = document.getElementById('filtro-ano').value;
    let startDate, endDate;

    if (filterPeriodo === 'custom') {
        startDate = new Date(document.getElementById('data-inicio').value + 'T00:00:00');
        endDate = new Date(document.getElementById('data-fim').value + 'T23:59:59');
    } else if (filterPeriodo) {
        endDate = new Date();
        startDate = new Date();
        const days = parseInt(filterPeriodo);
        startDate.setDate(endDate.getDate() - days);
        endDate.setHours(23, 59, 59, 999);
    } else if (filterMes || filterAno) {
        let year = filterAno || new Date().getFullYear();
        let month = filterMes || new Date().getMonth() + 1;
        startDate = new Date(year, month - 1, 1, 0, 0, 0);
        endDate = new Date(year, month, 0, 23, 59, 59, 999);
    } else { // Padrão: Últimos 30 dias se nenhum filtro estiver ativo
        endDate = new Date();
        startDate = new Date();
        startDate.setDate(endDate.getDate() - 30);
        endDate.setHours(23, 59, 59, 999);
    }
    
    reportData.filteredStartDate = startDate;
    reportData.filteredEndDate = endDate;

    bobinaDatabase.forEach(bobina => {
        const pesoEstoque = Number(bobina.Peso);
        reportData.totalEstoque += pesoEstoque;
        if (pesoEstoque > 0) {
            reportData.totalBobinas++;
        }

        const tipoMaterial = bobina.Tipo;
        if (!reportData.porTipo[tipoMaterial]) {
            reportData.porTipo[tipoMaterial] = {
                estoque: 0,
                producao: 0,
                sucata: 0,
                aproveitamento: 0,
                qtdBobinas: 0,
                qtdProdutos: 0
            };
        }
        reportData.porTipo[tipoMaterial].estoque += pesoEstoque;
        if (pesoEstoque > 0) {
            reportData.porTipo[tipoMaterial].qtdBobinas++;
        }
    });

    producaoDatabase.forEach(producao => {
        const dataProducao = producao.DataProducao;
        if (dataProducao >= reportData.filteredStartDate && dataProducao <= reportData.filteredEndDate) {
            reportData.totalProdutos++;

            producao.itens.forEach(item => {
                const pesoItemProduzido = Number(item.Peso);
                let sucataTotalDoItem = 0;
                let tipoPrincipalDoItem = item.Tipo;
                
                item.bobinasUsadas.forEach(bobinaUsada => {
                    sucataTotalDoItem += Number(bobinaUsada.SucataGerada || 0);
                });

                reportData.totalProducao += pesoItemProduzido;
                reportData.totalSucata += sucataTotalDoItem;

                if (!reportData.porTipo[tipoPrincipalDoItem]) {
                    reportData.porTipo[tipoPrincipalDoItem] = {
                        estoque: 0,
                        producao: 0,
                        sucata: 0,
                        aproveitamento: 0,
                        qtdBobinas: 0,
                        qtdProdutos: 0
                    };
                }
                reportData.porTipo[tipoPrincipalDoItem].producao += pesoItemProduzido;
                reportData.porTipo[tipoPrincipalDoItem].sucata += sucataTotalDoItem;
            });

            const mesAno = `${dataProducao.getMonth() + 1}/${dataProducao.getFullYear()}`;
            if (!reportData.porPeriodo[mesAno]) {
                reportData.porPeriodo[mesAno] = { producao: 0, sucata: 0, aproveitamento: 0 };
            }
            producao.itens.forEach(item => {
                const pesoItemProduzido = Number(item.Peso);
                let sucataTotalDoItem = item.bobinasUsadas.reduce((sum, bu) => sum + Number(bu.SucataGerada || 0), 0);
                reportData.porPeriodo[mesAno].producao += pesoItemProduzido;
                reportData.porPeriodo[mesAno].sucata += sucataTotalDoItem;
            });
        }
    });

    const totalMaterialConsumido = reportData.totalProducao + reportData.totalSucata;
    reportData.taxaAproveitamento = totalMaterialConsumido > 0
        ? (reportData.totalProducao / totalMaterialConsumido) * 100
        : 0;

    Object.keys(reportData.porTipo).forEach(tipo => {
        const dados = reportData.porTipo[tipo];
        const totalMaterialPorTipo = dados.producao + dados.sucata;
        dados.aproveitamento = totalMaterialPorTipo > 0
            ? (dados.producao / totalMaterialPorTipo) * 100
            : 0;
    });

    Object.keys(reportData.porPeriodo).forEach(periodo => {
        const dados = reportData.porPeriodo[periodo];
        const totalMaterialPorPeriodo = dados.producao + dados.sucata;
        dados.aproveitamento = totalMaterialPorPeriodo > 0
            ? (dados.producao / totalMaterialPorPeriodo) * 100
            : 0;
    });
}

// ... (o restante das funções como `updateKPIs`, `updateDetailsTable`,
//      `renderCharts` e `exportReport` permanece o mesmo) ...

/**
 * Inicializa os modais
 */
function initModals() {
    document.querySelectorAll('.close-modal, .cancel-modal').forEach(function(button) {
        button.addEventListener('click', function() {
            document.querySelectorAll('.modal').forEach(function(modal) {
                modal.style.display = 'none';
            });
        });
    });
    
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });
}

/**
 * Renderiza o gráfico de Produção vs. Estoque
 */
function renderProducaoEstoqueChart() {
    const ctx = document.getElementById('grafico-producao-estoque').getContext('2d');
    
    charts.producaoEstoque = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Peso Total (kg)'],
            datasets: [
                {
                    label: 'Em Estoque',
                    data: [reportData.totalEstoque],
                    backgroundColor: 'rgba(52, 152, 219, 0.7)',
                    borderColor: 'rgba(52, 152, 219, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Produzido',
                    data: [reportData.totalProducao],
                    backgroundColor: 'rgba(46, 204, 113, 0.7)',
                    borderColor: 'rgba(46, 204, 113, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Sucata',
                    data: [reportData.totalSucata],
                    backgroundColor: 'rgba(231, 76, 60, 0.7)',
                    borderColor: 'rgba(231, 76, 60, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Peso (kg)'
                    }
                }
            },
            plugins: {
                title: {
                    display: false
                },
                legend: {
                    position: 'top'
                }
            }
        }
    });
}

/**
 * Renderiza o gráfico de Aproveitamento de Material
 */
function renderAproveitamentoChart() {
    const ctx = document.getElementById('grafico-aproveitamento').getContext('2d');
    
    const aproveitamento = reportData.totalProducao;
    const perdas = reportData.totalSucata;
    
    charts.aproveitamento = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Material Aproveitado', 'Sucata'],
            datasets: [{
                data: [aproveitamento, perdas],
                backgroundColor: [
                    'rgba(46, 204, 113, 0.7)',
                    'rgba(231, 76, 60, 0.7)'
                ],
                borderColor: [
                    'rgba(46, 204, 113, 1)',
                    'rgba(231, 76, 60, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: false
                },
                legend: {
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                            return `${label}: ${value.toFixed(2)} kg (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Renderiza o gráfico por Tipo de Material
 */
function renderTipoMaterialChart() {
    const ctx = document.getElementById('grafico-tipo-material').getContext('2d');
    
    const tipos = Object.keys(reportData.porTipo);
    const producaoData = tipos.map(tipo => reportData.porTipo[tipo].producao);
    const sucataData = tipos.map(tipo => reportData.porTipo[tipo].sucata);
    
    charts.tipoMaterial = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: tipos,
            datasets: [
                {
                    label: 'Produção',
                    data: producaoData,
                    backgroundColor: 'rgba(46, 204, 113, 0.7)',
                    borderColor: 'rgba(46, 204, 113, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Sucata',
                    data: sucataData,
                    backgroundColor: 'rgba(231, 76, 60, 0.7)',
                    borderColor: 'rgba(231, 76, 60, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: false
                },
                y: {
                    stacked: false,
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Peso (kg)'
                    }
                }
            },
            plugins: {
                title: {
                    display: false
                },
                legend: {
                    position: 'top'
                }
            }
        }
    });
}

/**
 * Renderiza o gráfico de Tendência Mensal
 */
function renderTendenciaChart() {
    const ctx = document.getElementById('grafico-tendencia').getContext('2d');
    
    const periodos = Object.keys(reportData.porPeriodo).sort((a, b) => {
        const [mesA, anoA] = a.split('/');
        const [mesB, anoB] = b.split('/');
        
        if (anoA !== anoB) {
            return anoA - anoB;
        }
        
        return mesA - mesB;
    });
    
    const labels = periodos.map(periodo => {
        const [mes, ano] = periodo.split('/');
        return `${mes.padStart(2, '0')}/${ano}`;
    });
    
    const producaoData = periodos.map(periodo => reportData.porPeriodo[periodo].producao);
    const aproveitamentoData = periodos.map(periodo => reportData.porPeriodo[periodo].aproveitamento);
    
    charts.tendencia = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Produção (kg)',
                    data: producaoData,
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    borderColor: 'rgba(52, 152, 219, 1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    label: 'Aproveitamento (%)',
                    data: aproveitamentoData,
                    backgroundColor: 'rgba(241, 196, 15, 0)',
                    borderColor: 'rgba(241, 196, 15, 1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Produção (kg)'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    min: 0,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Aproveitamento (%)'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            },
            plugins: {
                title: {
                    display: false
                },
                legend: {
                    position: 'top'
                }
            }
        }
    });
}

function updateKPIs() {
    document.getElementById('peso-estoque').textContent = `${reportData.totalEstoque.toFixed(2)} kg`;
    document.getElementById('peso-producao').textContent = `${reportData.totalProducao.toFixed(2)} kg`;
    document.getElementById('peso-sucata').textContent = `${reportData.totalSucata.toFixed(2)} kg`;
    document.getElementById('taxa-aproveitamento').textContent = `${reportData.taxaAproveitamento.toFixed(1)}%`;
    document.getElementById('total-bobinas').textContent = reportData.totalBobinas;
    document.getElementById('total-produtos').textContent = reportData.totalProdutos;
}

function updateDetailsTable() {
    const tableBody = document.querySelector('#tabela-detalhes tbody');
    tableBody.innerHTML = '';
    
    Object.keys(reportData.porTipo).forEach(tipo => {
        const dados = reportData.porTipo[tipo];
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${tipo}</td>
            <td>${dados.estoque.toFixed(2)} kg</td>
            <td>${dados.producao.toFixed(2)} kg</td>
            <td>${dados.sucata.toFixed(2)} kg</td>
            <td>${dados.aproveitamento.toFixed(1)}%</td>
            <td>${dados.qtdBobinas}</td>
            <td>${dados.qtdProdutos}</td>
        `;
        
        tableBody.appendChild(row);
    });
    
    document.getElementById('total-estoque').textContent = `${reportData.totalEstoque.toFixed(2)} kg`;
    document.getElementById('total-producao').textContent = `${reportData.totalProducao.toFixed(2)} kg`;
    document.getElementById('total-sucata').textContent = `${reportData.totalSucata.toFixed(2)} kg`;
    document.getElementById('media-aproveitamento').textContent = `${reportData.taxaAproveitamento.toFixed(1)}%`;
    document.getElementById('soma-bobinas').textContent = reportData.totalBobinas;
    document.getElementById('soma-produtos').textContent = reportData.totalProdutos;
}

function renderCharts() {
    Object.values(charts).forEach(chart => {
        if (chart) chart.destroy();
    });
    
    renderProducaoEstoqueChart();
    renderAproveitamentoChart();
    renderTipoMaterialChart();
    renderTendenciaChart();
}

function applyPeriodFilter(periodoValue) {
    const dataFimInput = document.getElementById('data-fim');
    const dataInicioInput = document.getElementById('data-inicio');
    const dataFim = new Date();
    dataFimInput.valueAsDate = dataFim;
    const dataInicio = new Date();
    const dias = parseInt(periodoValue);
    if (dias) {
        dataInicio.setDate(dataFim.getDate() - dias);
    } else {
        dataInicio.setFullYear(dataFim.getFullYear() - 5);
    }
    dataInicioInput.valueAsDate = dataInicio;
    loadData();
}

function exportReport() {
    const formatoExportacao = document.getElementById('formato-exportacao').value;
    const nomeArquivo = document.getElementById('nome-arquivo').value || 'Relatório Sinergy';
    const incluirKPI = document.getElementById('export-kpi').checked;
    const incluirGraficos = document.getElementById('export-graficos').checked;
    const incluirTabela = document.getElementById('export-tabela').checked;
    
    let content = '';
    let fileExtension = '';

    if (formatoExportacao === 'csv' || formatoExportacao === 'excel') {
        fileExtension = 'csv';
        let csvContent = [];
        csvContent.push(`Relatório Sinergy - Gerado em: ${new Date().toLocaleDateString('pt-BR')}`);
        csvContent.push(''); 

        if (incluirKPI) {
            csvContent.push('Indicadores-Chave de Desempenho (KPIs)');
            csvContent.push(`Peso Total em Estoque,${reportData.totalEstoque.toFixed(2)} kg`);
            csvContent.push(`Peso Total Produzido,${reportData.totalProducao.toFixed(2)} kg`);
            csvContent.push(`Total de Sucata Gerada,${reportData.totalSucata.toFixed(2)} kg`);
            csvContent.push(`Taxa de Aproveitamento,${reportData.taxaAproveitamento.toFixed(1)}%`);
            csvContent.push(`Total de Bobinas,${reportData.totalBobinas}`);
            csvContent.push(`Total de Produções,${reportData.totalProdutos}`);
            csvContent.push('');
        }

        if (incluirTabela) {
            csvContent.push('Detalhamento por Tipo de Material');
            csvContent.push('Tipo de Material,Estoque (kg),Produção (kg),Sucata (kg),Aproveitamento (%),Qtd. Bobinas,Qtd. Produções');
            
            Object.keys(reportData.porTipo).forEach(tipo => {
                const dados = reportData.porTipo[tipo];
                csvContent.push(
                    `"${tipo}",` +
                    `${dados.estoque.toFixed(2)},` +
                    `${dados.producao.toFixed(2)},` +
                    `${dados.sucata.toFixed(2)},` +
                    `${dados.aproveitamento.toFixed(1)},` +
                    `${dados.qtdBobinas},` +
                    `${dados.qtdProdutos}`
                );
            });
            csvContent.push('');
            csvContent.push('Totais,');
            csvContent.push(
                `Total,${reportData.totalEstoque.toFixed(2)} kg,` +
                `${reportData.totalProducao.toFixed(2)} kg,` +
                `${reportData.totalSucata.toFixed(2)} kg,` +
                `${reportData.taxaAproveitamento.toFixed(1)}%,` +
                `${reportData.totalBobinas},` +
                `${reportData.totalProdutos}`
            );
        }

        if (incluirGraficos) {
            showMessage('Gráficos não podem ser exportados para CSV/Excel. Considere a opção PDF para incluí-los (requer bibliotecas adicionais).', 'warning');
        }

        content = csvContent.join('\n');
        
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `${nomeArquivo}.${fileExtension}`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showMessage('Relatório exportado com sucesso para CSV!', 'success');
        } else {
            showMessage('Seu navegador não suporta download automático de arquivos. Tente copiar o conteúdo manualmente.', 'error');
        }
    } else if (formatoExportacao === 'pdf') {
        fileExtension = 'pdf';
        showMessage('A exportação para PDF requer bibliotecas adicionais (ex: jsPDF). ' +
                    'Considere usar a função de impressão do navegador (Ctrl+P ou Cmd+P) ou entre em contato para mais opções.', 'info');
    }
    
    document.getElementById('modal-exportacao').style.display = 'none';
}