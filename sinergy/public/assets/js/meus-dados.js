/**
 * meus-dados.js - Lógica para a página de perfil do usuário. (Integrado ao Backend)
 */

document.addEventListener('DOMContentLoaded', () => {
    loadUserProfile();
    setupProfileFormListener();
    setupProfilePictureUpload(); // Nova função para configurar o upload da foto
});

let selectedProfilePictureBase64 = null; // Variável para armazenar a imagem Base64 selecionada

async function loadUserProfile() {
    const rememberedUser = localStorage.getItem('sinergy_remember') || sessionStorage.getItem('sinergy_remember');
    if (!rememberedUser) {
        // Redirecionamento já é tratado em app.js. Aqui, apenas sai da função.
        return;
    }

    try {
        // O username é o identificador único para buscar no backend.
        const response = await fetch(`https://virtualcriacoes.com/sinergy/api/users/${rememberedUser}`);
        if (!response.ok) {
            console.error('Falha ao carregar perfil do usuário:', response.statusText);
            if (window.NotificationManager) NotificationManager.show({ title: 'Erro', message: 'Falha ao carregar seus dados. Tente novamente.', type: 'error' });
            return;
        }
        const currentUser = await response.json();

        // Preenche os campos do formulário com os nomes de propriedade capitalizados do backend
        document.getElementById('profile-fullname').value = currentUser.NomeCompleto || '';
        document.getElementById('profile-username').value = currentUser.NomeUsuario; 
        document.getElementById('profile-email').value = currentUser.Email || '';

        // Carregar e exibir a foto de perfil existente
        const profileAvatarPreview = document.getElementById('profile-avatar-preview');
        const placeholderText = document.querySelector('#profile-picture-preview .placeholder-text');

        if (currentUser.FotoPerfilBase64) {
            profileAvatarPreview.src = currentUser.FotoPerfilBase64;
            profileAvatarPreview.style.display = 'block';
            if (placeholderText) placeholderText.style.display = 'none';
            selectedProfilePictureBase64 = currentUser.FotoPerfilBase64; // Atualiza a variável com a foto atual
        } else {
            profileAvatarPreview.src = 'https://i.pravatar.cc/100'; // Fallback para avatar padrão
            profileAvatarPreview.style.display = 'block';
            if (placeholderText) placeholderText.style.display = 'block';
            selectedProfilePictureBase64 = null;
        }


    } catch (error) {
        console.error('Erro de rede ao carregar perfil:', error);
        if (window.NotificationManager) NotificationManager.show({ title: 'Erro', message: 'Erro de conexão ao carregar seus dados.', type: 'error' });
    }
}

function setupProfileFormListener() {
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', handleProfileUpdate);
    }
    
    const voltarButton = document.getElementById('btn-voltar');
    if(voltarButton) {
        voltarButton.addEventListener('click', () => {
            window.history.back();
        });
    }
}

// NOVA FUNÇÃO: Configura o input de upload de foto
function setupProfilePictureUpload() {
    const fileInput = document.getElementById('profile-picture-upload');
    const profileAvatarPreview = document.getElementById('profile-avatar-preview');
    const placeholderText = document.querySelector('#profile-picture-preview .placeholder-text');

    if (fileInput) {
        fileInput.addEventListener('change', function(event) {
            const file = event.target.files[0];

            if (file) {
                // Validação de tamanho (máximo 500KB)
                if (file.size > 500 * 1024) { // 500KB em bytes
                    if (window.NotificationManager) NotificationManager.show({ 
                        title: 'Erro de Imagem', 
                        message: 'A imagem é muito grande. Por favor, selecione uma imagem com até 500KB.', 
                        type: 'error' 
                    });
                    fileInput.value = ''; // Limpa o input do arquivo
                    profileAvatarPreview.src = 'https://i.pravatar.cc/100'; // Volta para o padrão ou último salvo
                    if (placeholderText) placeholderText.style.display = 'block';
                    selectedProfilePictureBase64 = null;
                    return;
                }

                const reader = new FileReader();
                reader.onload = function(e) {
                    profileAvatarPreview.src = e.target.result;
                    profileAvatarPreview.style.display = 'block';
                    if (placeholderText) placeholderText.style.display = 'none';
                    selectedProfilePictureBase64 = e.target.result; // Armazena a Base64
                };
                reader.readAsDataURL(file); // Converte a imagem para Base64
            } else {
                profileAvatarPreview.src = 'https://i.pravatar.cc/100'; // Fallback para avatar padrão
                if (placeholderText) placeholderText.style.display = 'block';
                selectedProfilePictureBase64 = null;
            }
        });
    }
}


async function handleProfileUpdate(event) {
    event.preventDefault();

    const rememberedUser = localStorage.getItem('sinergy_remember') || sessionStorage.getItem(REMEMBER_USER_KEY);
    if (!rememberedUser) {
        if (window.NotificationManager) NotificationManager.show({ title: 'Erro', message: 'Usuário não logado para atualização.', type: 'error' });
        return;
    }

    const fullname = document.getElementById('profile-fullname').value;
    const email = document.getElementById('profile-email').value;
    const newPassword = document.getElementById('profile-new-password').value;
    const confirmPassword = document.getElementById('profile-confirm-password').value;

    const updatePayload = {
        fullname: fullname,
        email: email,
        FotoPerfilBase64: selectedProfilePictureBase64 // INCLUI A FOTO BASE64 AQUI
    };

    if (newPassword) {
        if (newPassword.length < 6) {
            if (window.NotificationManager) NotificationManager.show({ title: 'Senha Inválida', message: 'A nova senha deve ter no mínimo 6 caracteres.', type: 'warning' });
            return;
        }
        if (newPassword !== confirmPassword) {
            if (window.NotificationManager) NotificationManager.show({ title: 'Senhas não conferem', message: 'A confirmação de senha está diferente da nova senha.', type: 'error' });
            return;
        }
        updatePayload.newPassword = newPassword; // Adiciona a nova senha ao payload
    }

    try {
        // Envia o username como parte da URL para identificar o usuário a ser atualizado
        const response = await fetch(`https://virtualcriacoes.com/sinergy/api/users/${rememberedUser}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Falha ao atualizar dados.');
        }

        if (window.NotificationManager) NotificationManager.show({ title: 'Sucesso', message: 'Seus dados foram atualizados!', type: 'success' });
        
        // Limpa os campos de senha por segurança
        document.getElementById('profile-new-password').value = '';
        document.getElementById('profile-confirm-password').value = '';

        // Recarrega o perfil para atualizar o nome/email na barra superior.
        await loadUserProfile(); // Chama loadUserProfile novamente
        // window.location.reload(); // Evite reload completo se loadUserProfile já atualiza a UI
                                  // reload só se for estritamente necessário ou para casos de falha.

    } catch (error) {
        console.error('Erro ao atualizar perfil:', error);
        if (window.NotificationManager) NotificationManager.show({ title: 'Erro', message: error.message, type: 'error' });
    }
}