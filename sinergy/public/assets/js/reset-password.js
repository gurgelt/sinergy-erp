document.addEventListener('DOMContentLoaded', function() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
        showNotification('Token de redefinição de senha inválido ou ausente.', 'error');
        // Redireciona para a página de login após 3 segundos
        setTimeout(() => window.location.href = 'login.html', 3000);
        return;
    }

    document.getElementById('reset-token').value = token;
    
    const elements = {
        forms: {
            reset: document.getElementById('reset-password-form')
        },
        buttons: {
            reset: document.getElementById('reset-password-button')
        },
        fields: {
            newPassword: document.getElementById('new-password'),
            confirmPassword: document.getElementById('confirm-password'),
            resetToken: document.getElementById('reset-token')
        }
    };
    
    setupResetFormEvents(elements);
    setupPasswordToggle(); // Reutiliza a função de login
    setupNotificationCloser(); // Reutiliza o fechamento da notificação
});

async function setupResetFormEvents(elements) {
    elements.forms.reset.addEventListener('submit', async function(event) {
        event.preventDefault();

        const newPassword = elements.fields.newPassword.value;
        const confirmPassword = elements.fields.confirmPassword.value;
        const token = elements.fields.resetToken.value;

        if (newPassword.length < 6) {
            showNotification('A nova senha deve ter no mínimo 6 caracteres.', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            showNotification('As senhas não coincidem.', 'error');
            return;
        }

        // Faz a requisição à API para redefinir a senha
        try {
            const result = await makeApiRequest('reset-password', { token, newPassword });

            if (result.ok) {
                showNotification('Senha redefinida com sucesso! Redirecionando para o login...', 'success');
                setTimeout(() => window.location.href = 'login.html', 3000);
            } else {
                const errorMessage = result.data.error || `Erro HTTP ${result.status}`;
                showNotification(errorMessage, 'error');
            }
        } catch (error) {
            console.error('Erro na redefinição de senha:', error);
            showNotification('Erro ao conectar com o servidor. Tente novamente mais tarde.', 'error');
        }
    });
}