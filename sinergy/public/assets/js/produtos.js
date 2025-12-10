/**
 * produtos.js - Produção Integrada (Múltiplas Bobinas)
 * Versão 9.0
 */

const API_URL = 'https://virtualcriacoes.com/sinergy/api';
let pedidosFila = [], pedidosHistorico = [], bobinasDisponiveis = [], listaUsuarios = [];

// === MATEMÁTICA ===
const FATOR_SUCATA_ESPERADA = 0.012;
const ALTURAS_LAMINAS_CM = { 'Meia-Cana': 7.5, 'Meia-Cana Transvision': 7.5, 'Super-Cana': 10.0 };
const FATORES_MATERIAL = {
    'Eixo': 3.65, 'Soleira': 1.00, 'Guia 50': 1.25, 'Guia 60': 1.50, 'Guia 70': 1.75, 'Guia 100': 2.75,
    'Meia-Cana': 0.8, 'Meia-Cana Transvision': 0.7, 'Super-Cana': 1.48,
    '1/2 Cana Galvanizada (Fechada)': 0.8, '1/2 Cana Transvision (Furada)': 0.7, 'Super Cana': 1.48,
    'Guia Lateral 50': 1.25, 'Guia Lateral 70': 1.75, 'Guia Lateral 100': 2.75, 'Soleira': 1.00,
    // TUBOS (ATENÇÃO: Coloque os pesos corretos aqui)
    'TUBO 4.1/2" 2.25mm (metro)': 3.65,  // <--- ALTERE ESTE VALOR (Ex: 6.5kg por metro)
    'TUBO 6.1/2" 2.65mm (metro)': 3.65, // <--- ALTERE ESTE VALOR
    'Tubo Ocotogonal (m) até 4m': 3.65  // <--- ALTERE ESTE VALOR
};

function calcularPesoTeorico(item) {
    const nome = item.ItemNome || item.Tipo || '';
    let fator = 0;
    
    // Busca inteligente: Verifica se o nome do item CONTÉM a chave
    for (const [key, val] of Object.entries(FATORES_MATERIAL)) {
        if (nome.includes(key)) {
            fator = val;
            break;
        }
    }
    
    // Debug para você ver no Console (F12) por que deu zero
    if (!fator) {
        console.warn(`Item sem fator cadastrado: ${nome}. Meta será 0.`);
        return 0;
    }

    // Garante números
    const comprimento = parseFloat(item.Comprimento) || 0;
    const altura = parseFloat(item.Altura) || 0;
    const qtdItens = parseFloat(item.Quantidade) || 1;

    let pesoUnitario = 0;

    // Lógica 1: É Lâmina? (Usa Altura para calcular qtd de tiras)
    let chaveAltura = Object.keys(ALTURAS_LAMINAS_CM).find(k => nome.includes(k));
    
    if (chaveAltura && altura > 0) {
        const alturaLamina = ALTURAS_LAMINAS_CM[chaveAltura];
        const alturaEmCm = altura * 100; 
        const qtdLaminasNecessarias = Math.ceil(alturaEmCm / alturaLamina);
        
        pesoUnitario = fator * (qtdLaminasNecessarias * comprimento);
        console.log(`Cálculo Lâmina [${nome}]: ${qtdLaminasNecessarias} tiras x ${comprimento}m x Fator ${fator} = ${pesoUnitario}`);
    } 
    // Lógica 2: É Tubo ou Perfil? (Linear)
    else {
        pesoUnitario = fator * comprimento;
        
        // Correção para caso o comprimento venha zerado mas a quantidade seja metros
        if (comprimento === 0 && (item.UnidadeMedida === 'm' || item.UnidadeMedida === 'mt')) {
             // Assume que a Quantidade é o comprimento total em metros
             // Ex: "10 metros de tubo" -> Qtd: 10, Comp: 0
             // Nesse caso, pesoUnitario é apenas o fator, e multiplicaremos pela Qtd no final
             pesoUnitario = fator;
        }
        
        console.log(`Cálculo Linear [${nome}]: ${comprimento > 0 ? comprimento : '1'}m x Fator ${fator} = ${pesoUnitario}`);
    }

    const total = pesoUnitario * qtdItens;
    return total;
}

// === UI GERAL ===
// Substitua a função window.initProducao existente por esta:

window.initProducao = async function(manual = false) {
    const loader = document.getElementById('loader-overlay');
    // Mostra o spinner
    if(loader) loader.style.display = 'flex';
    
    // Carrega todos os dados
    await Promise.all([
        carregarFila(), 
        carregarBobinas(), 
        carregarHistorico(), 
        carregarUsuarios()
    ]);
    
    // Esconde o spinner
    if(loader) loader.style.display = 'none';

    // SE foi um clique manual (botão Atualizar), mostra o Toast
    if (manual && window.NotificationManager) {
        NotificationManager.show({ 
            title: 'Sincronizado', 
            message: 'Dados de produção atualizados.', 
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

// === FUNÇÃO DO MODAL DE DETALHES ===
window.verDetalhesItem = function(itemId) {
    let itemAlvo = null;
    for (let ped of pedidosFila) { const found = ped.itens.find(i => i.ID == itemId); if (found) { itemAlvo = found; break; } }
    if (!itemAlvo && pedidosHistorico) { for (let ped of pedidosHistorico) { const found = ped.itens.find(i => i.ID == itemId); if (found) { itemAlvo = found; break; } } }
    
    if (!itemAlvo) return;

    document.getElementById('detalhe-nome').textContent = itemAlvo.ItemNome;
    document.getElementById('detalhe-qtd').textContent = parseFloat(itemAlvo.Quantidade);
    document.getElementById('detalhe-un').textContent = itemAlvo.UnidadeMedida;

    const uom = (itemAlvo.UnidadeMedida || '').toLowerCase();
    const isUnidade = ['un', 'unid', 'pc', 'pç', 'kit', 'cj'].some(s => uom.startsWith(s));

    // LÓGICA DE MEDIDAS (CORRIGIDA: COMPRIMENTO PURO)
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

window.abrirProducaoPedido = function(id) {
    const ped = pedidosFila.find(p => p.ID == id);
    if(!ped) return;

    document.getElementById('modal-ped-title').textContent = `Produção - Pedido ${ped.NumeroPedido}`;
    
    // 1. Preenche o Dropdown de Responsável GERAL
    const selResp = document.getElementById('select-responsavel-geral');
    if (selResp) {
        selResp.innerHTML = '<option value="">Selecione o funcionário...</option>';
        selResp.style.border = "";
        
        // Tenta pegar o ID salvo no banco ou o usuário logado
        const idSalvo = ped.ResponsavelProducaoID; 
        const idLogado = window.getLoggedInUserID ? window.getLoggedInUserID() : localStorage.getItem('usuarioID');
        const preSelected = idSalvo || idLogado;

        listaUsuarios.forEach(u => {
            const selected = (u.ID == preSelected) ? 'selected' : '';
            selResp.innerHTML += `<option value="${u.ID}" ${selected}>${u.NomeCompleto}</option>`;
        });
    }

    // 2. Renderiza Lista de Itens
    const lista = document.getElementById('lista-itens-producao');
    lista.innerHTML = '';

    ped.itens.forEach(item => {
        // Cálculo de Meta de Peso
        const pesoEst = calcularPesoTeorico(item);
        const textoPeso = pesoEst > 0 ? `<br><small style="color:#2980b9;font-weight:bold;">Meta: ${pesoEst.toFixed(2)}kg</small>` : '';
        
        // === LÓGICA DE MEDIDAS (Comprimento e Altura) ===
        let detalhesMedida = '';
        
        const comp = parseFloat(item.Comprimento) || 0; 
        const altura = parseFloat(item.Altura) || 0;
        const uom = (item.UnidadeMedida || '').toLowerCase().trim();
        
        // Lista de unidades que NÃO mostram medida na lista (para limpar o visual)
        const isUnidade = ['un', 'unid', 'pç', 'pc', 'kit', 'cj', 'jg', 'par'].some(s => uom.startsWith(s));

        if (!isUnidade) {
            if (comp > 0 && altura > 0) {
                // Tem as duas medidas (Ex: Porta de Enrolar)
                detalhesMedida = `<div style="font-size:12px; color:#444; margin-top:2px; background:#f1f2f6; padding:2px 6px; border-radius:4px; display:inline-block;">
                    <i class="fas fa-ruler-combined"></i> <strong>${comp.toFixed(2)}m</strong> (Comp) x <strong>${altura.toFixed(2)}m</strong> (Alt)
                </div>`;
            } else if (comp > 0) {
                // Só tem Comprimento (Ex: Tubo, Perfil, Corte)
                detalhesMedida = `<div style="font-size:12px; color:#444; margin-top:2px; background:#f1f2f6; padding:2px 6px; border-radius:4px; display:inline-block;">
                    <i class="fas fa-ruler-horizontal"></i> Comp: <strong>${comp.toFixed(2)}m</strong>
                </div>`;
            }
        }

        // Lógica de Status e Botões
        let rowClass = '', btnHTML = '', icon = '';

        if (item.RequerProducao == 0) {
            // Item de Revenda (Apenas visualização na tela de produção)
            rowClass = 'disabled';
            icon = '<i class="fas fa-box" style="color:#95a5a6;margin-right:10px;"></i>';
            btnHTML = '<small style="color:#7f8c8d;">Revenda</small>';
        } else if (item.StatusProducao === 'Concluido') {
            // Item já finalizado
            rowClass = 'done';
            icon = '<i class="fas fa-check-circle" style="color:#27ae60;margin-right:10px;"></i>';
            btnHTML = '<span style="color:#27ae60;font-weight:bold;">Concluído</span>';
        } else {
            // Pendente de Produção
            rowClass = 'pending';
            icon = '<i class="far fa-circle" style="color:#f39c12;margin-right:10px;"></i>';
            btnHTML = `<button class="btn btn-sm btn-success" onclick="window.abrirBaixaItem(${item.ID})">Produzir</button>`;
        }

        // Botão do Olho (Ver Detalhes)
        const btnOlho = `<button class="btn-view-details" onclick="window.verDetalhesItem(${item.ID})" title="Ver Detalhes do Item"><i class="fas fa-eye"></i></button>`;

        // HTML Final da Linha
        lista.innerHTML += `
            <div class="prod-item-row ${rowClass}">
                <div style="display:flex; align-items:flex-start;">
                    <div style="margin-right:10px; margin-top:4px;">${icon}</div>
                    <div>
                        <div style="display:flex; align-items:center;">
                            <strong>${item.ItemNome}</strong>
                            ${btnOlho}
                        </div>
                        ${textoPeso}
                        ${detalhesMedida ? '<br>' + detalhesMedida : ''}
                        <div style="font-size:11px; color:#666; margin-top:3px;">
                            Qtd Solicitada: <strong>${parseFloat(item.Quantidade)} ${item.UnidadeMedida}</strong>
                        </div>
                    </div>
                </div>
                <div>${btnHTML}</div>
            </div>`;
    });

    document.getElementById('modal-producao').classList.add('active');
};
window.fecharModalProducao = function() { document.getElementById('modal-producao').classList.remove('active'); };

// === BAIXA COM MÚLTIPLAS BOBINAS ===
window.abrirBaixaItem = function(itemId) {
    let itemAlvo = null, pedidoAlvo = null;
    for (let p of pedidosFila) { const found = p.itens.find(i => i.ID == itemId); if (found) { itemAlvo=found; pedidoAlvo=p; break; } }
    if (!itemAlvo) return;

    document.getElementById('baixa-item-id').value = itemId;
    document.getElementById('item-desc-baixa').innerHTML = `Produzindo: ${itemAlvo.ItemNome}<br><small>${pedidoAlvo.ClienteNome}</small>`;
    
    // Meta Teórica
    const pesoTeorico = calcularPesoTeorico(itemAlvo);
    document.getElementById('meta-peso').textContent = pesoTeorico.toFixed(2);
    document.getElementById('container-linhas-bobinas').innerHTML = ''; // Limpa anterior
    
    // Adiciona a primeira linha automaticamente
    window.adicionarLinhaBobina(pesoTeorico); // Sugere o peso total na primeira linha

    document.getElementById('modal-baixa-item').classList.add('active');
    window.atualizarTotalSelecionado();
};

window.adicionarLinhaBobina = function(sugestaoPeso = 0) {
    const container = document.getElementById('container-linhas-bobinas');
    const idx = container.children.length;
    
    // Calcula sugestão de sucata
    const sucataSugerida = sugestaoPeso > 0 ? (sugestaoPeso * FATOR_SUCATA_ESPERADA).toFixed(3) : '0';
    const pesoSugerido = sugestaoPeso > 0 ? sugestaoPeso.toFixed(3) : '';

    const div = document.createElement('div');
    div.className = 'linha-bobina';
    div.style.cssText = "display:flex; gap:10px; align-items:flex-end; border-bottom:1px solid #eee; padding-bottom:10px; margin-bottom:10px;";
    
    // HTML da linha
    div.innerHTML = `
        <div style="flex:2;">
            <label style="font-size:11px;">Bobina</label>
            <select class="form-control select-bobina-row" required style="font-size:12px;">
                <option value="">Selecione...</option>
            </select>
        </div>
        <div style="flex:1;">
            <label style="font-size:11px;">Peso (kg)</label>
            <input type="number" class="form-control input-peso-row" value="${pesoSugerido}" step="0.001" min="0" oninput="window.atualizarTotalSelecionado()">
        </div>
        <div style="flex:1;">
            <label style="font-size:11px;">Sucata (kg)</label>
            <input type="number" class="form-control input-sucata-row" value="${sucataSugerida}" step="0.001" min="0">
        </div>
        ${idx > 0 ? '<button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove(); window.atualizarTotalSelecionado();" style="height:35px; margin-bottom:2px;"><i class="fas fa-trash"></i></button>' : ''}
    `;
    
    container.appendChild(div);
    
    // Popula o select dessa linha específica
    const sel = div.querySelector('.select-bobina-row');
    if(bobinasDisponiveis.length > 0) {
        bobinasDisponiveis.forEach(b => {
            sel.innerHTML += `<option value="${b.ID}">Lote: ${b.Lote} (${parseFloat(b.Peso)}kg)</option>`;
        });
    } else {
        sel.innerHTML += '<option disabled>Sem estoque</option>';
    }
};

window.atualizarTotalSelecionado = function() {
    let total = 0;
    document.querySelectorAll('.input-peso-row').forEach(inp => {
        total += parseFloat(inp.value) || 0;
    });
    
    const el = document.getElementById('total-selecionado');
    const meta = parseFloat(document.getElementById('meta-peso').textContent) || 0;
    
    el.textContent = total.toFixed(2);
    
    // Visual Feedback
    if (total >= meta && meta > 0) el.style.color = '#27ae60'; // Verde se atingiu a meta
    else el.style.color = '#c62828'; // Vermelho se falta
};

window.fecharModalBaixa = function() { document.getElementById('modal-baixa-item').classList.remove('active'); };

// === CONFIRMAR BAIXA (AGORA LÊ A LISTA) ===
async function confirmarBaixa() {
    const responsavel = document.getElementById('select-responsavel-geral').value;
    if (!responsavel) { alert('Selecione o Responsável!'); window.fecharModalBaixa(); return; }

    // 1. Coleta e Soma dos Pesos
    const bobinasParaEnviar = [];
    let totalPesoInformado = 0;
    let erro = false;

    document.querySelectorAll('.linha-bobina').forEach((row, index) => {
        const bobinaID = row.querySelector('.select-bobina-row').value;
        const peso = parseFloat(row.querySelector('.input-peso-row').value) || 0;
        const sucata = parseFloat(row.querySelector('.input-sucata-row').value) || 0;

        if (!bobinaID || peso <= 0) {
            alert(`Verifique a linha ${index+1}. Selecione a bobina e informe um peso válido.`);
            erro = true;
        }
        
        totalPesoInformado += peso; // Soma apenas o peso útil (o que vira produto)
        
        bobinasParaEnviar.push({
            BobinaID: bobinaID,
            PesoUsado: peso,
            SucataGerada: sucata
        });
    });

    if (erro) return;
    if (bobinasParaEnviar.length === 0) { alert("Adicione pelo menos uma bobina."); return; }

    // 2. VALIDAÇÃO RÍGIDA DA META
    // Pega o valor do texto na tela (ex: "150.00") e converte para número
    const metaPeso = parseFloat(document.getElementById('meta-peso').textContent) || 0;

    // Se existir uma meta definida (> 0), valida a diferença
    if (metaPeso > 0) {
        // Usamos uma margem mínima de erro (0.05kg) para evitar problemas de arredondamento de centavos
        const diferenca = Math.abs(totalPesoInformado - metaPeso);
        
        if (diferenca > 0.05) {
            alert(`BLOQUEADO: O peso informado (${totalPesoInformado.toFixed(2)} kg) não bate com a Meta Exata (${metaPeso.toFixed(2)} kg).\n\nAjuste os valores das bobinas para igualar a meta.`);
            return; // PARA TUDO AQUI. Não salva.
        }
    }

    // 3. Envio dos Dados (Se passou na validação)
    const payload = {
        ItemPedidoID: document.getElementById('baixa-item-id').value,
        ResponsavelID: responsavel,
        Bobinas: bobinasParaEnviar
    };

    try {
        const res = await fetch(`${API_URL}/producao/baixar-item`, {
            method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
        });
        
        if (res.ok) {
            if (window.NotificationManager) NotificationManager.show({ title: 'Sucesso', message: 'Produção registrada com sucesso!', type: 'success' });
            else alert('Sucesso!');
            window.fecharModalBaixa(); window.fecharModalProducao(); window.initProducao();
        } else {
            const err = await res.json(); alert('Erro: ' + err.error);
        }
    } catch(e) { alert('Erro conexão'); }
}

// === HISTÓRICO E UTILS === (Mantidos iguais ao anterior, resumidos aqui)
window.verDetalhesHistorico = function(id) { /* código igual ao anterior */ };
async function carregarFila() { /* código igual */ try { const res = await fetch(`${API_URL}/producao/fila`); pedidosFila = await res.json(); if(!Array.isArray(pedidosFila)) pedidosFila=[]; renderizarFila(); } catch(e) {} }
async function carregarHistorico() { /* código igual */ try { const res = await fetch(`${API_URL}/producao/historico`); pedidosHistorico = await res.json(); if(!Array.isArray(pedidosHistorico)) pedidosHistorico=[]; renderizarHistorico(); } catch(e) {} }
async function carregarBobinas() { try { const res = await fetch(`${API_URL}/bobinas`); const d = await res.json(); bobinasDisponiveis = Array.isArray(d) ? d.filter(b => b.Status==='Disponível' && parseFloat(b.Peso)>0) : []; } catch(e) {} }
async function carregarUsuarios() { try { const res = await fetch(`${API_URL}/usuarios/lista-simples`); listaUsuarios = await res.json(); if(!Array.isArray(listaUsuarios)) listaUsuarios=[]; } catch(e) {} }
function renderizarFila() { /* código igual */ const container = document.getElementById('production-grid'); if(!container) return; container.innerHTML = ''; const term = document.getElementById('search-prod') ? document.getElementById('search-prod').value.toLowerCase() : ""; const filtrados = pedidosFila.filter(p => (p.ClienteNome||"").toLowerCase().includes(term) || (p.NumeroPedido||"").toLowerCase().includes(term)); if (filtrados.length === 0) { container.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#999;padding:20px;">Fila vazia.</p>'; return; } filtrados.forEach(ped => container.appendChild(createCard(ped, 'fila'))); }
function renderizarHistorico() { /* código igual */ const container = document.getElementById('history-grid'); if(!container) return; container.innerHTML = ''; const term = document.getElementById('search-prod') ? document.getElementById('search-prod').value.toLowerCase() : ""; const filtrados = pedidosHistorico.filter(p => (p.ClienteNome||"").toLowerCase().includes(term) || (p.NumeroPedido||"").toLowerCase().includes(term)); if (filtrados.length === 0) { container.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#999;padding:20px;">Histórico vazio.</p>'; return; } filtrados.forEach(ped => container.appendChild(createCard(ped, 'historico'))); }
function createCard(ped, tipo) { /* código igual */ const div = document.createElement('div'); div.className = 'request-card'; const isDone = ped.progresso === 100 || tipo === 'historico'; div.style.borderLeft = isDone ? '5px solid #27ae60' : '5px solid #f39c12'; const btnAction = tipo === 'fila' ? `<button class="btn btn-primary" style="width:100%" onclick="window.abrirProducaoPedido(${ped.ID})"><i class="fas fa-industry"></i> Abrir Ordem</button>` : `<button class="btn btn-secondary" style="width:100%" onclick="window.verDetalhesHistorico(${ped.ID})"><i class="fas fa-eye"></i> Ver Detalhes</button>`; div.innerHTML = `<div class="req-header"><span class="req-id">#${ped.NumeroPedido}</span><span class="req-badge" style="background:${isDone?'#27ae60':'#f39c12'}">${isDone?'Concluído':ped.progresso+'%'}</span></div><div class="req-body"><h3 class="req-title">${ped.ClienteNome}</h3><div class="req-meta"><span><i class="far fa-calendar"></i> ${new Date(ped.DataPedido).toLocaleDateString()}</span><span><i class="fas fa-user-tag"></i> ${ped.VendedorNome||'-'}</span></div></div><div class="req-footer">${btnAction}</div>`; return div; }

document.addEventListener('DOMContentLoaded', () => {
    window.initProducao();
    document.getElementById('search-prod')?.addEventListener('input', () => { renderizarFila(); renderizarHistorico(); });
    document.getElementById('form-baixa-producao')?.addEventListener('submit', (e) => { e.preventDefault(); confirmarBaixa(); });
});