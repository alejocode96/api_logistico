const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config/config');

/**
 * Middleware: verifica el token JWT enviado en Authorization header.
 * - Extrae el token (espera "Authorization: Bearer <token>")
 * - Lo valida con jwt.verify usando el secret configurado
 * - Si es válido, pone el payload en req.user y llama next()
 * - Si falta o es inválido, responde 401
 */

const verifyToken = (req, res, next) => {
    //Extraer token del header Authorization (case-insensitive)
    const token = req.header('Authorization')?.replace('Bearer', '');

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Access denied. No token provided.'
        });
    }

    try {
        // Decodifica y verifica la firma del token
        const decoded = jwt.verify(token, config.jwt.secret);
        // Guardamos el payload decodificado para uso posterior en la request
        req.user = decoded;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token has expired. Please login again.'
            });
        }
        return res.status(401).json({
            success: false,
            message: 'Invalid token.',
            error: error.message
        });
    }
};

/**
 * Middleware: requiere que el usuario sea admin.
 * - Lee el id del usuario desde req.user (que debe haber puesto verifyToken)
 * - Recupera el usuario real desde la DB y verifica su rol
 * - Responde 404 si no existe, 403 si no es admin, 500 en errores del servidor
 */

const requireAdmin = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found.'
            });
        }

        if (user.status !== 'active') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. User is inactive.'
            });
        }

        if (user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin privileges required.'
            });
        }
        
        req.currentUser = user; //  Guardamos para evitar consultas adicionales
        next();
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

/**
 * Middleware: permite modificar usuario si:
 *  - el usuario actual es admin, o
 *  - el usuario actual es el mismo que el target (param id)
 *
 * - Recupera el usuario actual desde la DB para tener el rol/estado actualizado
 * - Si tiene permiso, pone req.currentUser = currentUser y llama next()
 * - Si no tiene permiso, responde 403; 404 si currentUser no existe
 */

const canModifyUser = async (req, res, next) => {
    try {
        const targetUserId = parseInt(req.params.id);
        const currentUser = await User.findById(req.user.id);

        if (!currentUser) {
            return res.status(404).json({
                success: false,
                message: 'Current user not found.'
            });
        }

        if (currentUser.status !== 'active') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. User is inactive.'
            });
        }

        // Admin puede modificar cualquiera; usuario puede modificar solo su propio id
        if (currentUser.role === 'admin' || currentUser.id === targetUserId) {
            req.currentUser = currentUser;
            next();
        } else {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You can only modify your own profile or need admin privileges.'
            });
        }
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

module.exports = {
    verifyToken,
    requireAdmin,
    canModifyUser
};