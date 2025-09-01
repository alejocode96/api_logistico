const fs = require('fs');
const path = require('path');

/**
 * Clase Logger para gestionar registros de la aplicación.
 * 
 * Esta clase permite registrar mensajes de distintos niveles 
 * (info, error, warn, debug) en archivos de log separados, 
 * además de mostrarlos en consola.
 */
class Logger {
  constructor() {
    /**
     * Directorio donde se almacenarán los logs.
     */
    this.logDir = path.join(__dirname, '../../logs');

    /**
     * Se asegura de que el directorio de logs exista,
     * creándolo si es necesario.
     */
    this.ensureLogDirectory();
  }
  
  /**
   * Verifica que el directorio de logs exista, y si no,
   * lo crea de manera recursiva.
   */
  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }
  
  /**
   * Da formato a un mensaje de log.
   * 
   * @param {string} level - Nivel del log (INFO, ERROR, WARN, DEBUG).
   * @param {string} message - Mensaje principal a registrar.
   * @param {object} [meta={}] - Información adicional opcional.
   * @returns {string} - Mensaje formateado en formato JSON.
   */
  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...meta
    };
    return JSON.stringify(logEntry) + '\n';
  }
  
  /**
   * Escribe un contenido en un archivo de log.
   * 
   * @param {string} filename - Nombre del archivo donde guardar.
   * @param {string} content - Contenido del log ya formateado.
   */
  writeToFile(filename, content) {
    const filePath = path.join(this.logDir, filename);
    fs.appendFileSync(filePath, content);
  }
  
  /**
   * Registra un mensaje de nivel INFO.
   * 
   * @param {string} message - Mensaje principal.
   * @param {object} [meta={}] - Información adicional opcional.
   */
  info(message, meta = {}) {
    const logMessage = this.formatMessage('INFO', message, meta);
    console.log(logMessage.trim());
    this.writeToFile('app.log', logMessage);
  }
  
  /**
   * Registra un mensaje de nivel ERROR.
   * 
   * @param {string} message - Mensaje principal.
   * @param {object} [meta={}] - Información adicional opcional.
   */
  error(message, meta = {}) {
    const logMessage = this.formatMessage('ERROR', message, meta);
    console.error(logMessage.trim());
    this.writeToFile('error.log', logMessage);
  }
  
  /**
   * Registra un mensaje de nivel WARN (advertencia).
   * 
   * @param {string} message - Mensaje principal.
   * @param {object} [meta={}] - Información adicional opcional.
   */
  warn(message, meta = {}) {
    const logMessage = this.formatMessage('WARN', message, meta);
    console.warn(logMessage.trim());
    this.writeToFile('app.log', logMessage);
  }
  
  /**
   * Registra un mensaje de nivel DEBUG (solo en entorno de desarrollo).
   * 
   * @param {string} message - Mensaje principal.
   * @param {object} [meta={}] - Información adicional opcional.
   */
  debug(message, meta = {}) {
    if (process.env.NODE_ENV === 'development') {
      const logMessage = this.formatMessage('DEBUG', message, meta);
      console.log(logMessage.trim());
      this.writeToFile('debug.log', logMessage);
    }
  }
}

/**
 * Se exporta una instancia única (singleton) de la clase Logger.
 */
module.exports = new Logger();
