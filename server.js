/**
 * index.js — Punto de entrada del servidor
 *
 * - Crea y configura la instancia de la aplicación (App).
 * - Ejecuta la inicialización necesaria (BD, sincronizaciones, etc.).
 * - Arranca el servidor HTTP y expone endpoints.
 * - Gestiona apagado ordenado (graceful shutdown) y errores globales.
 *
 */

const config = require('./src/config/config');
const App = require('./src/app');
const logger = require('./src/utils/logger');
const Database =require('./src/config/database')
/**
 * startServer
 *
 * Función asincrónica que:
 * 1. Construye la aplicación (App).
 * 2. Inicializa recursos críticos (base de datos, usuarios, sincronizaciones).
 * 3. Arranca el servidor en el puerto configurado.
 * 4. Registra manejadores para shutdown ordenado y errores globales.
 */
async function startServer() {
  try {
    // Crear instancia de la aplicación (configura Express, middlewares, rutas, etc.)
    const appInstance = new App();

    // Inicializar recursos críticos antes de aceptar tráfico
    // (conexión a BD, creación de admin por defecto, sincronización desde Excel, etc.)
    await appInstance.initialize();

    // Obtener la instancia de Express para llamar a `listen`
    const app = appInstance.getApp();

    // Iniciar el servidor HTTP en el puerto configurado
    const server = app.listen(config.port, () => {
      // Registrar inicio exitoso en logs
      logger.info(`Server running on port ${config.port}`, {
        environment: config.nodeEnv,
        port: config.port
      });

      // Mensaje informativo en consola (útil en desarrollo / despliegues)
      console.log(`
        🚀 Server is running!
        📍 Port: ${config.port}
        🌍 Environment: ${config.nodeEnv}
        📚 API Documentation: http://localhost:${config.port}/api/health
        
        Available endpoints:
        - POST /api/auth/login
        - POST /api/auth/refresh  
        - POST /api/auth/logout
        - GET /api/users/profile
        - GET /api/users (Admin only)
        - POST /api/users (Admin only)
        - PUT /api/users/:id
        - POST /api/users/sync (Admin only)
      `);
    });

    /**
     * gracefulShutdown
     *
     * - Recibe la señal que inició el apagado ('SIGTERM'/'SIGINT').
     * - Intenta cerrar el servidor HTTP (no acepta nuevas conexiones).
     * - Si ocurre un error al cerrar, lo registra y sale con código 1.
     * - En caso contrario sale con código 0.
     *
     * Nota: actualmente solo cierra el servidor. Si tienes conexiones a BD, colas
     * o workers, deberías cerrarlas también aquí antes de hacer process.exit.
     */
    const gracefulShutdown = (signal) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);

      // Cerrar la conexión a la base de datos primero
      try {
        Database.close();
        logger.info("Database connection closed successfully");
      } catch (err) {
        logger.error("Error closing database connection:", { error: err.message });
      }


      server.close((err) => {
        if (err) {
          logger.error('Error during server shutdown:', { error: err.message });
          // Código 1 indica fallo en el shutdown
          process.exit(1);
        }

        logger.info('Server closed successfully');
        // Código 0 indica salida exitosa
        process.exit(0);
      });
    };

    // Registrar señales de sistema para iniciar apagado ordenado
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Capturar excepciones no atrapadas (fatal)
    process.on('uncaughtException', (error) => {
      // Registrar detalle del error para diagnóstico
      logger.error('Uncaught Exception:', { error: error.message, stack: error.stack });
      // Terminar el proceso para dejar que el gestor de procesos lo reinicie
      process.exit(1);
    });

    // Capturar promesas rechazadas sin handler
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection:', { reason, promise });
      // También terminamos para evitar estado inconsistente
      process.exit(1);
    });

  } catch (error) {
    // Si la inicialización o el arranque fallan, registrarlo y salir con error
    logger.error('Failed to start server:', { error: error.message });
    process.exit(1);
  }
}

// Ejecutar arranque al importar/ejecutar este archivo
startServer();
