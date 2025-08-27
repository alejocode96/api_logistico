//importa el modulo sqlite3 con soporte de verbose para debug
const sqlite3 = require('sqlite3').verbose();

//Importa modulos para manejar rutas y sistema de archivos
const path = require('path');
const fs = require('fs');

//Importa la configuracion del proyecto (ruta de base de datos, etc)
const config = require('./config');

/** 
 * clase Database
 * Esta clase maneja la conexion a la base de datos SQLITE,
 * La creacion de tablas y la gestion de la conexion
*/

class Database{
    constructor(){
        //variable que almacenara la instancia de la base de datos
        this.db=null
    }

    /**
     * Inicializa la base de datos
     *  - cverifica que el directorio para la base de datos exista si no, la crea.
     *  - conecta a la base de dastos sqlite
     *  - crea tablas necesarias si no existen.
     */
    async init(){
        try{
            //Obtiene el directorio donde se almacenarala la base de datos
            const dataDir= path.dirname(config.database.path);

            //si el directorio no existe, lo crea de manera recursiva
            if(!fs.existsSync(dataDir)){
                fs.mkdirSync(dataDir, {recursive: true});
            }

            //crea una nueva instancia de la base de datos SQLite
            this.db= new sqlite3.Database(config.database.path);

            //llama a la funcion para crear tablas
            await this.createTables();

            console.log('Database initialized succesfully');
        }catch (error){
            console.error('Database initialization failed: ', error);
            throw error;
        }
    }

    /**
     * Crea las tablas necesarias en la base de datos
     * - users: tabla de usuarios
     * - refresh_tokens tabla de tokens de actualizacion (refresh tokens)
     * @returns {Promise<void>}
     */

    createTables(){
        return new Promise((resolve, reject)=>{
            //SQL para crear la tabla de usuarios
            const createUsersTable= `
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    first_name TEXT NOT NULL,
                    last_name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    role TEXT NOT NULL DEFAULT 'user',
                    status TEXT NOT NULL DEFAULT 'active',
                    login_attempts INTEGER DEFAULT 0,
                    locked_until DATETIME NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
             `;

             //SQL para crear la tabla de refresh tokens
             const createRefreshTokensTable= `
                CREATE TABLE IF NOT EXISTS refresh_tokens (
                   id INTEGER PRIMARY KEY AUTOINCREMENT,
                   token TEXT NOT NULL,
                   user_id INTEGER NOT NULL,
                   expires_at DATETIME NOT NULL,
                   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                   FOREIGN KEY (user_id) REFERENCES users (id)
                )
             `;

             //Ejecuta la creacion de la tabla de usuarios
             this.db.run(createUsersTable, (err) => {
                if(err){
                    reject(err); // si hay error, rechaza la promesa
                    return;
                }

                //Ejecuta la creacion de la tabla refresh tokens
                this.db.run(createRefreshTokensTable, (err)=>{
                    if(err){
                        reject(err); //si hay error, rechaza la promesa
                        return;
                    }
                    resolve(); // todo se creo correctamente
                });
             });
        });
    }

    /**
     * Obtine la instancia a la base de datos
     * @returns {sqlite3.Database}
     */

    getDb(){
        return this.db;
    }

    /**
     * Cierra la conexion a la base de datos
     */
    close(){
        if(this.db){
            this.db.close();
        }
    }
}

//Exporta una instancia unica de la clase Database
module.exports = new Database();
