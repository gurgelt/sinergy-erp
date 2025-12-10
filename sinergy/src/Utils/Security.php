<?php
/**
 * Classe de Segurança
 * Sistema Sinergy
 */

namespace Sinergy\Utils;

class Security {
    /**
     * Gera hash de senha seguro
     * @param string $password
     * @return string
     */
    public static function hashPassword($password) {
        return password_hash($password, PASSWORD_DEFAULT);
    }

    /**
     * Verifica senha com hash
     * @param string $password
     * @param string $hash
     * @return bool
     */
    public static function verifyPassword($password, $hash) {
        return password_verify($password, $hash);
    }

    /**
     * Gera token aleatório seguro
     * @param int $length
     * @return string
     */
    public static function generateToken($length = 32) {
        return bin2hex(random_bytes($length));
    }

    /**
     * Gera código numérico aleatório
     * @param int $length
     * @return string
     */
    public static function generateNumericCode($length = 6) {
        $code = '';
        for ($i = 0; $i < $length; $i++) {
            $code .= random_int(0, 9);
        }
        return $code;
    }

    /**
     * Previne XSS escapando HTML
     * @param string $string
     * @return string
     */
    public static function escapeHtml($string) {
        return htmlspecialchars($string, ENT_QUOTES, 'UTF-8');
    }

    /**
     * Sanitiza nome de arquivo
     * @param string $filename
     * @return string
     */
    public static function sanitizeFilename($filename) {
        // Remove caracteres perigosos
        $filename = preg_replace('/[^a-zA-Z0-9._-]/', '', $filename);
        // Previne directory traversal
        $filename = str_replace(['../', '..\\'], '', $filename);
        return $filename;
    }

    /**
     * Valida CSRF token
     * @param string $token
     * @return bool
     */
    public static function validateCsrfToken($token) {
        if (!isset($_SESSION['csrf_token'])) {
            return false;
        }
        return hash_equals($_SESSION['csrf_token'], $token);
    }

    /**
     * Gera CSRF token
     * @return string
     */
    public static function generateCsrfToken() {
        if (!isset($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = self::generateToken();
        }
        return $_SESSION['csrf_token'];
    }
}
