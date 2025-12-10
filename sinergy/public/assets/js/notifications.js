/**
 * notifications.js - Gerenciador Global de Notificações (Toasts)
 * Compatível com chamadas de Objeto {message, type} e Argumentos (msg, type)
 */

class NotificationSystem {
    constructor() {
        this.container = document.getElementById('notification-container');
        
        // Se o container não existir no HTML, cria dinamicamente
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'notification-container';
            document.body.appendChild(this.container);
        }
    }

    /**
     * Exibe uma notificação
     * Suporta chamada antiga: show(msg, type)
     * Suporta chamada nova: show({ message, type })
     */
    show(arg1, arg2) {
        let message, type, title, duration;

        // Detecta se é a chamada nova (Objeto) ou antiga (Argumentos)
        if (typeof arg1 === 'object' && arg1 !== null) {
            // Chamada Nova: show({ message: '...', type: '...' })
            message = arg1.message || 'Operação realizada';
            type = arg1.type || 'info';
            title = arg1.title;
            duration = arg1.duration || 5000;
        } else {
            // Chamada Antiga: show('Mensagem', 'success')
            message = arg1;
            type = arg2 || 'info';
            duration = 5000;
        }

        // Blindagem de Tipo (Evita o erro toLowerCase de undefined)
        type = (type || 'info').toLowerCase();

        // Define título padrão se não for passado
        if (!title) {
            if (type === 'success') title = 'Sucesso';
            else if (type === 'error') title = 'Erro';
            else if (type === 'warning') title = 'Atenção';
            else title = 'Informação';
        }

        // Mapeamento de Ícones
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-times-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        // Cria o elemento HTML
        const toast = document.createElement('div');
        toast.className = `toast-notification ${type}`;
        
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="fas ${icons[type] || icons.info}"></i>
            </div>
            <div class="toast-body">
                <strong class="toast-title">${title}</strong>
                <p class="toast-message">${message}</p>
            </div>
            <button class="toast-close">
                <i class="fas fa-times"></i>
            </button>
            <div class="toast-progress"></div>
        `;

        this.container.appendChild(toast);

        // Animação de entrada
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Evento Fechar
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.close(toast));

        // Auto-fechamento
        if (duration > 0) {
            const progress = toast.querySelector('.toast-progress');
            if(progress) {
                progress.style.transition = `width ${duration}ms linear`;
                requestAnimationFrame(() => {
                    progress.style.width = '0%';
                });
            }

            setTimeout(() => {
                this.close(toast);
            }, duration);
        }
    }

    close(toastElement) {
        if (!toastElement || !toastElement.parentElement) return;

        toastElement.classList.remove('show');
        toastElement.classList.add('hiding');

        setTimeout(() => {
            if (toastElement.parentElement) {
                toastElement.parentElement.removeChild(toastElement);
            }
        }, 300);
    }
}

// Inicializa globalmente
window.NotificationManager = new NotificationSystem();