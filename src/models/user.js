const bcrypt = require('bcryptjs');
const database = require('../config/database');
const config = require('../config/config');
const { param } = require('express-validator');

/**
 * Clase User
 * Representa un usuario de la aplicacion y contiene metodos estaticos y de instancia para CRUD y logica de autenticacion / bloqueo
 */

class User {
    /**
     * construye un objeto User a partir de uan fila de la base de datos.
     * @param {Object} data - Fila recuperada de la tabla users (snake_case)
     */

    constructor(data) {
        //Mapeo de columnas de la base de datos (Snake_Case) a propiedades cameLCase
        this.id = data.id;
        this.firstName = data.first_name;
        this.lastName = data.last_name;
        this.email = data.email;
        //NOTE: this.password debe ser el hash (no una contraseña en texto plano)
        this.password = data.password;
        this.role = data.role;
        this.status = data.status;
        this.loginAttempts = data.login_attempts || 0;
        this.lockedUntil = data.locked_until;
        this.createdAt = data.created_at;
        this.updatedAt = data.updated_at;

    }

    /**
   * Buscar usuario por email.
   * @param {string} email
   * @returns {Promise<User|null>}
   */
    static async findByEmail(email) {
        return new Promise((resolve, reject) => {
            const db = database.getDb();
            const query = 'SELECT * FROM users WHERE email = ?';

            db.get(query, [email], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(row ? new User(row) : null);
            });
        });
    }

    /**
    * Buscar usuario por id.
   * @param {number} id
   * @returns {Promise<User|null>}
   */
    static async findById(id) {
        return new Promise((resolve, reject) => {
            const db = database.getDb();
            const query = 'SELECT * FROM users WHERE id =?';

            db.get(query, [id], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(row ? new User(row) : null);
            });
        });
    }

    /**
   * Recuperar todos los usuarios (ordenados por creación descendente).
   * @returns {Promise<User[]>}
   */
    static async findAll() {
        return new Promise((resolve, reject) => {
            const db = database.getDb();
            const query = 'SELECT * FROM users ORDER BY created_at DESC';

            db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(rows.map(row => new User(row)));
            });
        });
    }


    /**
     * Crear un nuevo usuario (hash de contraseña incluido).
     * @param {Object} userData - { firstName, lastName, email, password, role?, status? }
     * @returns {Promise<number>} - retorna el id (lastID) del usuario creado
     */
    static async create(userData) {
        return new Promise(async (resolve, reject) => {
            try {
                const db = database.getDb();
                //Hashear la contraseña antes de persistirla
                const hashedPassword = await bcrypt.hash(userData.password, 12);

                const query = ` 
                    INSERT INTO users (first_name, last_name, email, password, role, status)
                    VALUES (?, ?, ?, ?, ?, ?)
                    `;

                const params = [
                    userData.firstName,
                    userData.lastName,
                    userData.email,
                    hashedPassword,
                    userData.role || 'user',
                    userData.status || 'active'
                ];

                //Nota: usar fucntion() para poder acceder a this.LastID
                db.run(query, params, function (err) {
                    if (err) {
                        reject(err);
                        return;
                    }

                    resolve(this.lastID);
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
   * Actualizar usuario (dinámico: solo actualiza los campos provistos).
   * @param {Object} updateData - propiedades a actualizar (firstName, lastName, email, password, role, status, loginAttempts, lockedUntil)
   * @returns {Promise<boolean>} - true si se actualizó >=1 fila
   */
    async update(updateData) {
        return new Promise(async (resolve, reject) => {
            try {
                const db = database.getDb();

                //construcion dinamica del set y los parametros
                const updateFields = [];
                const params = [];

                if (updateData.firstName !== undefined) {
                    updateFields.push('first_name = ?');
                    params.push(updateData.firstName);
                }

                if (updateData.lastName !== undefined) {
                    updateFields.push('last_name = ?');
                    params.push(updateData.lastName);
                }

                if (updateData.email !== undefined) {
                    updateFields.push('email = ?');
                    params.push(updateData.email);
                }

                if (updateData.password !== undefined) {
                    updateFields.push('password = ?');
                    params.push(await bcrypt.hash(updateData.password, 12));
                }

                if (updateData.role !== undefined) {
                    updateFields.push('role = ?');
                    params.push(updateData.role);
                }

                if (updateData.status !== undefined) {
                    updateFields.push('status = ?');
                    params.push(updateData.status);
                }

                if (updateData.loginAttempts !== undefined) {
                    updateFields.push('login_attempts = ?');
                    params.push(updateData.loginAttempts);
                }

                if (updateData.lockedUntil !== undefined) {
                    updateFields.push('locked_until = ?');
                    params.push(updateData.lockedUntil);
                }

                // Siempre actualizar updated_at
                updateFields.push('updated_at = CURRENT_TIMESTAMP');
                // El id va como último parámetro para la cláusula WHERE
                params.push(this.id);

                const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;

                db.run(query, params, function (err) {
                    if (err) {
                        reject(err);
                        return;
                    }

                    //this.changes es el numero de filas afectadas
                    resolve(this.changes > 0);
                });

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Verificar contraseña: compara password en texto plano con el hash almacenado.
     * @param {string} password
     * @returns {Promise<boolean>}
     */

    async verifyPassword(password) {
        return await bcrypt.compare(password, this.password);
    }

    /**
     * Indica si la cuenta está bloqueada actualmente.
     * @returns {boolean}
     */
    isLocked() {
        return this.lockedUntil && new Date() < new Date(this.lockedUntil);
    }

    /**
   * Incrementa intentos de login y bloquea si supera el máximo configurado.
   */
    async incrementLoginAttempts() {
        const attempts = this.loginAttempts + 1;
        let lockedUntil = null;

        if (attempts >= config.security.maxLoginAttempts) {
            // lockoutTime está en minutos; guardamos en formato ISO
            lockedUntil = new Date(Date.now() + (config.security.lockoutTime * 60 * 1000)).toISOString();
        }

        await this.update({
            loginAttempts: attempts,
            lockedUntil: lockedUntil
        });

        // Actualizamos el objeto en memoria
        this.loginAttempts = attempts;
        this.lockedUntil = lockedUntil;
    }

    /**
  * Resetear intentos de login (por ejemplo tras login exitoso).
  */
    async resetLoginAttempts() {
        await this.update({
            loginAttempts: 0,
            lockedUntil: null
        });

        this.loginAttempts = 0;
        this.lockedUntil = null;
    }

    /**
  * Convertir a JSON excluyendo la contraseña (útil para respuestas API).
  * @returns {Object}
  */
    toJSON() {
        const { password, ...userWithoutPassword } = this;
        return userWithoutPassword;
    }
}

module.exports = User;