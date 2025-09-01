const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config/config');
const database = require('../config/database');

/**
 * AuthController
 * Controlador que maneja login, refresh y logout usando JWT + refresh tokens.
 * - accessToken: token de corta duración para autorizar requests.
 * - refreshToken: token de mayor duración usado para renovar el accessToken.
 */

class AuthController {
    /**
  * User login
  * POST /auth/login
  * Body: { email, password }
  *
  * Flujo:
  * 1. Buscar usuario por email.
  * 2. Verificar que el usuario exista y esté activo.
  * 3. Verificar bloqueo por intentos fallidos.
  * 4. Verificar password; si es inválido, incrementar intentos de login.
  * 5. Si el login es exitoso, resetear intentos y generar access + refresh tokens.
  * 6. Guardar refresh token en BD y devolver tokens + usuario.
  */
    static async login(req, res) {
        try {
            const { email, password } = req.body;
            // Find user by email
            const user = await User.findByEmail(email);

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid credentials'
                });
            }

            // Check if user is active
            if (user.status !== 'active') {
                return res.status(401).json({
                    success: false,
                    message: 'Account is inactive'
                });
            }

            // Check if account is locked (business logic in User model)
            if (user.isLocked()) {
                return res.status(423).json({
                    success: false,
                    message: 'Account is temporarily locked due to too many failed login attempts'
                });
            }

            // Verify password (assume user.verifyPassword hace bcrypt.compare internamente)
            const isValidPassword = await user.verifyPassword(password);
            if (!isValidPassword) {
                // Increment failed login attempts (logic en modelo User)
                await user.incrementLoginAttempts();

                let message = 'Invalid credentials';
                if (user.loginAttempts >= config.security.maxLoginAttempts) {
                    // Mensaje más específico si alcanzó el límite
                    message = 'Too many failed attempts. Account has been temporarily locked.';
                }

                return res.status(401).json({
                    success: false,
                    message
                });
            }

            // Reset login attempts on successful login (si había intentos anteriores)
            if (user.loginAttempts > 0) {
                await user.resetLoginAttempts();
            }

            // Generate access token (payload contiene id, email, role)
            const accessToken = jwt.sign(
                {
                    id: user.id,
                    email: user.email,
                    role: user.role
                },
                config.jwt.secret,
                { expiresIn: config.jwt.expiresIn }
            );

            // Generate refresh token (payload más pequeño)
            const refreshToken = jwt.sign(
                {
                    id: user.id,
                    email: user.email
                },
                config.jwt.refreshSecret,
                { expiresIn: config.jwt.refreshExpiresIn }
            );

            // Store refresh token in database (tabla refresh_tokens)
            await AuthController.storeRefreshToken(refreshToken, user.id);

            // Responder con datos del usuario y tokens
            res.json({
                success: true,
                message: 'Login successful',
                data: {
                    user: user.toJSON(),
                    accessToken,
                    refreshToken,
                    expiresIn: config.jwt.expiresIn
                }
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({
                success: false,
                message: 'Server error',
                error: error.message
            });
        }
    }

    /**
   * Refresh access token
   * POST /auth/refresh
   * Body: { refreshToken }
   *
   * Flujo:
   * 1. Validar que venga refreshToken.
   * 2. Verificar firma/validez del refresh token usando refreshSecret.
   * 3. Comprobar que el token exista y no esté expirado en la BD.
   * 4. Obtener usuario y comprobar que esté activo.
   * 5. Generar y devolver un nuevo access token.
   */

    static async refreshToken(req, res) {
        try {
            const { refreshToken } = req.body;
            if (!refreshToken) {
                return res.status(401).json({
                    success: false,
                    message: 'Refresh token is required'
                });
            }

            // Verify refresh token signature & expiration (lanzará si es inválido)
            const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);

            // Check if refresh token exists in database y no expiró (validateRefreshToken)
            const tokenExists = await AuthController.validateRefreshToken(refreshToken, decoded.id);

            if (!tokenExists) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid refresh token'
                });
            }

            // Get user data
            const user = await User.findById(decoded.id);

            if (!user || user.status !== 'active') {
                return res.status(401).json({
                    success: false,
                    message: 'User not found or inactive'
                });
            }

            // Generate new access token
            const accessToken = jwt.sign(
                {
                    id: user.id,
                    email: user.email,
                    role: user.role
                },
                config.jwt.secret,
                { expiresIn: config.jwt.expiresIn }
            );

            res.json({
                success: true,
                message: 'Token refreshed successfully',
                data: {
                    accessToken,
                    expiresIn: config.jwt.expiresIn
                }
            });
        } catch (error) {
            console.error('Token refresh error:', error);
            // Si falla la verificación, se responde 401 (invalid refresh token)
            res.status(401).json({
                success: false,
                message: 'Invalid refresh token'
            });
        }
    }

    /**
  * User logout
  * POST /auth/logout
  * Body: { refreshToken }
  *
  * Flujo:
  * - Si llega refreshToken, se elimina de la BD para revocar sesión.
  */

    static async logout(req, res) {
        try {
            const { refreshToken } = req.body;

            if (refreshToken) {
                // Remove refresh token from database
                await AuthController.removeRefreshToken(refreshToken);
            }

            res.json({
                success: true,
                message: 'Logout successful'
            });
        } catch (error) {
            console.error('Logout error:', error);
            res.status(500).json({
                success: false,
                message: 'Server error',
                error: error.message
            });
        }
    }

    /**
  * Store refresh token in database
  * @param {string} token - refresh token JWT
  * @param {number} userId - id del usuario
  * @returns {Promise<number>} - id de la fila insertada en la tabla refresh_tokens
  */
    static async storeRefreshToken(token, userId) {
        return new Promise((resolve, reject) => {
            const db = database.getDb();
            // Calculamos expiresAt: ahora + 7 días (ISO string)
            const expiresAt = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)).toISOString(); // 7 days

            const query = 'INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?, ?, ?)';

            // Parámetros parametrizados evitan inyección SQL
            db.run(query, [token, userId, expiresAt], function (err) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(this.lastID);
            });
        });
    }

    /**
 * Validate refresh token exists and no está expirado
 * @param {string} token
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
    static async validateRefreshToken(token, userId) {
        return new Promise((resolve, reject) => {
            const db = database.getDb();
            // Consulta busca token activo (expires_at > datetime("now") en SQLite)
            const query = 'SELECT * FROM refresh_tokens WHERE token = ? AND user_id = ? AND expires_at > datetime("now")';

            db.get(query, [token, userId], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                // resolve true si row existe, false en caso contrario
                resolve(!!row);
            });
        });
    }

    /**
  * Remove refresh token (logout / revocación manual)
  * @param {string} token
  * @returns {Promise<boolean>} - true si borró alguna fila
  */
    static async removeRefreshToken(token) {
        return new Promise((resolve, reject) => {
            const db = database.getDb();
            const query = 'DELETE FROM refresh_tokens WHERE token = ?';

            db.run(query, [token], function (err) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(this.changes > 0);
            });
        });
    }

}

module.exports = AuthController;