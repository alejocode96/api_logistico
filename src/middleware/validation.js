const { body, validationResult } = require('express-validator');

/**
 * Middleware: maneja errores de validación generados por express-validator.
 * - Si hay errores, responde 400 con un JSON con la lista de errores.
 * - Si no hay errores, llama a next() para continuar con la petición.
 */

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation errors',
            errors: errors.array() // array con { msg, param, location, value, ... }
        });
    }
    next();
};

/**
 * Validaciones para registro de usuario.
 * - Se exporta como un array de middlewares para usar directamente en la ruta.
 */
const validateUserRegistration = [
    // firstName: obligatorio, trim, longitud entre 2 y 50
    body('firstName')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('First name must be between 2 and 50 characters'),

    // lastName: obligatorio, trim, longitud entre 2 y 50
    body('lastName')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Last name must be between 2 and 50 characters'),

    // email: debe ser email válido, se normaliza (quita mayúsculas, puntos según proveedor)
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email'),

    // password: mínimo 8 caracteres y debe cumplir complejidad (mayúscula, minúscula, número, caracter especial)
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'),

    // role: opcional, solo valores 'user' o 'admin'
    body('role')
        .optional()
        .isIn(['user', 'admin'])
        .withMessage('Role must be either user or admin'),

    // status: opcional, solo 'active' o 'inactive'
    body('status')
        .optional()
        .isIn(['active', 'inactive'])
        .withMessage('Status must be either active or inactive'),

    // middleware final que envía errores si existen
    handleValidationErrors
];

/**
 * Validaciones para login de usuario.
 */
const validateUserLogin = [
    // email requerido y valido
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email'),

    // password requerido (no vacío)
    body('password')
        .notEmpty()
        .withMessage('Password is required'),

    handleValidationErrors
];

/**
 * Validaciones para actualización parcial de usuario.
 * - Todos los campos son opcionales; si vienen, se validan.
 */
const validateUserUpdate = [
    body('firstName')
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('First name must be between 2 and 50 characters'),

    body('lastName')
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Last name must be between 2 and 50 characters'),

    body('email')
        .optional()
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email'),

    body('password')
        .optional()
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'),

    body('role')
        .optional()
        .isIn(['user', 'admin'])
        .withMessage('Role must be either user or admin'),

    body('status')
        .optional()
        .isIn(['active', 'inactive'])
        .withMessage('Status must be either active or inactive'),

    handleValidationErrors
];

module.exports = {
    validateUserRegistration,
    validateUserLogin,
    validateUserUpdate,
    handleValidationErrors
};