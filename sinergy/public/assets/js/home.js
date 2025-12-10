/**
 * js/home.js - Dashboard Inteligente (Integrado e Autenticado)
 * Correção: Agora envia as credenciais do usuário ao buscar os Pedidos para o KPI.
 */

document.addEventListener('DOMContentLoaded', async () => {
    updateCurrentDate();
    updateWelcomeMessage();
    addNavigationListeners();
    displayFatoresBobinas();
    
    // Carrega os dados reais do sistema
    await loadDashboardData();
});

const API_URL = 'https://virtualcriacoes.com/sinergy/api';

// === FATORES DE CÁLCULO ===
const FATORES_MATERIAL_DASHBOARD = {
    'Meia-Cana': 0.8,
    'Meia-Cana Transvision': 0.7,
    'Super-Cana': 1.48,
    'Eixo': 3.65,
    'Soleira': 1.00,
    'Guia 50': 1.25,
    'Guia 60': 1.50,
    'Guia 70': 1.75,
    'Guia 100': 2.75
};

// Variável global para controlar o gráfico
let stockChartInstance = null;

async function loadDashboardData() {
    try {
        // 1. Prepara a URL de Pedidos com Autenticação (IGUAL AO PEDIDOS.JS)
        const role = window.getLoggedInUserRole();
        const nomeUsuario = window.getLoggedInUserFullName();
        
        let urlPedidos = `${API_URL}/pedidos`;
        if (role === 'admin') {
            urlPedidos += `?role=admin`;
        } else {
            // Se for vendedor, busca apenas os dele
            urlPedidos += `?role=vendedor&nomeVendedor=${encodeURIComponent(nomeUsuario)}`;
        }

        // 2. Busca todos os dados em paralelo
        const [bobinas, producoes, pedidos, movimentacoes, financeiro] = await Promise.all([
            fetch(`${API_URL}/bobinas`).then(res => res.ok ? res.json() : []),
            fetch(`${API_URL}/producoes`).then(res => res.ok ? res.json() : []),
            fetch(urlPedidos).then(res => res.ok ? res.json() : []), // <--- URL CORRIGIDA AQUI
            fetch(`${API_URL}/movimentacoes`).then(res => res.ok ? res.json() : []),
            fetch(`${API_URL}/contasareceber`).then(res => res.ok ? res.json() : [])
        ]);

        // 3. Atualiza a tela
        updateKPIs(bobinas, producoes, pedidos, financeiro);
        renderStockChart(bobinas);
        renderProductionChart(producoes);
        updateActivityFeed(movimentacoes);

    } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
    }
}

function updateKPIs(bobinas, producoes, pedidos, financeiro) {
    // Estoque
    const totalPesoEstoque = bobinas.reduce((acc, b) => acc + parseFloat(b.Peso || 0), 0);
    const totalQtdBobinas = bobinas.filter(b => parseFloat(b.Peso) > 0).length;
    document.getElementById('kpi-stock-weight').textContent = `${formatNumber(totalPesoEstoque)} kg`;
    document.getElementById('kpi-stock-count').textContent = `${totalQtdBobinas} bobinas`;

    // Produção Mês Atual
    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();
    
    const prodsMes = producoes.filter(p => {
        const d = new Date(p.DataProducao);
        return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
    });
    
    let pesoProduzidoMes = 0;
    prodsMes.forEach(p => {
        if(p.itens) {
            p.itens.forEach(i => pesoProduzidoMes += parseFloat(i.Peso || 0));
        }
    });

    document.getElementById('kpi-production-weight').textContent = `${formatNumber(pesoProduzidoMes)} kg`;
    document.getElementById('kpi-production-count').textContent = `${prodsMes.length} ordens`;

    // Pedidos em Aberto (CORRIGIDO: Filtra qualquer status que não seja final)
    const pedidosAbertos = pedidos.filter(p => p.StatusPedido !== 'Concluído' && p.StatusPedido !== 'Cancelado');
    
    const valorTotalAberto = pedidosAbertos.reduce((acc, p) => acc + parseFloat(p.ValorTotal || 0), 0);
    
    document.getElementById('kpi-orders-open').textContent = pedidosAbertos.length;
    document.getElementById('kpi-orders-value').textContent = formatCurrency(valorTotalAberto);

    // Financeiro (A Receber Pendente)
    const receberPendente = financeiro.filter(c => c.Status === 'Aguardando' || c.Status === 'Vencido');
    const totalReceber = receberPendente.reduce((acc, c) => acc + parseFloat(c.Valor || 0), 0);
    document.getElementById('kpi-finance-pending').textContent = formatCurrency(totalReceber);
}

function renderStockChart(bobinas) {
    const ctx = document.getElementById('stockChart').getContext('2d');
    
    // Agrupa peso por Tipo
    const grupos = {};
    bobinas.forEach(b => {
        if (parseFloat(b.Peso) > 0) {
            const tipo = b.Tipo;
            if (!grupos[tipo]) grupos[tipo] = 0;
            grupos[tipo] += parseFloat(b.Peso);
        }
    });

    // Ordena
    const sorted = Object.entries(grupos).sort((a, b) => b[1] - a[1]);
    const labels = sorted.map(item => item[0]);
    const dataValues = sorted.map(item => item[1]);

    if (stockChartInstance) {
        stockChartInstance.destroy();
    }

    stockChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Peso em Estoque (kg)',
                data: dataValues,
                backgroundColor: 'rgba(52, 152, 219, 0.8)', 
                borderColor: 'rgba(52, 152, 219, 1)',
                borderWidth: 1,
                borderRadius: 4,
                barPercentage: 0.7
            }]
        },
        options: {
            indexAxis: 'y', 
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.x !== null) {
                                label += context.parsed.x.toLocaleString('pt-BR', {minimumFractionDigits: 2}) + ' kg';
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: '#f0f0f0' },
                    ticks: { callback: (value) => value.toLocaleString('pt-BR') }
                },
                y: {
                    grid: { display: false },
                    ticks: { font: { weight: 'bold' } }
                }
            }
        }
    });
}

function renderProductionChart(producoes) {
    const ctx = document.getElementById('productionChart').getContext('2d');
    
    const meses = [];
    const dados = [];
    const hoje = new Date();
    
    for (let i = 5; i >= 0; i--) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        const label = d.toLocaleDateString('pt-BR', { month: 'short' });
        meses.push(label);
        
        const pesoMes = producoes.reduce((acc, p) => {
            const pd = new Date(p.DataProducao);
            if (pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear()) {
                if(p.itens) p.itens.forEach(item => acc += parseFloat(item.Peso || 0));
            }
            return acc;
        }, 0);
        dados.push(pesoMes);
    }

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: meses,
            datasets: [{
                label: 'Produção (kg)',
                data: dados,
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

function updateActivityFeed(movimentacoes) {
    const list = document.getElementById('recent-activities-list');
    list.innerHTML = '';
    
    const ultimas = movimentacoes.slice(0, 5);
    
    if (ultimas.length === 0) {
        list.innerHTML = '<li class="activity-item" style="color:#999; padding:10px;">Nenhuma atividade recente.</li>';
        return;
    }

    ultimas.forEach(mov => {
        const icon = getIconForActivity(mov.TipoMovimentacao);
        const time = new Date(mov.Timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        
        const li = document.createElement('li');
        li.className = 'activity-item';
        li.innerHTML = `
            <div class="act-icon"><i class="fas ${icon}"></i></div>
            <div class="act-content">
                <span class="act-title">${mov.TipoMovimentacao} - ${mov.Descricao}</span>
                <span class="act-time">${time} • ${mov.Usuario || 'Sistema'}</span>
            </div>
        `;
        list.appendChild(li);
    });
}

function displayFatoresBobinas() {
    const list = document.getElementById('fatores-bobinas-list');
    if (!list) return;
    
    list.innerHTML = '';
    for (const [tipo, fator] of Object.entries(FATORES_MATERIAL_DASHBOARD)) {
        list.innerHTML += `<li><strong>${tipo}</strong> <span>${fator} kg/m</span></li>`;
    }
}

// Utils
function getIconForActivity(tipo) {
    if (!tipo) return 'fa-info';
    const t = tipo.toLowerCase();
    if (t.includes('entrada') || t.includes('compra')) return 'fa-arrow-down';
    if (t.includes('saída') || t.includes('venda')) return 'fa-arrow-up';
    if (t.includes('produção')) return 'fa-hammer';
    return 'fa-exchange-alt';
}

function updateWelcomeMessage() {
    const el = document.getElementById('welcome-name');
    if (el) {
        const fullName = window.getLoggedInUserFullName() || window.getLoggedInUser();
        if (fullName) el.textContent = fullName.split(' ')[0];
    }
}

function updateCurrentDate() {
    const el = document.getElementById('current-date');
    if (el) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        el.textContent = new Date().toLocaleDateString('pt-BR', options);
    }
}

function addNavigationListeners() { 
    /* Lógica de cliques específicos da home, se necessário */ 
}

function formatNumber(n) { return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function formatCurrency(n) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }