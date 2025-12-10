<?php
/**
 * Classe de Resposta JSON
 * Sistema Sinergy
 */

namespace Sinergy\Utils;

class Response {
    /**
     * Envia resposta JSON
     * @param array $data
     * @param int $statusCode
     */
    public static function json($data, $statusCode = 200) {
        http_response_code($statusCode);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit;
    }

    /**
     * Envia resposta de sucesso
     * @param mixed $data
     * @param string $message
     * @param int $statusCode
     */
    public static function success($data = null, $message = 'Operação realizada com sucesso', $statusCode = 200) {
        $response = [
            'success' => true,
            'message' => $message
        ];

        if ($data !== null) {
            $response['data'] = $data;
        }

        self::json($response, $statusCode);
    }

    /**
     * Envia resposta de erro
     * @param string $message
     * @param int $statusCode
     * @param array $errors
     */
    public static function error($message = 'Erro na operação', $statusCode = 400, $errors = []) {
        $response = [
            'success' => false,
            'error' => $message
        ];

        if (!empty($errors)) {
            $response['errors'] = $errors;
        }

        self::json($response, $statusCode);
    }

    /**
     * Envia resposta de não autorizado
     * @param string $message
     */
    public static function unauthorized($message = 'Não autorizado') {
        self::error($message, 401);
    }

    /**
     * Envia resposta de não encontrado
     * @param string $message
     */
    public static function notFound($message = 'Recurso não encontrado') {
        self::error($message, 404);
    }

    /**
     * Envia resposta de validação falhou
     * @param array $errors
     */
    public static function validationError($errors = []) {
        self::error('Erro de validação', 422, $errors);
    }

    /**
     * Envia resposta de erro interno
     * @param string $message
     */
    public static function serverError($message = 'Erro interno do servidor') {
        self::error($message, 500);
    }
}
