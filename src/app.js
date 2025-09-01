const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

// Importar rutas
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');

// Importar middlewares/servicios
const { apiLimiter } = require('./middleware/rateLimiter');
const database = require('./config/database');
const userService = require('./services/userService');
const logger = require('./utils/logger');

/**
 * Clase App
 * - Construye y configura la aplicación Express.
 * - Registra middlewares de seguridad, parsing, logs y rate-limiting.
 * - Monta rutas de la API y manejadores de error.
 * - Ofrece un método `initialize()` para preparar recursos (BD, usuarios).
 */
class App {
    constructor() {
        // Instancia de Express
        this.app = express();

        // Configuración inicial
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    /**
     * Configura middlewares globales:
     * - helmet: cabeceras de seguridad.
     * - cors: política de orígenes (front-end).
     * - body parsers: JSON / urlencoded con límites.
     * - rate limiter: protección contra abuso.
     * - archivos estáticos: carpeta uploads.
     * - request logger: registra cada petición entrante.
     */
    setupMiddleware() {
        // Middleware de seguridad para cabeceras HTTP
        this.app.use(helmet());

        // Configuración de CORS
        this.app.use(cors({
            origin: process.env.FRONTEND_URL || 'http://localhost:3001',
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization']
        }));

        // Parseo del body (JSON y URL-encoded) con límite de 10mb
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Rate limiting aplicado a todas las rutas bajo /api
        this.app.use('/api', apiLimiter);

        // Servir archivos estáticos (ej. uploads de imágenes/adjuntos)
        this.app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

        // Middleware para logging de cada request
        this.app.use((req, res, next) => {
            // Registrar método y ruta, junto con IP y User-Agent
            logger.info(`${req.method} ${req.path}`, {
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            next();
        });
    }

    /**
     * Monta las rutas de la aplicación:
     * - /api/health       -> healthcheck
     * - /api/auth         -> authRoutes (login, refresh, logout)
     * - /api/users        -> userRoutes (CRUD usuarios)
     * - '*'               -> handler 404 para rutas no encontradas
     */
    setupRoutes() {
        // Health check básico
        this.app.get('/api/health', (req, res) => {
            res.json({
                success: true,
                message: 'API is running',
                timestamp: new Date().toISOString(),
                environment: process.env.NODE_ENV
            });
        });

        // Rutas principales de la API
        this.app.use('/api/auth', authRoutes);
        this.app.use('/api/users', userRoutes);

        this.app.use(/.*/, (req, res) => {
            res.status(404).json({
                success: false,
                message: 'Route not found'
            });
        });

    }

    /**
     * Manejo global de errores.
     * - Registra el error con detalles (mensaje, stack, ruta, método).
     * - Responde con message: si está en development muestra el mensaje real,
     *   en producción devuelve 'Internal server error' para no filtrar información.
     */
    setupErrorHandling() {
        // Middleware con firma (error, req, res, next)
        this.app.use((error, req, res, next) => {
            logger.error('Unhandled error:', {
                error: error.message,
                stack: error.stack,
                path: req.path,
                method: req.method
            });

            res.status(error.status || 500).json({
                success: false,
                message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        });
    }

    /**
     * Inicializa recursos críticos:
     * - Inicializa la base de datos.
     * - Crea un admin por defecto si no hay usuarios.
     * - Inicializa usuarios desde un archivo Excel (sincronización inicial).
     *
     * Importante: este método debe llamarse antes de empezar a escuchar conexiones.
     */
    async initialize() {
        try {
            // Inicializar conexión/estructura de la base de datos
            await database.init();
            logger.info('Database initialized successfully');

            // Crear admin por defecto si la tabla de usuarios está vacía
            await userService.createDefaultAdmin();

            // Importar usuarios desde Excel hacia la BD
            await userService.initializeUsersFromExcel();

            logger.info('Application initialization completed');
        } catch (error) {
            // Registrar fallo de inicialización y re-lanzar para que el proceso caller lo maneje
            logger.error('Application initialization failed:', { error: error.message });
            throw error;
        }
    }

    /**
     * Devuelve la instancia de Express para que el servidor la use.
     * @returns {Express.Application}
     */
    getApp() {
        return this.app;
    }
}

module.exports = App;
