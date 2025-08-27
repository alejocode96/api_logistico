const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const config = require('../config/config')

/**
 * servicio para leer y escribir usuarios en un archivo Excel (.xlsx).
 * - Cea el archivo y la carpeta si no existen.
 * - Lee usuarios desde la primera hoja.
 * - Escribe/actualiza usuarios manteniendo el esquema esperado
 * 
 * NOTAS:
 * - Este servicio asume que el excel usa campos snake_Case (first_name, last_name)...
 * - Internamente convierte  entre snale_case (Excel) y camLCase (en memoria)
 * - Las fechas se manejan como ISO strings (createdAt /updatedAt) 
 */

class ExcelService {
    constructor() {
        //Ruta al Excel definida en config.excel.path 
        this.excelPath = config.excel.path;
    }

    /**
     * Asegura que exista la carpeta destino y el archivo de Excel
     * - Si no existe la carpeta, la crea (recursivo).
     * - Si no existe el archivo, crear un workbook con una hoja "Users" vacia.
     */
    ensureExcelFile() {
        const dir = path.dirname(this.excelPath);

        //Crea el directorio si no exixste
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        //crea el archivo Excel si no existe
        if (!fs.existsSync(this.excelPath)) {
            const workbook = xlsx.utils.book_new();

            // Inicializamos con headers vacíos
            const headers = [{
                id: "",
                first_name: "",
                last_name: "",
                email: "",
                password: "",
                role: "",
                status: "",
                login_attempts:"",
                locked_until:"",
                created_at: "",
                updated_at: ""
            }];

            //Hoja vacia
            const worksheet = xlsx.utils.json_to_sheet(headers, { skipHeader: false });
            xlsx.utils.book_append_sheet(workbook, worksheet, 'Users');
            xlsx.writeFile(workbook, this.excelPath)
        }
    }

    /**
     ** Lee usuarios desde el Excel (primera hoja).
        * @returns {Array<Object>} Lista de usuarios normalizados a camelCase.
        *
        * Mapea columnas del Excel:
        *  - first_name/firstName -> firstName
        *  - last_name/lastName   -> lastName
        *  - email                -> email
        *  - password             -> password (se asume previamente hasheada)
        *  - role/status          -> role/status (con defaults)
        *  - created_at/createdAt -> createdAt
        *  - updated_at/updatedAt -> updatedAt
     */

    readUsersFromExcel() {
        try {
            this.ensureExcelFile();

            const workbook = xlsx.readFile(this.excelPath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];

            // Convierte la hoja a objetos JS (una fila por usuario)
            const users = xlsx.utils.sheet_to_json(worksheet);

            // Normaliza a nuestro esquema en memoria (camelCase)
            return users.map(user => ({
                firstName: user.first_name || user.firstName,
                lastName: user.last_name || user.lastName,
                email: user.email,
                // Se asume que la contraseña ya viene hasheada en el Excel
                password: user.password,
                role: user.role || 'user',
                status: user.status || 'active',
                createdAt: user.created_at || user.createdAt,
                updatedAt: user.updated_at || user.updatedAt
            }));
        } catch (error) {
            console.error('Error reading Excel file:', error);
            return [];
        }
    }

    /**
   * Escribe la lista completa de usuarios al Excel (sobrescribe el archivo).
   * @param {Array<Object>} users - Usuarios en memoria (camelCase).
   * @returns {boolean} true si se pudo escribir, false si falló.
   *
   * Transformación a Excel (snake_case) antes de escribir:
   *  - firstName -> first_name
   *  - lastName  -> last_name
   *  - createdAt -> created_at
   *  - updatedAt -> updated_at
   */
    writeUsersToExcel(users) {
        try {
            this.ensureExcelFile();

            // Mapea a snake_case para almacenar en Excel
            const excelData = users.map(user => ({
                first_name: user.firstName,
                last_name: user.lastName,
                email: user.email,
                password: user.password,
                role: user.role,
                status: user.status,
                created_at: user.createdAt,
                updated_at: user.updatedAt
            }));

            const workbook = xlsx.utils.book_new();
            const worksheet = xlsx.utils.json_to_sheet(excelData);
            xlsx.utils.book_append_sheet(workbook, worksheet, 'Users');
            xlsx.writeFile(workbook, this.excelPath);

            return true;
        } catch (error) {
            console.error('Error writing to Excel file:', error);
            return false;
        }
    }

    /**
   * Agrega un usuario al Excel.
   * @param {Object} userData - Datos del usuario (camelCase). La contraseña debe venir hasheada.
   * @returns {Promise<boolean>} true si se escribió correctamente.
   */
    async addUserToExcel(userData) {
        try {
            const existingUsers = this.readUsersFromExcel();

            existingUsers.push({
                firstName: userData.firstName,
                lastName: userData.lastName,
                email: userData.email,
                // IMPORTANTE: Debe ser hash, no texto plano
                password: userData.password,
                role: userData.role,
                status: userData.status,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            return this.writeUsersToExcel(existingUsers);
        } catch (error) {
            console.error('Error adding user to Excel:', error);
            return false;
        }
    }

    /**
   * Actualiza un usuario en el Excel identificado por su correo.
   * @param {string} email - Email del usuario a actualizar.
   * @param {Object} updateData - Campos a actualizar (camelCase).
   * @returns {Promise<boolean>} true si se actualizó, false si no se encontró.
   */
    async updateUserInExcel(email, updateData) {
        try {
            const users = this.readUsersFromExcel();
            const userIndex = users.findIndex(user => user.email === email);

            if (userIndex === -1) {
                return false;
            }

            users[userIndex] = {
                ...users[userIndex],
                ...updateData,
                updatedAt: new Date().toISOString()
            };

            return this.writeUsersToExcel(users);
        } catch (error) {
            console.error('Error updating user in Excel:', error);
            return false;
        }
    }

}

module.exports = new ExcelService();