//config.js
//carga variables de entorno desde un archivo .env en la raiz del proyecto
const dotenv = require('dotenv');
dotenv.config(); // carga process.env con las variables definidas en .env

module.exports={
    //puerto en el que arranca la aplicacion
    port: process.env.PORT || 3000,

    //Entorno de ejecucion
    nodeENV: process.env.NODE_ENV || 'development',

    //Configuracion relacionada con JWT (tokens)
    jwt:{
        //SECRET para firmar los acces tokens
        secret: process.env.JWT_SECRET,

        //SECRET separado para firmar los refresh tokens
        refreshSecret: process.env.JWT_REFRESH_SECRET,

        //Tiempo de expiracion para acces tokens
        expiresIn: process.env.JWT_EXPIRES_IN || '15m',

        //Tiempo de expiracion para refresh tokens
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    },

    //Ruta al excel usado para sincronizacion/Carga inicial
    excel:{
        path: process.env.EXCEL_PATH || './data/users.xlsx'
    },

    //Parametros de seguridad y limitacion
    security:{
        //Maximo de intentos de Login fallidos antes de bloquear
        maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS,10) || 3,

        //Tiempo de bloqueo en minutos (se se exceden los intentos)
        lockoutTime: parseInt(process.env.LOCKOUT_TIME,10) || 15, //MINUTOS

        //Ventana de rate limit en minutos
        rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW, 10) || 15, //MINUTOS

        //Número maximo de requests por ventana para express-rate-limit
        rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS,10) || 5
    }
}