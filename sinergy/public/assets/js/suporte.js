// suporte.js - Funções específicas para a página de suporte

document.addEventListener('DOMContentLoaded', function() {
    // Controle das abas de suporte
    initSupportTabs();
    
    // Controle dos itens de FAQ
    initFaqAccordion();
    
    // Inicialização do formulário de chamados
    initTicketForm();
    
    // Inicialização da busca de documentação
    initSearchDocumentation();
});

/**
 * Inicializa o controle das abas da página de suporte
 */
function initSupportTabs() {
    const categories = document.querySelectorAll('.support-category');
    const panels = document.querySelectorAll('.support-panel');
    
    categories.forEach(category => {
        category.addEventListener('click', function() {
            const target = this.getAttribute('data-target');
            
            // Atualiza a categoria ativa
            categories.forEach(cat => cat.classList.remove('active'));
            this.classList.add('active');
            
            // Atualiza o painel ativo
            panels.forEach(panel => panel.classList.remove('active'));
            document.getElementById(target).classList.add('active');
        });
    });
}

/**
 * Inicializa o comportamento de accordion para os itens de FAQ
 */
function initFaqAccordion() {
    const faqQuestions = document.querySelectorAll('.faq-question');
    
    faqQuestions.forEach(question => {
        question.addEventListener('click', function() {
            const faqItem = this.parentNode;
            faqItem.classList.toggle('active');
            
            // Alterna o ícone de seta
            const icon = this.querySelector('i');
            if (faqItem.classList.contains('active')) {
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-up');
            } else {
                icon.classList.remove('fa-chevron-up');
                icon.classList.add('fa-chevron-down');
            }
        });
    });
}

/**
 * Inicializa o formulário de abertura de chamados
 */
function initTicketForm() {
    const ticketForm = document.querySelector('.ticket-form');
    
    if (ticketForm) {
        ticketForm.addEventListener('submit', function(event) {
            event.preventDefault();
            
            // Obter todos os dados do formulário
            const subject = document.getElementById('ticket-subject').value;
            const category = document.getElementById('ticket-category').value;
            const module = document.getElementById('ticket-module').value;
            const priority = document.getElementById('ticket-priority').value;
            const description = document.getElementById('ticket-description').value;
            const attachment = document.getElementById('ticket-attachment').files[0];
            
            // Validação simples
            if (!subject || !category || !module || !priority || !description) {
                showMessage('Por favor, preencha todos os campos obrigatórios.', 'error');
                return;
            }
            
            // Simular o envio bem-sucedido (aqui você implementaria a chamada real à API)
            // Em uma implementação real, você enviaria os dados para o servidor
            simulateTicketSubmission({
                subject,
                category,
                module,
                priority,
                description,
                attachment: attachment ? attachment.name : null
            });
        });
        
        // Resetar formulário
        document.querySelector('.btn-secondary').addEventListener('click', function() {
            ticketForm.reset();
        });
    }
}

/**
 * Inicializa a busca de documentação de suporte
 */
function initSearchDocumentation() {
    const searchInput = document.querySelector('.search-container input');
    
    if (searchInput) {
        searchInput.addEventListener('keyup', function(event) {
            // Implementar busca ao pressionar Enter
            if (event.key === 'Enter') {
                const searchTerm = this.value.trim().toLowerCase();
                
                if (searchTerm.length < 3) {
                    showMessage('Digite pelo menos 3 caracteres para buscar', 'warning');
                    return;
                }
                
                searchDocumentation(searchTerm);
            }
        });
    }
}

/**
 * Busca documentação com base no termo informado
 * @param {string} term - Termo de busca
 */
function searchDocumentation(term) {
    // Esta função poderia chamar uma API para buscar documentação
    // Por enquanto, vamos simular uma busca nos FAQs e manuais
    
    // Reset das indicações de busca anteriores
    document.querySelectorAll('.search-highlight').forEach(el => {
        el.classList.remove('search-highlight');
    });
    
    // Busca nos títulos de FAQs
    const faqTitles = document.querySelectorAll('.faq-question h3');
    let matchesFound = 0;
    
    faqTitles.forEach(title => {
        if (title.textContent.toLowerCase().includes(term)) {
            // Encontrou um resultado, destaca e mostra a resposta
            const faqItem = title.closest('.faq-item');
            faqItem.classList.add('search-highlight');
            faqItem.classList.add('active');
            
            // Atualiza o ícone
            const icon = faqItem.querySelector('.faq-question i');
            icon.classList.remove('fa-chevron-down');
            icon.classList.add('fa-chevron-up');
            
            // Ativa a aba de FAQ
            activateTab('faq');
            
            matchesFound++;
        }
    });
    
    // Busca nos títulos de manuais
    const manualTitles = document.querySelectorAll('.manual-info h3');
    
    manualTitles.forEach(title => {
        if (title.textContent.toLowerCase().includes(term)) {
            // Encontrou um resultado, destaca
            const manualItem = title.closest('.manual-item');
            manualItem.classList.add('search-highlight');
            
            // Ativa a aba de manuais
            activateTab('manuals');
            
            matchesFound++;
        }
    });
    
    // Exibe mensagem com o resultado da busca
    if (matchesFound > 0) {
        showMessage(`Foram encontrados ${matchesFound} resultados para "${term}"`, 'success');
    } else {
        showMessage(`Nenhum resultado encontrado para "${term}"`, 'info');
    }
}

/**
 * Ativa uma aba específica
 * @param {string} tabId - ID da aba a ser ativada
 */
function activateTab(tabId) {
    const categories = document.querySelectorAll('.support-category');
    const panels = document.querySelectorAll('.support-panel');
    
    // Encontra a categoria correspondente
    const targetCategory = document.querySelector(`.support-category[data-target="${tabId}"]`);
    
    if (targetCategory) {
        // Atualiza a categoria ativa
        categories.forEach(cat => cat.classList.remove('active'));
        targetCategory.classList.add('active');
        
        // Atualiza o painel ativo
        panels.forEach(panel => panel.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');
    }
}

/**
 * Simula o envio de um ticket para o servidor
 * @param {Object} ticketData - Dados do ticket
 */
function simulateTicketSubmission(ticketData) {
    // Simula um tempo de processamento
    showMessage('Enviando chamado...', 'info');
    
    setTimeout(() => {
        // Gera um número de protocolo aleatório
        const protocolNumber = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
        
        showMessage(`Chamado aberto com sucesso! Número de protocolo: #${protocolNumber}`, 'success');
        
        // Limpa o formulário
        document.querySelector('.ticket-form').reset();
        
        // Adiciona o chamado à lista de chamados recentes (poderia ser implementado)
        // addToRecentTickets(ticketData, protocolNumber);
    }, 1500);
}

/**
 * Exibe uma mensagem para o usuário
 * @param {string} message - Mensagem a ser exibida
 * @param {string} type - Tipo de mensagem (success, error, warning, info)
 */
function showMessage(message, type = 'info') {
    // Verificar se já existe uma mensagem e removê-la
    const existingMessage = document.querySelector('.message-container');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // Criar elemento de mensagem
    const messageEl = document.createElement('div');
    messageEl.className = `message-container message-${type}`;
    messageEl.innerHTML = `
        <div class="message-content">
            <i class="fas ${getIconForMessageType(type)}"></i>
            <span>${message}</span>
        </div>
        <button class="message-close"><i class="fas fa-times"></i></button>
    `;
    
    // Adicionar ao DOM
    document.querySelector('.support-container').prepend(messageEl);
    
    // Adicionar evento para fechar a mensagem
    messageEl.querySelector('.message-close').addEventListener('click', () => {
        messageEl.remove();
    });
    
    // Remover automaticamente após alguns segundos
    setTimeout(() => {
        if (messageEl.parentNode) {
            messageEl.classList.add('message-hiding');
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.remove();
                }
            }, 300);
        }
    }, 5000);
}

/**
 * Retorna o ícone apropriado para o tipo de mensagem
 * @param {string} type - Tipo de mensagem
 * @returns {string} - Classe CSS do ícone
 */
function getIconForMessageType(type) {
    switch (type) {
        case 'success': return 'fa-check-circle';
        case 'error': return 'fa-exclamation-circle';
        case 'warning': return 'fa-exclamation-triangle';
        case 'info': 
        default: return 'fa-info-circle';
    }
}