<?php
/**
 * Controller Base
 * Sistema Sinergy
 */

namespace Sinergy\Controllers;

use Sinergy\Utils\Response;
use Sinergy\Utils\Validation;

abstract class BaseController {
    protected $conn;

    public function __construct() {
        $this->conn = get_db_connection();
        if (!$this->conn) {
            Response::serverError('Não foi possível conectar ao banco de dados');
        }
    }

    public function __destruct() {
        if ($this->conn && $this->conn instanceof \mysqli) {
            $this->conn->close();
        }
    }

    /**
     * Valida campos obrigatórios
     * @param array $data
     * @param array $requiredFields
     * @return bool|array Retorna true se válido, ou array de erros
     */
    protected function validateRequired($data, $requiredFields) {
        $errors = [];
        foreach ($requiredFields as $field) {
            if (!isset($data[$field]) || (is_string($data[$field]) && trim($data[$field]) === '')) {
                $errors[] = "Campo '$field' é obrigatório";
            }
        }
        return empty($errors) ? true : $errors;
    }

    /**
     * Sanitiza entrada de dados
     * @param string $data
     * @return string
     */
    protected function sanitize($data) {
        return Validation::sanitize($data);
    }
}
