<?php
/**
 * Configurações Centralizadas da Aplicação
 * Sistema Sinergy
 */

// Carrega variáveis de ambiente (se existir arquivo .env)
$envFile = __DIR__ . '/../.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        list($name, $value) = explode('=', $line, 2);
        $_ENV[trim($name)] = trim($value);
    }
}

// Configurações do Banco de Dados
define('DB_HOST', $_ENV['DB_HOST'] ?? 'localhost');
define('DB_NAME', $_ENV['DB_NAME'] ?? 'atriu019_sinergy');
define('DB_USER', $_ENV['DB_USER'] ?? 'atriu019_paulo');
define('DB_PASSWORD', $_ENV['DB_PASSWORD'] ?? 'jauyo8Y091Z@58JABSDavas%%');

// Configurações da Aplicação
define('APP_ENV', $_ENV['APP_ENV'] ?? 'production');
define('APP_DEBUG', filter_var($_ENV['APP_DEBUG'] ?? false, FILTER_VALIDATE_BOOLEAN));
define('APP_URL', $_ENV['APP_URL'] ?? 'https://virtualcriacoes.com');

// Configurações de Sessão
define('SESSION_LIFETIME', $_ENV['SESSION_LIFETIME'] ?? 7200);

// Configurações de CORS
define('CORS_ALLOWED_ORIGINS', $_ENV['CORS_ALLOWED_ORIGINS'] ?? '*');

// API Settings
define('API_BASE_PATH', '/sinergy/api');


// Paths do Sistema
define('ROOT_PATH', dirname(__DIR__));
define('CONFIG_PATH', ROOT_PATH . '/config');
define('SRC_PATH', ROOT_PATH . '/src');
define('PUBLIC_PATH', ROOT_PATH . '/public');
define('LOGS_PATH', ROOT_PATH . '/logs');

// Configurações de Erro
if (APP_DEBUG) {
    ini_set('display_errors', 1);
    ini_set('display_startup_errors', 1);
    error_reporting(E_ALL);
} else {
    ini_set('display_errors', 0);
    ini_set('display_startup_errors', 0);
    error_reporting(0);

    // Log de erros em arquivo
    ini_set('log_errors', 1);
    ini_set('error_log', LOGS_PATH . '/php_errors.log');
}

// Timezone
date_default_timezone_set('America/Sao_Paulo');
