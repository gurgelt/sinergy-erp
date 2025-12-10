document.addEventListener('DOMContentLoaded', () => {
    carregarNotas();
    setupUpload();
});

const API_URL = 'https://virtualcriacoes.com/sinergy/api';

function setupUpload() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    if (dropZone && fileInput) {
        dropZone.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) enviarXML(e.target.files[0]);
        });

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.backgroundColor = '#e8f4fd';
            dropZone.style.borderColor = '#2980b9';
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.style.backgroundColor = '#f8f9fa';
            dropZone.style.borderColor = '#3498db';
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.backgroundColor = '#f8f9fa';
            dropZone.style.borderColor = '#3498db';
            if (e.dataTransfer.files.length > 0) enviarXML(e.dataTransfer.files[0]);
        });
    }
}

async function enviarXML(file) {
    if (file.type !== 'text/xml' && !file.name.endsWith('.xml')) {
        if(window.NotificationManager) window.NotificationManager.show({ message: 'Por favor, selecione um arquivo XML válido.', type: 'error' });
        else alert('Selecione um XML válido.');
        return;
    }

    // CAPTURA O LOCAL SELECIONADO
    const localDestino = document.getElementById('select-local-destino').value;

    const formData = new FormData();
    formData.append('xml_file', file);
    formData.append('local_destino', localDestino); // Envia o local junto

    const dropZone = document.getElementById('drop-zone');
    const originalText = dropZone ? dropZone.innerHTML : '';
    if(dropZone) dropZone.innerHTML = '<div class="loader-spinner" style="border-top-color:#3498db"></div><p>Importando para <strong>' + localDestino + '</strong>...</p>';

    try {
        const res = await fetch(`${API_URL}/estoque/notas-fiscais/upload`, { method: 'POST', body: formData });
        const data = await res.json();

        if (res.ok) {
            if(window.NotificationManager) window.NotificationManager.show({ message: data.message, type: 'success' });
            carregarNotas();
        } else {
            throw new Error(data.error || 'Erro ao importar');
        }
    } catch (error) {
        if(window.NotificationManager) window.NotificationManager.show({ message: error.message, type: 'error' });
        else alert(error.message);
    } finally {
        if(dropZone) dropZone.innerHTML = originalText;
        const fi = document.getElementById('file-input');
        if(fi) fi.value = '';
    }
}

async function carregarNotas() {
    try {
        const res = await fetch(`${API_URL}/estoque/notas-fiscais`);
        const dados = await res.json();
        
        const tbody = document.getElementById('tabela-notas-body');
        if (!tbody) return;
        
        tbody.innerHTML = '';

        if (!dados || dados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">Nenhuma nota importada.</td></tr>';
            return;
        }

        dados.forEach(nota => {
            const dataEmissao = new Date(nota.DataEmissao).toLocaleDateString('pt-BR');
            const dataImport = new Date(nota.DataImportacao).toLocaleDateString('pt-BR');
            const valor = parseFloat(nota.ValorTotal).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
            
            // Tratamento visual ESTRITO para suas unidades
            // Se o campo vier vazio (notas antigas), assume João Mafra
            const local = nota.Localizacao || 'João Mafra';
            
            // Define cores: Azul para João Mafra, Laranja para Itapeva
            let badgeClass = 'badge-info'; // Padrão azul
            let badgeStyle = 'background:#e3f2fd; color:#1565c0; border:1px solid #bbdefb;'; // Estilo João Mafra

            if (local === 'Itapeva') {
                badgeClass = 'badge-warning';
                badgeStyle = 'background:#fff3e0; color:#ef6c00; border:1px solid #ffe0b2;'; // Estilo Itapeva
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${dataEmissao}</td>
                <td><strong>${nota.NumeroNota}</strong> <small>/ ${nota.Serie}</small></td>
                <td>${nota.NomeFornecedor || 'Fornecedor Desconhecido'}</td>
                
                <td>
                    <span class="badge ${badgeClass}" style="padding: 5px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; ${badgeStyle}">
                        <i class="fas fa-map-marker-alt"></i> ${local}
                    </span>
                </td>
                
                <td><strong>${valor}</strong></td>
                <td style="font-size: 12px; color: #666;">${dataImport}</td>
                <td class="text-center">
                    <button class="btn-icon" onclick="verDetalhes(${nota.ID})" title="Ver Detalhes"><i class="fas fa-eye"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("Erro ao listar notas:", error);
    }
}

// === FUNÇÃO DE DETALHES (BLINDADA) ===
async function verDetalhes(id) {
    const loader = document.getElementById('loader-overlay');
    
    // Verificação de segurança: Só tenta usar o estilo se o elemento existir
    if (loader) {
        loader.style.display = 'flex';
    } else {
        console.warn("Elemento 'loader-overlay' não encontrado no HTML.");
    }

    try {
        const res = await fetch(`${API_URL}/estoque/notas-fiscais/${id}`);
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || 'Erro ao carregar detalhes');

        const nf = data.nota;
        const itens = data.itens;

        // Verifica se o modal existe antes de tentar preencher
        const modal = document.getElementById('modal-detalhes-nota');
        if (!modal) {
            console.error("Erro crítico: Modal 'modal-detalhes-nota' não encontrado no HTML.");
            alert("Erro visual: Modal não encontrado. Recarregue a página.");
            return;
        }

        // Preenche Cabeçalho
        setText('det-fornecedor', nf.NomeFantasia || nf.RazaoSocial || 'Desconhecido');
        setText('det-cnpj', nf.CNPJ || '-');
        setText('det-numero', nf.NumeroNota);
        setText('det-serie', nf.Serie);
        setText('det-data', new Date(nf.DataEmissao).toLocaleDateString('pt-BR'));
        setText('det-chave', nf.ChaveAcesso);
        setText('det-total', parseFloat(nf.ValorTotal).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}));

        // Preenche Tabela de Itens
        const tbody = document.getElementById('det-itens-body');
        if (tbody) {
            tbody.innerHTML = '';
            itens.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${item.CodigoProdutoXML || '-'}</td>
                    <td>${item.NomeProdutoXML || '-'}</td>
                    <td>${item.NCM || '-'}</td>
                    <td>${item.CFOP || '-'}</td>
                    <td>${item.Unidade || '-'}</td>
                    <td>${parseFloat(item.Quantidade || 0)}</td>
                    <td>${parseFloat(item.ValorUnitario || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td>
                    <td><strong>${parseFloat(item.ValorTotal || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</strong></td>
                `;
                tbody.appendChild(tr);
            });
        }

        // Abre Modal
        modal.classList.add('active');

    } catch (error) {
        if(window.NotificationManager) window.NotificationManager.show({ message: error.message, type: 'error' });
        else alert(error.message);
    } finally {
        if (loader) loader.style.display = 'none';
    }
}

function fecharModalNota() {
    const modal = document.getElementById('modal-detalhes-nota');
    if (modal) modal.classList.remove('active');
}

function setText(id, text) {
    const el = document.getElementById(id);
    if(el) el.textContent = text;
}

// Expõe globalmente
window.verDetalhes = verDetalhes;
window.fecharModalNota = fecharModalNota;
window.carregarNotas = carregarNotas;