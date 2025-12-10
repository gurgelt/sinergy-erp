<?php
/**
 * Classe de Validação
 * Sistema Sinergy
 */

namespace Sinergy\Utils;

class Validation {
    /**
     * Sanitiza entrada de dados
     * @param string $data
     * @return string
     */
    public static function sanitize($data) {
        if ($data === null) return '';
        return htmlspecialchars(strip_tags(trim($data)), ENT_QUOTES, 'UTF-8');
    }

    /**
     * Valida email
     * @param string $email
     * @return bool
     */
    public static function isValidEmail($email) {
        return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }

    /**
     * Valida se campo não está vazio
     * @param mixed $value
     * @return bool
     */
    public static function required($value) {
        if (is_string($value)) {
            return trim($value) !== '';
        }
        return !empty($value);
    }

    /**
     * Valida tamanho mínimo de string
     * @param string $value
     * @param int $min
     * @return bool
     */
    public static function minLength($value, $min) {
        return mb_strlen($value, 'UTF-8') >= $min;
    }

    /**
     * Valida tamanho máximo de string
     * @param string $value
     * @param int $max
     * @return bool
     */
    public static function maxLength($value, $max) {
        return mb_strlen($value, 'UTF-8') <= $max;
    }

    /**
     * Valida número
     * @param mixed $value
     * @return bool
     */
    public static function isNumeric($value) {
        return is_numeric($value);
    }

    /**
     * Valida data no formato brasileiro (dd/mm/yyyy)
     * @param string $date
     * @return bool
     */
    public static function isValidDate($date) {
        if (!preg_match('/^(\d{2})\/(\d{2})\/(\d{4})$/', $date, $matches)) {
            return false;
        }
        return checkdate($matches[2], $matches[1], $matches[3]);
    }

    /**
     * Valida CPF
     * @param string $cpf
     * @return bool
     */
    public static function isValidCPF($cpf) {
        $cpf = preg_replace('/[^0-9]/', '', $cpf);

        if (strlen($cpf) != 11 || preg_match('/(\d)\1{10}/', $cpf)) {
            return false;
        }

        for ($t = 9; $t < 11; $t++) {
            for ($d = 0, $c = 0; $c < $t; $c++) {
                $d += $cpf[$c] * (($t + 1) - $c);
            }
            $d = ((10 * $d) % 11) % 10;
            if ($cpf[$c] != $d) {
                return false;
            }
        }
        return true;
    }

    /**
     * Valida CNPJ
     * @param string $cnpj
     * @return bool
     */
    public static function isValidCNPJ($cnpj) {
        $cnpj = preg_replace('/[^0-9]/', '', $cnpj);

        if (strlen($cnpj) != 14 || preg_match('/(\d)\1{13}/', $cnpj)) {
            return false;
        }

        $length = strlen($cnpj) - 2;
        $numbers = substr($cnpj, 0, $length);
        $digits = substr($cnpj, $length);
        $sum = 0;
        $pos = $length - 7;

        for ($i = $length; $i >= 1; $i--) {
            $sum += $numbers[$length - $i] * $pos--;
            if ($pos < 2) $pos = 9;
        }

        $result = $sum % 11 < 2 ? 0 : 11 - $sum % 11;
        if ($result != $digits[0]) return false;

        $length++;
        $numbers = substr($cnpj, 0, $length);
        $sum = 0;
        $pos = $length - 7;

        for ($i = $length; $i >= 1; $i--) {
            $sum += $numbers[$length - $i] * $pos--;
            if ($pos < 2) $pos = 9;
        }

        $result = $sum % 11 < 2 ? 0 : 11 - $sum % 11;
        return $result == $digits[1];
    }
}
