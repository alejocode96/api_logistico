const rateLimit = require('express-rate-limit');
const config = require('../config/config');

/**
 *  Rate limiter para intentos de login
 * 
 * Este middleware limita la cantidad de intentos de inicio de sesión
 * desde una misma IP en un período de tiempo específico, 
 * con el fin de prevenir ataques de fuerza bruta.
 */

const loginLimiter = rateLimit({
    // Duración de la ventana de tiempo (ejemplo: 15 minutos)
    windowMs: config.security.rateLimitWindow * 60 * 1000,
    // Número máximo de intentos permitidos en esa ventana
    max: config.security.rateLimitMaxRequests,

    //Mensaje devuelto cuando se excede el límite
    message: {
        success: false,
        message: 'Too many login attempts, please try again later.',
        retryAfter: config.security.rateLimitWindow * 60 // segundos
    },

    //Devuelve info de rate-limit en los headers estándar (RateLimit-*)
    standardHeaders: true,

    //No usar headers antiguos (X-RateLimit-*)
    legacyHeaders: false,

    //No contar los intentos exitosos de login (solo errores fallidos suman)
    skipSuccessfulRequests: true
});

/**
 * Rate limiter general para la API
 * 
 * Este middleware limita la cantidad de requests totales que 
 * un cliente puede hacer a la API en una ventana de tiempo,
 * protegiendo contra abuso o uso excesivo.
 */
const apiLimiter = rateLimit({
    // Ventana de tiempo: 15 minutos
    windowMs: 15 * 60 * 1000,

    //Número máximo de requests por IP en esa ventana
    max: 100,

    //Mensaje devuelto al exceder el límite
    message: {
        success: false,
        message: 'Too many requests, please try again later.'
    },

    //Devuelve info de rate-limit en los headers estándar
    standardHeaders: true,

    //No usar headers antiguos
    legacyHeaders: false
});

module.exports = {
    loginLimiter,
    apiLimiter
};
