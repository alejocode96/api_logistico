/**
 * routes/users.js
 *
 * Router para endpoints relacionados con usuarios.
 * Montar típicamente en: app.use('/api/users', require('./routes/users'));
 *
 * Responsabilidades:
 * - Definir rutas HTTP para CRUD de usuarios y sincronización desde Excel.
 * - Encadenar middlewares de autenticación/autorización y validación.
 * - Delegar la lógica real a UserController.
 */

const express = require('express');
const UserController = require('../controllers/userController');

// Middlewares de autenticación/autorización
const { verifyToken, requireAdmin, canModifyUser } = require('../middleware/auth');

// Middlewares de validación de payloads
const { validateUserRegistration, validateUserUpdate } = require('../middleware/validation');

const router = express.Router();

/**
 * @route   GET /api/users/profile
 * @desc    Obtener perfil del usuario autenticado
 * @access  Privado (cualquier usuario autenticado)
 * @middleware verifyToken -> valida JWT y añade req.user
 */
router.get('/profile', verifyToken, UserController.getProfile);

/**
 * @route   GET /api/users
 * @desc    Obtener lista de todos los usuarios
 * @access  Privado (solo Admin)
 * @middleware verifyToken -> asegura sesión válida
 * @middleware requireAdmin -> asegura que req.user.role === 'admin'
 */
router.get('/', verifyToken, requireAdmin, UserController.getAllUsers);

/**
 * @route   GET /api/users/:id
 * @desc    Obtener un usuario por su ID
 * @access  Privado (Admin o propietario del perfil)
 * @middleware verifyToken -> asegura sesión válida
 * @middleware canModifyUser -> permite al admin o al mismo usuario acceder
 */
router.get('/:id', verifyToken, canModifyUser, UserController.getUserById);

/**
 * @route   POST /api/users
 * @desc    Crear un nuevo usuario
 * @access  Privado (solo Admin)
 * @middleware verifyToken -> asegura sesión válida
 * @middleware requireAdmin -> solo admins pueden crear usuarios
 * @middleware validateUserRegistration -> valida/normaliza el body (email, password, nombres, etc.)
 */
router.post('/', verifyToken, requireAdmin, validateUserRegistration, UserController.createUser);

/**
 * @route   PUT /api/users/:id
 * @desc    Actualizar datos de un usuario
 * @access  Privado (Admin o propietario del perfil)
 * @middleware verifyToken -> asegura sesión válida
 * @middleware canModifyUser -> permite al admin o al mismo usuario actualizar
 * @middleware validateUserUpdate -> valida/limpia campos permitidos a actualizar
 */
router.put('/:id', verifyToken, canModifyUser, validateUserUpdate, UserController.updateUser);

/**
 * @route   POST /api/users/sync
 * @desc    Sincronizar usuarios desde el archivo Excel hacia la BD
 * @access  Privado (solo Admin)
 * @middleware verifyToken -> asegura sesión válida
 * @middleware requireAdmin -> solo admins pueden ejecutar la sincronización
 *
 * Nota: es recomendable proteger esta ruta contra llamadas abusivas (rate limit)
 * y ejecutar la sincronización en background o mediante job si el proceso es pesado.
 */
router.post('/sync', verifyToken, requireAdmin, UserController.syncUsersFromExcel);

module.exports = router;