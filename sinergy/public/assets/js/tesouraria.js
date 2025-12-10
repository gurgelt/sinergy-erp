/**
 * tesouraria.js - Fluxo de Caixa Realizado (Extrato)
 * Consolida Contas a Pagar e Receber baixadas
 */

document.addEventListener('DOMContentLoaded', () => {
    initializeAppTesouraria();
});

const API_URL = 'https://virtualcriacoes.com/sinergy/api';
let movimentacoes = [];

async function initializeAppTesouraria() {
    setupEventListeners();
    await loadDadosFinanceiros();
    
    const loader = document.getElementById('loader-overlay');
    if (loader) loader.style.display = 'none';
}

function setupEventListeners() {
    // Filtro de Mês
    const mesFilter = document.getElementById('filtro-mes');
    if (mesFilter) mesFilter.addEventListener('change', renderTabela);

    // Botão de Atualizar
    const btnRefresh = document.getElementById('btn-refresh');
    if (btnRefresh) btnRefresh.addEventListener('click', loadDadosFinanceiros);

    // CORREÇÃO DO ERRO: Definindo os listeners apenas se os elementos existirem
    const btnClose = document.getElementById('close-modal-edicao');
    if (btnClose) btnClose.addEventListener('click', fecharModalEdicao);
    
    const btnCancel = document.getElementById('btn-cancelar-edicao');
    if (btnCancel) btnCancel.addEventListener('click', fecharModalEdicao);
}

// === CORREÇÃO: A FUNÇÃO QUE FALTAVA ===
function fecharModalEdicao() {
    const modal = document.getElementById('modal-edicao');
    if (modal) modal.classList.remove('active');
}

async function loadDadosFinanceiros() {
    try {
        // Carrega em paralelo
        const [resPagar, resReceber] = await Promise.all([
            fetch(`${API_URL}/contas-pagar`),
            fetch(`${API_URL}/contas-receber`)
        ]);

        const pagar = await resPagar.json();
        const receber = await resReceber.json();

        // Processa e Unifica os dados
        movimentacoes = [];

        // 1. Processa SAÍDAS (Contas Pagas)
        if (Array.isArray(pagar)) {
            pagar.forEach(c => {
                if (c.Status === 'Pago') {
                    movimentacoes.push({
                        id: c.ID || c.id,
                        data: c.DataPagamento || c.DataVencimento, // Usa data real do pgto
                        descricao: c.Descricao || `Pagamento a ${c.Fornecedor}`,
                        categoria: c.Categoria || 'Despesa',
                        valor: parseFloat(c.Valor || 0),
                        tipo: 'saida',
                        forma: c.FormaPagamento || '-'
                    });
                }
            });
        }

        // 2. Processa ENTRADAS (Contas Recebidas)
        if (Array.isArray(receber)) {
            receber.forEach(c => {
                if (c.Status === 'Pago' || c.Status === 'Recebido') {
                    movimentacoes.push({
                        id: c.ID || c.id,
                        data: c.DataRecebimento || c.DataVencimento, // Usa data real do recebimento
                        descricao: c.ClienteNome ? `Recebimento: ${c.ClienteNome}` : 'Recebimento Diverso',
                        categoria: 'Vendas',
                        valor: parseFloat(c.Valor || 0),
                        tipo: 'entrada',
                        forma: c.FormaPagamento || '-'
                    });
                }
            });
        }

        // Ordena por data (Mais recente primeiro)
        movimentacoes.sort((a, b) => new Date(b.data) - new Date(a.data));

        renderTabela();
        atualizarResumo();

    } catch (error) {
        console.error("Erro ao carregar tesouraria:", error);
        const tbody = document.getElementById('tabela-tesouraria-body');
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="color:red">Erro ao carregar dados: ${error.message}</td></tr>`;
    }
}

function renderTabela() {
    const tbody = document.getElementById('tabela-tesouraria-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const elMes = document.getElementById('filtro-mes');
    const mesFiltro = elMes ? elMes.value : ''; // Formato esperado: "2023-10"

    const filtrados = movimentacoes.filter(mov => {
        if (!mesFiltro) return true;
        return mov.data.startsWith(mesFiltro);
    });

    if (filtrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhuma movimentação no período.</td></tr>';
        return;
    }

    filtrados.forEach(mov => {
        const isEntrada = mov.tipo === 'entrada';
        const colorClass = isEntrada ? 'text-success' : 'text-danger';
        const icon = isEntrada ? '<i class="fas fa-arrow-up"></i>' : '<i class="fas fa-arrow-down"></i>';
        const sinal = isEntrada ? '+' : '-';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatarData(mov.data)}</td>
            <td>
                <span style="font-weight:500; color: #555;">${mov.descricao}</span>
                <div style="font-size:11px; color:#888;">${mov.categoria}</div>
            </td>
            <td>${mov.forma}</td>
            <td class="${colorClass}" style="font-weight:bold;">
                ${sinal} ${formatarMoeda(mov.valor)}
            </td>
            <td class="text-center">${icon}</td>
            <td class="text-center">
               <button class="btn-icon" onclick="verDetalhes(${mov.id}, '${mov.tipo}')" title="Ver Detalhes"><i class="fas fa-eye"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function atualizarResumo() {
    const elMes = document.getElementById('filtro-mes');
    const mesFiltro = elMes ? elMes.value : '';

    const filtrados = movimentacoes.filter(mov => {
        if (!mesFiltro) return true;
        return mov.data.startsWith(mesFiltro);
    });

    const totalEntradas = filtrados.filter(m => m.tipo === 'entrada').reduce((acc, m) => acc + m.valor, 0);
    const totalSaidas = filtrados.filter(m => m.tipo === 'saida').reduce((acc, m) => acc + m.valor, 0);
    const saldo = totalEntradas - totalSaidas;

    setText('total-entradas', formatarMoeda(totalEntradas));
    setText('total-saidas', formatarMoeda(totalSaidas));
    
    const elSaldo = document.getElementById('total-saldo');
    if (elSaldo) {
        elSaldo.textContent = formatarMoeda(saldo);
        elSaldo.style.color = saldo >= 0 ? '#27ae60' : '#e74c3c';
    }
}

// Utils
function formatarMoeda(v) { 
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0); 
}

function formatarData(d) { 
    if (!d) return '-';
    // Corrige problema de fuso horário criando a data com hora meio-dia
    return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR'); 
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

// Placeholder para detalhes (Pode expandir se quiser abrir o modal de edição)
window.verDetalhes = function(id, tipo) {
    // Lógica futura: Abrir modal com detalhes da conta original
    if (tipo === 'entrada') {
        alert(`Detalhes do Recebimento #${id}`);
    } else {
        alert(`Detalhes do Pagamento #${id}`);
    }
};

// Global exports
window.fecharModalEdicao = fecharModalEdicao;