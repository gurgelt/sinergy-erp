/**
 * rastreio.js - Gestão de Containers Comex
 * Versão Limpa e Global (Sem Permissionamento)
 */

const API_URL = 'https://virtualcriacoes.com/sinergy/api';
let containers = [];

// ============================================================
// 1. FUNÇÕES GLOBAIS (Definidas antes de tudo para o HTML enxergar)
// ============================================================

window.abrirModalRastreio = function() {
    const modal = document.getElementById('modal-rastreio');
    const form = document.getElementById('form-rastreio');
    const idField = document.getElementById('rastreio-id');
    
    if(form) form.reset();
    if(idField) idField.value = '';
    
    if(modal) {
        modal.classList.add('active');
        // Fallback visual caso o CSS .active falhe
        modal.style.display = 'flex';
    }
};

window.fecharModalRastreio = function() {
    const modal = document.getElementById('modal-rastreio');
    if(modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
};

window.editarRastreio = function(id) {
    // Usa == para permitir string vs int
    const c = containers.find(x => x.ID == id);
    if(!c) return;
    
    document.getElementById('rastreio-id').value = c.ID;
    document.getElementById('input-container').value = c.ContainerNumero || '';
    document.getElementById('input-armador').value = c.Armador || '';
    document.getElementById('input-mercadoria').value = c.Mercadoria || '';
    document.getElementById('input-eta').value = c.DataETA || '';
    document.getElementById('input-step').value = c.StatusStep || 1;
    document.getElementById('input-obs').value = c.Observacoes || '';
    
    const modal = document.getElementById('modal-rastreio');
    if(modal) {
        modal.classList.add('active');
        modal.style.display = 'flex';
    }
};

window.excluirRastreio = async function(id) {
    if(!confirm('Tem certeza que deseja excluir este container?')) return;
    try {
        await fetch(`${API_URL}/comex/rastreio/${id}`, {method:'DELETE'});
        loadContainers();
    } catch(e) { console.error(e); }
};

// ============================================================
// 2. INICIALIZAÇÃO
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    initializeAppRastreio();
    
    // Listener do Formulário (Evita duplicidade)
    const form = document.getElementById('form-rastreio');
    if(form) {
        // Remove listeners antigos clonando o elemento (truque de segurança)
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        
        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await salvarRastreio();
        });
    }
});

async function initializeAppRastreio() {
    await loadContainers();
    const loader = document.getElementById('loader-overlay');
    if (loader) loader.style.display = 'none';
}

async function loadContainers() {
    try {
        const res = await fetch(`${API_URL}/comex/rastreio`);
        if(!res.ok) throw new Error('Erro na API');
        containers = await res.json();
        
        // Garante array
        if (!Array.isArray(containers)) containers = [];
        
        renderTrackingCards();
    } catch(e) { 
        console.error("Erro rastreio:", e);
    }
}

function renderTrackingCards() {
    // BLINDAGEM: Verifica se o elemento existe
    const div = document.getElementById('lista-containers');
    if (!div) {
        console.error('Elemento #lista-containers não encontrado no HTML.');
        return;
    }
    
    div.innerHTML = '';
    
    if(containers.length === 0) {
        div.innerHTML = '<div style="text-align:center; padding:40px; color:#999; background:#fff; border-radius:8px;">Nenhum container em trânsito no momento.</div>';
        return;
    }

    containers.forEach(c => {
        const stepsHTML = [1,2,3,4,5,6,7,8].map(step => {
            const active = step <= (c.StatusStep || 1) ? 'active' : '';
            return `
                <div class="step ${active}">
                    <div class="step-circle">${active ? '' : step}</div>
                    <div class="step-label">${getStepLabel(step)}</div>
                </div>`;
        }).join('');

        const etaDate = c.DataETA ? new Date(c.DataETA + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A';
        const statusIcon = getStatusIcon(c.StatusStep || 1);

        const card = document.createElement('div');
        card.className = 'container-card';
        card.setAttribute('data-status', c.StatusStep || 1);
        card.innerHTML = `
            <div class="container-header">
                <div>
                    <h3>
                        <i class="fas fa-ship"></i> ${c.ContainerNumero}
                    </h3>
                    <div class="container-meta">
                        <span><strong>Armador:</strong> ${c.Armador || '-'}</span>
                        <span><strong>Mercadoria:</strong> ${c.Mercadoria || '-'}</span>
                    </div>
                    <div class="container-status" data-step="${c.StatusStep || 1}">
                        <i class="${statusIcon}"></i>
                        ${c.StatusAtual || 'Iniciado'}
                    </div>
                </div>
                <div>
                    <div>Previsão Chegada</div>
                    <strong>${etaDate}</strong>
                    <div class="container-actions">
                        <button class="btn-icon-action edit" onclick="window.editarRastreio(${c.ID})" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon-action delete" onclick="window.excluirRastreio(${c.ID})" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>

            <div class="timeline">
                ${stepsHTML}
            </div>

            ${c.Observacoes ? `<div class="container-obs"><strong>Observações:</strong> ${c.Observacoes}</div>` : ''}
        `;
        div.appendChild(card);
    });
}

function getStepLabel(step) {
    const labels = {
        1: 'Documentação', 2: 'Booking', 3: 'Em Trânsito', 4: 'Atracação',
        5: 'Desembaraço', 6: 'Carregamento', 7: 'Transporte', 8: 'Entregue'
    };
    return labels[step] || step;
}

function getStatusIcon(step) {
    const icons = {
        1: 'fas fa-file-alt',       // Documentação
        2: 'fas fa-calendar-check',  // Booking
        3: 'fas fa-ship',            // Em Trânsito
        4: 'fas fa-anchor',          // Atracação
        5: 'fas fa-clipboard-check', // Desembaraço
        6: 'fas fa-dolly',           // Carregamento
        7: 'fas fa-truck',           // Transporte
        8: 'fas fa-check-circle'     // Entregue
    };
    return icons[step] || 'fas fa-box';
}

async function salvarRastreio() {
    const idField = document.getElementById('rastreio-id');
    const id = idField ? idField.value : null;
    
    const payload = {
        ContainerNumero: document.getElementById('input-container').value,
        Armador: document.getElementById('input-armador').value,
        Mercadoria: document.getElementById('input-mercadoria').value,
        DataETA: document.getElementById('input-eta').value,
        StatusStep: document.getElementById('input-step').value,
        Observacoes: document.getElementById('input-obs').value
    };

    let url = `${API_URL}/comex/rastreio`;
    let method = 'POST';
    if(id) { 
        url += `/${id}`; 
        method = 'PUT'; 
    }

    try {
        const res = await fetch(url, {
            method, 
            headers:{'Content-Type':'application/json'}, 
            body:JSON.stringify(payload)
        });
        
        if (res.ok) {
            window.fecharModalRastreio();
            loadContainers();
        } else {
            alert('Erro ao salvar. Verifique o console.');
        }
    } catch(e) {
        console.error(e);
        alert('Erro de conexão.');
    }
}