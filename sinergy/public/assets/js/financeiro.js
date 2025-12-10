/**
 * financeiro.js - Dashboard Financeiro (Versão Blindada)
 */

document.addEventListener('DOMContentLoaded', () => {
    initializeAppFinanceiro();
});

const API_URL = 'https://virtualcriacoes.com/sinergy/api';
let charts = {}; 

async function initializeAppFinanceiro() {
    const loader = document.getElementById('loader-overlay');
    
    try {
        const response = await fetch(`${API_URL}/financeiro/dashboard`);
        if (!response.ok) throw new Error('Falha ao carregar dados');
        
        const data = await response.json();
        
        // Verifica e renderiza cada parte com segurança
        if (data.kpis) populateKPIs(data.kpis);
        
        if (data.charts && data.charts.fluxoCaixa) {
            renderFluxoCaixaChart(data.charts.fluxoCaixa);
        }
        
        if (data.charts && data.charts.despesasCategoria) {
            renderDespesasChart(data.charts.despesasCategoria);
        }
        
        if (data.listas) populateQuickLists(data.listas);

    } catch (error) {
        console.error("Erro financeiro:", error);
        if(window.NotificationManager) NotificationManager.show({ title:'Erro', message:'Falha ao carregar dashboard financeiro', type:'error' });
    } finally {
        if (loader) loader.style.display = 'none';
    }
}

function populateKPIs(kpis) {
    const setTxt = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
    setTxt('kpi-a-receber', formatarMoeda(kpis.aReceber));
    setTxt('kpi-a-pagar', formatarMoeda(kpis.aPagar));
    setTxt('kpi-saldo-previsto', formatarMoeda(kpis.saldoPrevisto));
    setTxt('kpi-recebido-30d', formatarMoeda(kpis.recebido30d));
    setTxt('kpi-pago-30d', formatarMoeda(kpis.pago30d));
    setTxt('kpi-vencido-receber', formatarMoeda(kpis.vencidoReceber));
}

function renderFluxoCaixaChart(data) {
    const ctx = document.getElementById('fluxo-caixa-chart');
    if (!ctx) return;
    
    // Evita erro de labels undefined
    if (!data || !data.labels) return;

    if (charts.fluxo) charts.fluxo.destroy();
    
    charts.fluxo = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [
                { label: 'Entradas', data: data.entradas, backgroundColor: '#2ecc71', borderRadius:4 },
                { label: 'Saídas', data: data.saidas, backgroundColor: '#e74c3c', borderRadius:4 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: { y: { beginAtZero: true, grid: { color: '#f0f0f0' } }, x: { grid: { display: false } } }
        }
    });
}

function renderDespesasChart(data) {
    const ctx = document.getElementById('despesas-chart');
    if (!ctx) return;

    if (!data || !data.labels || data.labels.length === 0) {
        // Se não houver dados, não renderiza ou mostra mensagem
        return;
    }

    if (charts.despesas) charts.despesas.destroy();
    
    charts.despesas = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.labels,
            datasets: [{
                data: data.valores,
                backgroundColor: ['#3498db', '#e74c3c', '#f1c40f', '#9b59b6', '#1abc9c', '#34495e'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'right', labels: { boxWidth: 12 } } }
        }
    });
}

function populateQuickLists(listas) {
    const tbodyPag = document.getElementById('prox-pagamentos-tbody');
    const tbodyRec = document.getElementById('prox-recebimentos-tbody');
    
    if (tbodyPag) {
        tbodyPag.innerHTML = '';
        if (listas.proximosPagamentos.length === 0) tbodyPag.innerHTML = '<tr><td colspan="3" class="text-center">Nenhum pagamento próximo.</td></tr>';
        else listas.proximosPagamentos.forEach(item => {
            tbodyPag.innerHTML += `<tr><td>${item.Descricao}</td><td>${formatarData(item.DataVencimento)}</td><td class="text-danger">${formatarMoeda(item.Valor)}</td></tr>`;
        });
    }

    if (tbodyRec) {
        tbodyRec.innerHTML = '';
        if (listas.proximosRecebimentos.length === 0) tbodyRec.innerHTML = '<tr><td colspan="3" class="text-center">Nenhum recebimento próximo.</td></tr>';
        else listas.proximosRecebimentos.forEach(item => {
            tbodyRec.innerHTML += `<tr><td>${item.ClienteNome}</td><td>${formatarData(item.DataVencimento)}</td><td class="text-success">${formatarMoeda(item.Valor)}</td></tr>`;
        });
    }
}

function formatarMoeda(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0); }
function formatarData(d) { if(!d) return '-'; return new Date(d+'T00:00:00').toLocaleDateString('pt-BR'); }
function showNotification(msg, type) { if(window.NotificationManager) window.NotificationManager.show({title: type==='error'?'Erro':'Info', message:msg, type:type}); }