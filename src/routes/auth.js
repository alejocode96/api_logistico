/**
 * routes/auth.js
 *
 * Router de autenticación:
 * - Montado típicamente en: /api/auth
 * - Expone endpoints para: login, refresh token y logout.
 *
 * Responsabilidad:
 * - Definir rutas HTTP y encadenar middlewares necesarios (rate-limiter, validaciones).
 * - Delegar la lógica de negocio a AuthController.
 *
 * Nota: este archivo solo se encarga del enrutamiento. La lógica de verificación de credenciales,
 * generación/revocación de tokens y manipulación de la base de datos debe estar en AuthController
 * y en los middlewares requeridos.
 */

const express = require('express');
const AuthController = require('../controllers/authController');
const { validateUserLogin } = require('../middleware/validation');
const { loginLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

/**
 * @route   POST /api/auth/login
 * @desc    Iniciar sesión / obtener access + refresh tokens
 * @access  Public
 * @body    { email: string, password: string }
 * @middlewares
 *   - loginLimiter: limita la tasa de peticiones para proteger contra fuerza bruta.
 *   - validateUserLogin: valida el formato y campos necesarios del body (email, password).
 * @response (éxito) JSON con { success, message, data: { user, accessToken, refreshToken, expiresIn } }
 * @errors  400/401/423/500 según la lógica del controlador y middlewares.
 */
router.post('/login', loginLimiter, validateUserLogin, AuthController.login);

/**
 * @route   POST /api/auth/refresh
 * @desc    Renovar access token usando un refresh token válido
 * @access  Public
 * @body    { refreshToken: string }   // o puede venir en cookie según implementación
 * @middlewares
 *   - (ninguno aplicado aquí por defecto; podrías añadir validación adicional)
 * @response (éxito) JSON con { success, message, data: { accessToken, expiresIn } }
 * @errors  400/401/500 según verificación y existencia del refresh token.
 */
router.post('/refresh', AuthController.refreshToken);

/**
 * @route   POST /api/auth/logout
 * @desc    Cerrar sesión / revocar refresh token
 * @access  Public
 * @body    { refreshToken?: string }  // opcional según cómo manejes la revocación (body o cookie)
 * @response (éxito) { success: true, message: 'Logout successful' }
 * @errors  500 si hay problemas al eliminar el token en servidor.
 */
router.post('/logout', AuthController.logout);

module.exports = router;