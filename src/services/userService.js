const User = require('../models/User');
const excelService = require('./excelService');

/**
 * Servicio encargado de la gestión de usuarios
 * e integración entre la base de datos (SQLite u otra)
 * y el archivo Excel que sirve como fuente de datos persistente.
 */
class UserService {
  /**
   * Inicializa los usuarios desde Excel al iniciar la aplicación.
   * 
   * - Lee los usuarios almacenados en el archivo Excel.
   * - Por cada usuario:
   *   - Verifica si ya existe en la base de datos (por su email).
   *   - Si no existe y tiene `email` y `password`, lo inserta en la DB.
   *   - Se asume que la contraseña ya está hasheada en el Excel.
   * 
   * @returns {number} processedCount - Número de usuarios creados en la base de datos.
   */
  static async initializeUsersFromExcel() {
    try {
      console.log('Initializing users from Excel...');
      
      // Leer usuarios desde Excel
      const excelUsers = excelService.readUsersFromExcel();
      let processedCount = 0;
      
      for (const excelUser of excelUsers) {
        try {
          // Verificar si ya existe por email
          const existingUser = await User.findByEmail(excelUser.email);
          
          if (!existingUser && excelUser.email && excelUser.password) {
            // Crear el usuario en DB (la password ya está hasheada en el Excel)
            await User.create({
              firstName: excelUser.firstName,
              lastName: excelUser.lastName,
              email: excelUser.email,
              password: excelUser.password,
              role: excelUser.role || 'user',
              status: excelUser.status || 'active'
            });
            
            processedCount++;
          }
        } catch (userError) {
          console.error(`Failed to create user ${excelUser.email}:`, userError.message);
        }
      }
      
      console.log(`Users initialization completed. ${processedCount} users processed.`);
      return processedCount;
      
    } catch (error) {
      console.error('Error initializing users from Excel:', error);
      throw error;
    }
  }
  
  /**
   * Crea un usuario administrador por defecto si la base de datos está vacía.
   * 
   * - Busca todos los usuarios en la base de datos.
   * - Si no existe ninguno, crea un administrador inicial con credenciales por defecto.
   * - Luego sincroniza también este usuario con el archivo Excel.
   * 
   * ⚠️ Nota: La contraseña definida aquí (`Admin123!`) debe ser hasheada
   * en el proceso de creación de usuario.
   * 
   * @returns {number|null} adminId - ID del administrador creado o `null` si ya existían usuarios.
   */
  static async createDefaultAdmin() {
    try {
      const users = await User.findAll();
      
      if (users.length === 0) {
        console.log('No users found. Creating default admin...');
        
        const defaultAdmin = {
          firstName: 'Admin',
          lastName: 'User',
          email: 'admin@example.com',
          password: 'Admin123!', // Será hasheada en el modelo
          role: 'admin',
          status: 'active'
        };
        
        // Crear el admin en la DB
        const adminId = await User.create(defaultAdmin);
        console.log(`Default admin created with ID: ${adminId}`);
        
        // Recuperar el usuario ya guardado (con la contraseña hasheada)
        const adminUser = await User.findById(adminId);

        // Guardar también en Excel
        await excelService.addUserToExcel({
          firstName: defaultAdmin.firstName,
          lastName: defaultAdmin.lastName,
          email: defaultAdmin.email,
          password: adminUser.password, // Guardar la versión hasheada
          role: defaultAdmin.role,
          status: defaultAdmin.status
        });
        
        return adminId;
      }
      
      return null;
    } catch (error) {
      console.error('Error creating default admin:', error);
      throw error;
    }
  }
}

module.exports = UserService;
