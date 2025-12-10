/**
 * login.js - Sistema de Login Sinergy ERP
 * Versão: 3.0 (Produção)
 */

document.addEventListener('DOMContentLoaded', function() {
    initLoginSystem();
});

const REMEMBER_USER = 'sinergy_remember';
const API_BASE_URL = 'https://virtualcriacoes.com/sinergy/api';

// Constantes compatíveis com app.js
const USER_ID_KEY = 'sinergy_user_id';
const USER_ROLE_KEY = 'sinergy_user_role';
const USER_NAME_KEY = 'sinergy_user_name';
const LOGIN_FLASH_KEY = 'sinergy_login_success_flash';

function initLoginSystem() {
    const elements = getElements();
    
    if (!validateElements(elements)) {
        return;
    }
    
    setupNavigation(elements);
    setupFormEvents(elements);
    setupPasswordToggle();
    setupNotificationCloser(elements);
    checkRememberedUser(elements);
    addEnterKeySupport(elements);
}

function getElements() {
    return {
        forms: {
            login: document.getElementById('login-form'),
            recover: document.getElementById('recover-form')
        },
        buttons: {
            login: document.getElementById('login-button'),
            recover: document.getElementById('recover-button')
        },
        navigation: {
            showRecover: document.getElementById('show-recover'),
            backToLogin: document.getElementById('back-to-login')
        },
        notification: {
            container: document.getElementById('notification'),
            message: document.getElementById('notification-message'),
            close: document.getElementById('close-notification')
        },
        fields: {
            username: document.getElementById('username'),
            password: document.getElementById('password'),
            remember: document.getElementById('remember'),
            recoverEmail: document.getElementById('recover-email')
        }
    };
}

function validateElements(elements) {
    return elements.forms.login && 
           elements.buttons.login && 
           elements.fields.username && 
           elements.fields.password;
}

function setupNavigation(elements) {
    if (elements.navigation.showRecover) {
        elements.navigation.showRecover.addEventListener('click', function(e) {
            e.preventDefault();
            switchForm(elements.forms.login, elements.forms.recover);
            if (elements.fields.recoverEmail) {
                elements.fields.recoverEmail.focus();
            }
        });
    }
    
    if (elements.navigation.backToLogin) {
        elements.navigation.backToLogin.addEventListener('click', function(e) {
            e.preventDefault();
            switchForm(elements.forms.recover, elements.forms.login);
            if (elements.fields.username) {
                elements.fields.username.focus();
            }
        });
    }
}

function switchForm(currentForm, targetForm) {
    currentForm.style.opacity = '0';
    
    setTimeout(() => {
        currentForm.style.display = 'none';
        targetForm.style.display = 'block';
        targetForm.style.opacity = '0';
        
        setTimeout(() => {
            targetForm.style.opacity = '1';
        }, 50);
    }, 300);
}

function setupFormEvents(elements) {
    if (elements.buttons.login) {
        elements.buttons.login.addEventListener('click', function(e) {
            e.preventDefault();
            handleLogin(elements);
        });
    }
    
    if (elements.buttons.recover) {
        elements.buttons.recover.addEventListener('click', function(e) {
            e.preventDefault();
            handleRecover(elements);
        });
    }
}

function setupPasswordToggle() {
    document.querySelectorAll('.toggle-password').forEach(function(button) {
        button.addEventListener('click', function() {
            const input = this.closest('.input-field').querySelector('input');
            const icon = this.querySelector('i');
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    });
}

function setupNotificationCloser(elements) {
    if (elements.notification.close) {
        elements.notification.close.addEventListener('click', function() {
            elements.notification.container.classList.remove('show');
        });
    }
}

function addEnterKeySupport(elements) {
    if (elements.fields.password) {
        elements.fields.password.addEventListener('keyup', function(event) {
            if (event.key === 'Enter') {
                elements.buttons.login.click();
            }
        });
    }
    
    if (elements.fields.username) {
        elements.fields.username.addEventListener('keyup', function(event) {
            if (event.key === 'Enter') {
                elements.fields.password.focus();
            }
        });
    }
    
    if (elements.fields.recoverEmail) {
        elements.fields.recoverEmail.addEventListener('keyup', function(event) {
            if (event.key === 'Enter') {
                elements.buttons.recover.click();
            }
        });
    }
}

function checkRememberedUser(elements) {
    const rememberedUser = localStorage.getItem(REMEMBER_USER) || sessionStorage.getItem(REMEMBER_USER);
    if (rememberedUser) {
        elements.fields.username.value = rememberedUser;
        elements.fields.remember.checked = true;
        elements.fields.password.focus();
    }
}

async function handleLogin(elements) {
    const username = elements.fields.username.value.trim();
    const password = elements.fields.password.value;
    const remember = elements.fields.remember.checked;
    
    if (!validateLoginForm(username, password)) {
        return;
    }
    
    setButtonLoading(elements.buttons.login, true, 'Autenticando...');
    showLoader(true);
    
    try {
        const result = await makeApiRequest('login', { username, password });
        
        // Verifica se o login foi bem-sucedido
        if (result.ok && result.status === 200 && !result.data.error) {
            // Usa a função loginSuccess do app.js se estiver disponível
            if (typeof loginSuccess === 'function') {
                loginSuccess(result.data, remember);
            } else {
                handleLoginSuccess(result.data, username, remember);
            }
        } else {
            // Login falhou - mostra erro
            let errorMessage = 'Usuário ou senha incorretos';
            
            if (result.data && result.data.error) {
                errorMessage = result.data.error;
            } else if (result.status === 401) {
                errorMessage = 'Usuário ou senha incorretos';
            } else if (result.status === 404) {
                errorMessage = 'Usuário não encontrado';
            } else if (result.status >= 500) {
                errorMessage = 'Erro no servidor. Tente novamente.';
            }
            
            showNotification(errorMessage, 'error');
            
            // Limpa o campo de senha
            elements.fields.password.value = '';
            elements.fields.password.focus();
        }
    } catch (error) {
        showNotification('Erro de conexão. Verifique sua internet.', 'error');
    } finally {
        setButtonLoading(elements.buttons.login, false, 'Entrar');
        showLoader(false);
    }
}

function validateLoginForm(username, password) {
    if (!username || !password) {
        showNotification('Preencha usuário e senha.', 'error');
        return false;
    }
    
    if (username.length < 3) {
        showNotification('Usuário deve ter no mínimo 3 caracteres.', 'error');
        return false;
    }
    
    return true;
}

function handleLoginSuccess(data, username, remember) {
    const storage = remember ? localStorage : sessionStorage;
    
    storage.setItem(REMEMBER_USER, data.username || username);
    storage.setItem(USER_ID_KEY, data.id.toString());
    storage.setItem(USER_ROLE_KEY, data.role || 'user');
    storage.setItem(USER_NAME_KEY, data.fullname || username);
    
    sessionStorage.setItem(LOGIN_FLASH_KEY, 'true');
    
    showNotification('Login realizado com sucesso!', 'success');
    
    setTimeout(() => {
        const redirectUrl = sessionStorage.getItem('redirect_after_login');
        window.location.href = redirectUrl || '../index.html';
    }, 1000);
}

async function handleRecover(elements) {
    const email = elements.fields.recoverEmail.value.trim();
    
    if (!validateRecoverForm(email)) {
        return;
    }
    
    setButtonLoading(elements.buttons.recover, true, 'Enviando...');
    showLoader(true);
    
    try {
        const result = await makeApiRequest('recover-password', { email });
        
        if (result.ok) {
            showNotification('Instruções enviadas para seu e-mail!', 'success');
            
            setTimeout(() => {
                switchForm(elements.forms.recover, elements.forms.login);
                elements.fields.recoverEmail.value = '';
            }, 2500);
        } else {
            const errorMessage = result.data?.error || result.data?.message || 'E-mail não encontrado';
            showNotification(errorMessage, 'error');
        }
    } catch (error) {
        showNotification('Erro de conexão. Tente novamente.', 'error');
    } finally {
        setButtonLoading(elements.buttons.recover, false, 'Enviar Instruções');
        showLoader(false);
    }
}

function validateRecoverForm(email) {
    if (!email) {
        showNotification('Digite seu e-mail.', 'error');
        return false;
    }
    
    if (!isValidEmail(email)) {
        showNotification('E-mail inválido.', 'error');
        return false;
    }
    
    return true;
}

function isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

async function makeApiRequest(endpoint, data) {
    const url = `${API_BASE_URL}/${endpoint}`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(data),
            mode: 'cors'
        });

        const responseText = await response.text();
        let responseData;
        
        try {
            responseData = JSON.parse(responseText);
        } catch (e) {
            if (responseText.includes('<html>') || responseText.includes('<!DOCTYPE')) {
                throw new Error('Servidor retornou HTML ao invés de JSON');
            }
            throw new Error('Resposta inválida do servidor');
        }

        return {
            ok: response.ok,
            status: response.status,
            data: responseData
        };
    } catch (error) {
        throw error;
    }
}

function setButtonLoading(button, isLoading, text) {
    if (!button) return;
    button.disabled = isLoading;
    button.textContent = text;
}

function showLoader(show) {
    const loader = document.getElementById('loader-overlay');
    if (loader) {
        loader.style.display = show ? 'flex' : 'none';
    }
}

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    const notificationMessage = document.getElementById('notification-message');
    
    if (!notification || !notificationMessage) {
        alert(message);
        return;
    }
    
    // Remove classes antigas
    notification.className = 'notification';
    
    // Adiciona novas classes
    notification.classList.add(type, 'show');
    notificationMessage.textContent = message;
    
    // Força reflow para garantir animação
    notification.offsetHeight;
    
    // Auto-hide apenas para success e info
    if (type === 'success' || type === 'info') {
        if (notification.hideTimeout) {
            clearTimeout(notification.hideTimeout);
        }
        
        notification.hideTimeout = setTimeout(() => {
            notification.classList.remove('show');
        }, 5000);
    }
}