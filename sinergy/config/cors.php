<?php
/**
 * Configurações CORS
 * Sistema Sinergy
 */

require_once __DIR__ . '/config.php';

/**
 * Configura cabeçalhos CORS
 */
function setup_cors() {
    header("Access-Control-Allow-Origin: " . CORS_ALLOWED_ORIGINS);
    header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization, Accept");
    header("Content-Type: application/json; charset=UTF-8");

    // Responde OPTIONS requests para preflight
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit();
    }
}
