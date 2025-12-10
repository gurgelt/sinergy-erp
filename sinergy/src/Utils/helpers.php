<?php
/**
 * Funções auxiliares (para compatibilidade com código antigo)
 * Sistema Sinergy
 */

// Compatibilidade com funções antigas
function sanitize_input($data) {
    return \Sinergy\Utils\Validation::sanitize($data);
}

function validate_email($email) {
    return \Sinergy\Utils\Validation::isValidEmail($email);
}

function hash_password($password) {
    return \Sinergy\Utils\Security::hashPassword($password);
}

function check_password($password, $hash) {
    return \Sinergy\Utils\Security::verifyPassword($password, $hash);
}

function sendJsonResponse($data, $statusCode = 200) {
    \Sinergy\Utils\Response::json($data, $statusCode);
}
