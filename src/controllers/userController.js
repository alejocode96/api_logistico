const User = require('../models/User');
const excelService = require('../services/excelService');
const bcrypt = require('bcryptjs');

/**
 * UserController
 * Controlador responsable del CRUD de usuarios y de la sincronización con un archivo Excel.
 * 
 * Notas importantes:
 * - Este controlador usa el modelo `User` para interactuar con la base de datos.
 * - También mantiene un "espejo" de los usuarios en un archivo Excel mediante `excelService`.
 * - La contraseña se guarda hasheada en el Excel, pero aquí se asume que el modelo `User`
 *   gestiona el hashing al crear/actualizar en la BD (si no lo hace, deberías hashear antes de crear).
 */
class UserController {
    /**
   * Obtener todos los usuarios (solo Admin)
   * Método: GET /users
   * 
   * Flujo:
   * 1) Consulta todos los usuarios con `User.findAll()`.
   * 2) Serializa cada usuario con `toJSON()` y responde en formato JSON.
   */

    static async getAllUsers(req, res) {
        try {
            const users = await User.findAll();

            res.json({
                success: true,
                message: 'Users retrieved successfully',
                data: users.map(user => user.toJSON())
            });

        } catch (error) {
            console.error('Get users error:', error);
            res.status(500).json({
                success: false,
                message: 'Server error',
                error: error.message
            });
        }
    }

    /**
   * Obtener un usuario por ID
   * Método: GET /users/:id
   * 
   * Flujo:
   * 1) Toma el `id` de params.
   * 2) Busca el usuario con `User.findById()`.
   * 3) Si no existe, devuelve 404. Si existe, lo retorna serializado.
   */
    static async getUserById(req, res) {
        try {
            const { id } = req.params;
            const user = await User.findById(parseInt(id));

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            res.json({
                success: true,
                message: 'User retrieved successfully',
                data: user.toJSON()
            });

        } catch (error) {
            console.error('Get user error:', error);
            res.status(500).json({
                success: false,
                message: 'Server error',
                error: error.message
            });
        }
    }

    /**
   * Crear un nuevo usuario (solo Admin)
   * Método: POST /users
   * Body: { firstName, lastName, email, password, role?, status? }
   * 
   * Flujo:
   * 1) Verifica si ya existe un usuario con el email dado.
   * 2) Crea el usuario en la BD mediante `User.create(...)`.
   * 3) Recupera el usuario creado con `User.findById(...)`.
   * 4) Agrega el usuario al Excel con `excelService.addUserToExcel(...)`,
   *    hasheando la contraseña para el Excel.
   * 5) Responde 201 con el usuario creado.
   * 
   * Importante:
   * - Aquí se pasa `password` tal cual a `User.create`. Si tu modelo `User` NO hashea internamente,
   *   debes hashearla antes de crear. En el Excel sí se guarda hasheada.
   */
    static async createUser(req, res) {
        try {
            const { firstName, lastName, email, password, role, status } = req.body;

            // Verificar si el email ya está en uso
            const existingUser = await User.findByEmail(email);
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'User with this email already exists'
                });
            }

            // Crear usuario en la BD (se asume hashing en el modelo; si no, hashear aquí)
            const userId = await User.create({
                firstName,
                lastName,
                email,
                password,
                role: role || 'user',
                status: status || 'active'
            });

            // Obtener el usuario recién creado
            const newUser = await User.findById(userId);

            // Agregar usuario al archivo de Excel (contraseña hasheada para el Excel)
            const excelSuccess = await excelService.addUserToExcel({
                firstName,
                lastName,
                email,
                password: await bcrypt.hash(password, 12), // Guardar la contraseña hasheada en Excel
                role: role || 'user',
                status: status || 'active'
            });

            if (!excelSuccess) {
                // No detiene la respuesta; solo avisa en logs que falló la escritura en Excel
                console.warn('Failed to add user to Excel file');
            }

            res.status(201).json({
                success: true,
                message: 'User created successfully',
                data: newUser.toJSON()
            });

        } catch (error) {
            console.error('Create user error:', error);
            res.status(500).json({
                success: false,
                message: 'Server error',
                error: error.message
            });
        }
    }

    /**
  * Actualizar usuario por ID
  * Método: PUT /users/:id
  * Body: campos a actualizar (firstName, lastName, email, password, role, status, ...)
  * 
  * Reglas:
  * - Si cambia `email`, validar que el nuevo no exista en otro usuario.
  * - Solo un admin puede cambiar `role` y `status`.
  * - Si se cambia `password`, también se actualiza en el Excel pero hasheada.
  */
    static async updateUser(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;
            const currentUser = req.currentUser; // Usuario autenticado que hace la petición

            // Buscar el usuario objetivo
            const targetUser = await User.findById(parseInt(id));
            if (!targetUser) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Si se intenta cambiar el email, validar duplicidad
            if (updateData.email && updateData.email !== targetUser.email) {
                const existingUser = await User.findByEmail(updateData.email);
                if (existingUser) {
                    return res.status(400).json({
                        success: false,
                        message: 'User with this email already exists'
                    });
                }
            }

            // Si NO es admin y quiere cambiar el role, se ignora ese cambio
            if (updateData.role && currentUser.role !== 'admin') {
                delete updateData.role;
            }

            // Si NO es admin y quiere cambiar el status, se ignora ese cambio
            if (updateData.status && currentUser.role !== 'admin') {
                delete updateData.status;
            }

            // Actualizar en BD (se asume que el modelo maneja hashing si viene password)
            const success = await targetUser.update(updateData);

            if (!success) {
                return res.status(400).json({
                    success: false,
                    message: 'Failed to update user'
                });
            }

            // Actualizar en el Excel
            const excelData = { ...updateData };
            if (updateData.password) {
                // En el Excel siempre se guarda hasheada
                excelData.password = await bcrypt.hash(updateData.password, 12);
            }

            const excelSuccess = await excelService.updateUserInExcel(targetUser.email, excelData);

            if (!excelSuccess) {
                console.warn('Failed to update user in Excel file');
            }

            // Recuperar el usuario actualizado de la BD y responder
            const updatedUser = await User.findById(parseInt(id));

            res.json({
                success: true,
                message: 'User updated successfully',
                data: updatedUser.toJSON()
            });

        } catch (error) {
            console.error('Update user error:', error);
            res.status(500).json({
                success: false,
                message: 'Server error',
                error: error.message
            });
        }
    }

    /**
    * Obtener el perfil del usuario autenticado
    * Método: GET /users/me
    * 
    * Flujo:
    * 1) Usa `req.user.id` (inyectado por el middleware de auth) para consultar el usuario.
    * 2) Devuelve 404 si no existe; si existe, responde con los datos serializados.
    */
    static async getProfile(req, res) {
        try {
            const user = await User.findById(req.user.id);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            res.json({
                success: true,
                message: 'Profile retrieved successfully',
                data: user.toJSON()
            });

        } catch (error) {
            console.error('Get profile error:', error);
            res.status(500).json({
                success: false,
                message: 'Server error',
                error: error.message
            });
        }
    }

    /**
     * Sincronizar usuarios desde el archivo Excel hacia la BD
     * Método: POST /users/sync-excel
     * 
     * Flujo:
     * 1) Lee el listado de usuarios desde Excel (`excelService.readUsersFromExcel()`).
     * 2) Para cada usuario del Excel:
     *    - Si no existe en la BD y tiene `email` y `password`, lo crea en la BD.
     *    - Se asume que la `password` proveniente del Excel ya está hasheada.
     * 3) Devuelve el número de usuarios agregados y, si hubo, los errores individuales.
     */
    static async syncUsersFromExcel(req, res) {
        try {
            const excelUsers = excelService.readUsersFromExcel();
            let addedCount = 0;
            let errors = [];

            for (const excelUser of excelUsers) {
                try {
                    // Verificar si ya existe ese email en la BD
                    const existingUser = await User.findByEmail(excelUser.email);

                    if (!existingUser && excelUser.email && excelUser.password) {
                        // Crear usuario en BD (se asume que la password del Excel ya está hasheada)
                        await User.create({
                            firstName: excelUser.firstName,
                            lastName: excelUser.lastName,
                            email: excelUser.email,
                            password: excelUser.password, // Already hashed
                            role: excelUser.role || 'user',
                            status: excelUser.status || 'active'
                        });

                        addedCount++;
                    }
                } catch (userError) {
                    // Si falló la creación de este usuario, se acumula el error para reportarlo
                    errors.push({
                        email: excelUser.email,
                        error: userError.message
                    });
                }
            }

            res.json({
                success: true,
                message: `Sync completed. ${addedCount} users added.`,
                data: {
                    addedCount,
                    errors: errors.length > 0 ? errors : undefined
                }
            });

        } catch (error) {
            console.error('Sync users error:', error);
            res.status(500).json({
                success: false,
                message: 'Server error',
                error: error.message
            });
        }
    }
}

module.exports = UserController;