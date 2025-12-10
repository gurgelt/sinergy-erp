<?php
/**
 * Conexão com Banco de Dados
 * Sistema Sinergy
 */

require_once __DIR__ . '/config.php';

/**
 * Retorna uma conexão MySQLi
 * @return mysqli|false
 */
function get_db_connection() {
    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

    try {
        $conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);

        if ($conn->connect_error) {
            error_log("Erro de conexão MySQL: " . $conn->connect_error);
            return false;
        }

        $conn->set_charset("utf8mb4");
        return $conn;
    } catch (Exception $e) {
        error_log("Exceção na conexão: " . $e->getMessage());
        return false;
    }
}

/**
 * Fecha uma conexão de banco de dados
 * @param mysqli $conn
 */
function close_db_connection($conn) {
    if ($conn && $conn instanceof mysqli) {
        $conn->close();
    }
}
