// controllers/brigadasController.js - Controladores para Brigadas de Bomberos
const { getPool, sql } = require('../config/db');

// Función auxiliar para insertar arrays de equipos
const insertEquipmentArray = async (transaction, brigadeId, equipos, tableName, typeColumn) => {
    if (equipos && equipos.length > 0) {
        for (const equipo of equipos) {
            const request = transaction.request();
            request.input('brigadeId', sql.Int, brigadeId);
            request.input('tipo', sql.NVarChar, equipo.tipo || equipo.nombre);
            request.input('cantidad', sql.Int, equipo.cantidad || 0);
            request.input('observaciones', sql.NVarChar, equipo.observaciones || '');
            await request.query(`
                INSERT INTO ${tableName} (brigada_id, ${typeColumn}, cantidad, observaciones)
                VALUES (@brigadeId, @tipo, @cantidad, @observaciones)
            `);
        }
    }
};

// 1. Obtener todas las brigadas
const getAllBrigadas = async (req, res) => {
    try {
        const pool = getPool();
        const request = pool.request();
        const result = await request.query(`
            SELECT id, nombre_brigada, cantidad_bomberos_activos, 
                   contacto_celular_comandante, encargado_logistica,
                   contacto_celular_logistica, numero_emergencia_publico,
                   fecha_registro, activo
            FROM Brigadas 
            WHERE activo = 1
            ORDER BY nombre_brigada
        `);
        res.json({
            success: true,
            data: result.recordset,
            count: result.recordset.length
        });
    } catch (err) {
        console.error('Error obteniendo brigadas:', err);
        res.status(500).json({ 
            success: false,
            error: 'Error interno del servidor',
            message: err.message 
        });
    }
};

// 2. Obtener información completa de una brigada
const getBrigadaById = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = getPool();
        const request = pool.request();
        request.input('brigadeId', sql.Int, id);

        // Obtener datos básicos de la brigada
        const brigadeResult = await request.query(`
            SELECT * FROM Brigadas WHERE id = @brigadeId AND activo = 1
        `);

        if (brigadeResult.recordset.length === 0) {
            return res.status(404).json({ 
                success: false,
                error: 'Brigada no encontrada' 
            });
        }

        const brigade = brigadeResult.recordset[0];

        // Obtener todos los equipamientos relacionados
        const queries = {
            equipamientoEPP: 'SELECT * FROM EquipamientoEPP WHERE brigada_id = @brigadeId',
            botasForestales: 'SELECT * FROM BotasForestales WHERE brigada_id = @brigadeId',
            guantesCuero: 'SELECT * FROM GuantesCuero WHERE brigada_id = @brigadeId',
            equipamientoGeneral: 'SELECT * FROM EquipamientoGeneral WHERE brigada_id = @brigadeId',
            herramientas: 'SELECT * FROM Herramientas WHERE brigada_id = @brigadeId',
            logisticaVehiculos: 'SELECT * FROM LogisticaVehiculos WHERE brigada_id = @brigadeId',
            alimentacionBebidas: 'SELECT * FROM AlimentacionBebidas WHERE brigada_id = @brigadeId',
            logisticaCampo: 'SELECT * FROM LogisticaCampo WHERE brigada_id = @brigadeId',
            limpiezaPersonal: 'SELECT * FROM LimpiezaPersonal WHERE brigada_id = @brigadeId',
            limpiezaGeneral: 'SELECT * FROM LimpiezaGeneral WHERE brigada_id = @brigadeId',
            medicamentos: 'SELECT * FROM Medicamentos WHERE brigada_id = @brigadeId',
            rescateAnimal: 'SELECT * FROM RescateAnimal WHERE brigada_id = @brigadeId'
        };

        const equipmentData = {};
        
        for (const [key, query] of Object.entries(queries)) {
            const equipRequest = pool.request();
            equipRequest.input('brigadeId', sql.Int, id);
            const result = await equipRequest.query(query);
            equipmentData[key] = result.recordset;
        }

        res.json({
            success: true,
            data: {
                brigade,
                equipment: equipmentData
            }
        });

    } catch (err) {
        console.error('Error obteniendo brigada:', err);
        res.status(500).json({ 
            success: false,
            error: 'Error interno del servidor',
            message: err.message 
        });
    }
};

// 3. Crear nueva brigada
const createBrigada = async (req, res) => {
    const pool = getPool();
    const transaction = pool.transaction();
    
    try {
        await transaction.begin();
        
        const {
            // Datos básicos de la brigada
            nombreBrigada,
            cantidadBomberosActivos,
            contactoCelularComandante,
            encargadoLogistica,
            contactoCelularLogistica,
            numeroEmergenciaPublico,
            
            // Equipamiento EPP
            equipamientoEPP,
            
            // Botas forestales
            botasForestales,
            
            // Guantes de cuero
            guantesCuero,
            
            // Equipamiento general
            equipamientoGeneral,
            
            // Herramientas
            herramientas,
            
            // Logística de vehículos
            logisticaVehiculos,
            
            // Alimentación y bebidas
            alimentacionBebidas,
            
            // Logística y equipo de campo
            logisticaCampo,
            
            // Limpieza personal
            limpiezaPersonal,
            
            // Limpieza general
            limpiezaGeneral,
            
            // Medicamentos
            medicamentos,
            
            // Rescate animal
            rescateAnimal
        } = req.body;

        // Validar campos requeridos
        if (!nombreBrigada) {
            return res.status(400).json({
                success: false,
                error: 'El nombre de la brigada es requerido'
            });
        }

        // Insertar brigada principal
        const brigadeRequest = transaction.request();
        brigadeRequest.input('nombreBrigada', sql.NVarChar, nombreBrigada);
        brigadeRequest.input('cantidadBomberos', sql.Int, cantidadBomberosActivos || 0);
        brigadeRequest.input('contactoComandante', sql.NVarChar, contactoCelularComandante || '');
        brigadeRequest.input('encargadoLogistica', sql.NVarChar, encargadoLogistica || '');
        brigadeRequest.input('contactoLogistica', sql.NVarChar, contactoCelularLogistica || '');
        brigadeRequest.input('numeroEmergencia', sql.NVarChar, numeroEmergenciaPublico || '');

        const brigadeResult = await brigadeRequest.query(`
            INSERT INTO Brigadas (nombre_brigada, cantidad_bomberos_activos, 
                                contacto_celular_comandante, encargado_logistica,
                                contacto_celular_logistica, numero_emergencia_publico)
            OUTPUT INSERTED.id
            VALUES (@nombreBrigada, @cantidadBomberos, @contactoComandante, 
                   @encargadoLogistica, @contactoLogistica, @numeroEmergencia)
        `);

        const brigadeId = brigadeResult.recordset[0].id;

        // Insertar equipamiento EPP
        if (equipamientoEPP && equipamientoEPP.length > 0) {
            for (const equipo of equipamientoEPP) {
                const request = transaction.request();
                request.input('brigadeId', sql.Int, brigadeId);
                request.input('tipoEquipo', sql.NVarChar, equipo.tipo || '');
                request.input('cantidadXS', sql.Int, equipo.cantidadXS || 0);
                request.input('cantidadS', sql.Int, equipo.cantidadS || 0);
                request.input('cantidadM', sql.Int, equipo.cantidadM || 0);
                request.input('cantidadL', sql.Int, equipo.cantidadL || 0);
                request.input('cantidadXL', sql.Int, equipo.cantidadXL || 0);
                request.input('observaciones', sql.NVarChar, equipo.observaciones || '');

                await request.query(`
                    INSERT INTO EquipamientoEPP 
                    (brigada_id, tipo_equipo, cantidad_xs, cantidad_s, cantidad_m, 
                     cantidad_l, cantidad_xl, observaciones)
                    VALUES (@brigadeId, @tipoEquipo, @cantidadXS, @cantidadS, @cantidadM,
                           @cantidadL, @cantidadXL, @observaciones)
                `);
            }
        }

        // Insertar botas forestales
        if (botasForestales) {
            const request = transaction.request();
            request.input('brigadeId', sql.Int, brigadeId);
            request.input('talla37', sql.Int, botasForestales.talla37 || 0);
            request.input('talla38', sql.Int, botasForestales.talla38 || 0);
            request.input('talla39', sql.Int, botasForestales.talla39 || 0);
            request.input('talla40', sql.Int, botasForestales.talla40 || 0);
            request.input('talla41', sql.Int, botasForestales.talla41 || 0);
            request.input('talla42', sql.Int, botasForestales.talla42 || 0);
            request.input('talla43', sql.Int, botasForestales.talla43 || 0);
            request.input('otraTalla', sql.Int, botasForestales.otraTalla || 0);

            await request.query(`
                INSERT INTO BotasForestales 
                (brigada_id, talla_37, talla_38, talla_39, talla_40, 
                 talla_41, talla_42, talla_43, otra_talla)
                VALUES (@brigadeId, @talla37, @talla38, @talla39, @talla40,
                       @talla41, @talla42, @talla43, @otraTalla)
            `);
        }

        // Insertar guantes de cuero
        if (guantesCuero) {
            const request = transaction.request();
            request.input('brigadeId', sql.Int, brigadeId);
            request.input('tallaXS', sql.Int, guantesCuero.tallaXS || 0);
            request.input('tallaS', sql.Int, guantesCuero.tallaS || 0);
            request.input('tallaM', sql.Int, guantesCuero.tallaM || 0);
            request.input('tallaL', sql.Int, guantesCuero.tallaL || 0);
            request.input('tallaXL', sql.Int, guantesCuero.tallaXL || 0);
            request.input('tallaXXL', sql.Int, guantesCuero.tallaXXL || 0);
            request.input('otraTalla', sql.Int, guantesCuero.otraTalla || 0);

            await request.query(`
                INSERT INTO GuantesCuero 
                (brigada_id, talla_xs, talla_s, talla_m, talla_l, 
                 talla_xl, talla_xxl, otra_talla)
                VALUES (@brigadeId, @tallaXS, @tallaS, @tallaM, @tallaL,
                       @tallaXL, @tallaXXL, @otraTalla)
            `);
        }

        // Insertar los diferentes tipos de equipamiento
        await insertEquipmentArray(transaction, brigadeId, equipamientoGeneral, 'EquipamientoGeneral', 'tipo_equipo');
        await insertEquipmentArray(transaction, brigadeId, herramientas, 'Herramientas', 'tipo_herramienta');
        await insertEquipmentArray(transaction, brigadeId, alimentacionBebidas, 'AlimentacionBebidas', 'tipo_alimento');
        await insertEquipmentArray(transaction, brigadeId, logisticaCampo, 'LogisticaCampo', 'tipo_equipo');
        await insertEquipmentArray(transaction, brigadeId, limpiezaPersonal, 'LimpiezaPersonal', 'tipo_producto');
        await insertEquipmentArray(transaction, brigadeId, limpiezaGeneral, 'LimpiezaGeneral', 'tipo_producto');
        await insertEquipmentArray(transaction, brigadeId, medicamentos, 'Medicamentos', 'nombre_medicamento');
        await insertEquipmentArray(transaction, brigadeId, rescateAnimal, 'RescateAnimal', 'tipo_item');

        // Insertar logística de vehículos (con campos específicos)
        if (logisticaVehiculos && logisticaVehiculos.length > 0) {
            for (const item of logisticaVehiculos) {
                const request = transaction.request();
                request.input('brigadeId', sql.Int, brigadeId);
                request.input('tipoItem', sql.NVarChar, item.tipo || '');
                request.input('montoAprox', sql.Decimal, item.montoAproximado || 0);
                request.input('costo', sql.Decimal, item.costo || 0);
                request.input('observaciones', sql.NVarChar, item.observaciones || '');
                await request.query(`
                    INSERT INTO LogisticaVehiculos 
                    (brigada_id, tipo_item, monto_aproximado, costo, observaciones)
                    VALUES (@brigadeId, @tipoItem, @montoAprox, @costo, @observaciones)
                `);
            }
        }

        await transaction.commit();
        
        res.status(201).json({
            success: true,
            message: 'Brigada creada exitosamente',
            data: { brigadeId: brigadeId }
        });

    } catch (err) {
        await transaction.rollback();
        console.error('Error creando brigada:', err);
        res.status(500).json({ 
            success: false, 
            error: 'Error interno del servidor',
            message: err.message 
        });
    }
};

// 4. Actualizar brigada
const updateBrigada = async (req, res) => {
    const pool = getPool();
    const transaction = pool.transaction();
    
    try {
        const { id } = req.params;
        
        if (!id || isNaN(id)) {
            return res.status(400).json({
                success: false,
                error: 'ID de brigada inválido'
            });
        }

        await transaction.begin();

        const {
            nombreBrigada,
            cantidadBomberosActivos,
            contactoCelularComandante,
            encargadoLogistica,
            contactoCelularLogistica,
            numeroEmergenciaPublico
        } = req.body;

        const updateRequest = transaction.request();
        updateRequest.input('id', sql.Int, parseInt(id));
        updateRequest.input('nombreBrigada', sql.NVarChar, nombreBrigada || '');
        updateRequest.input('cantidadBomberos', sql.Int, cantidadBomberosActivos || 0);
        updateRequest.input('contactoComandante', sql.NVarChar, contactoCelularComandante || '');
        updateRequest.input('encargadoLogistica', sql.NVarChar, encargadoLogistica || '');
        updateRequest.input('contactoLogistica', sql.NVarChar, contactoCelularLogistica || '');
        updateRequest.input('numeroEmergencia', sql.NVarChar, numeroEmergenciaPublico || '');

        const result = await updateRequest.query(`
            UPDATE Brigadas 
            SET nombre_brigada = @nombreBrigada,
                cantidad_bomberos_activos = @cantidadBomberos,
                contacto_celular_comandante = @contactoComandante,
                encargado_logistica = @encargadoLogistica,
                contacto_celular_logistica = @contactoLogistica,
                numero_emergencia_publico = @numeroEmergencia
            WHERE id = @id AND activo = 1
        `);

        if (result.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(404).json({ 
                success: false, 
                error: 'Brigada no encontrada' 
            });
        }

        await transaction.commit();
        
        res.json({
            success: true,
            message: 'Brigada actualizada exitosamente'
        });

    } catch (err) {
        await transaction.rollback();
        console.error('Error actualizando brigada:', err);
        res.status(500).json({ 
            success: false, 
            error: 'Error interno del servidor',
            message: err.message 
        });
    }
};

// 5. Eliminar brigada (soft delete)
const deleteBrigada = async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!id || isNaN(id)) {
            return res.status(400).json({
                success: false,
                error: 'ID de brigada inválido'
            });
        }

        const pool = getPool();
        const request = pool.request();
        request.input('id', sql.Int, parseInt(id));

        const result = await request.query(`
            UPDATE Brigadas 
            SET activo = 0 
            WHERE id = @id
        `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Brigada no encontrada' 
            });
        }

        res.json({
            success: true,
            message: 'Brigada eliminada exitosamente'
        });

    } catch (err) {
        console.error('Error eliminando brigada:', err);
        res.status(500).json({ 
            success: false, 
            error: 'Error interno del servidor',
            message: err.message 
        });
    }
};

// 6. Obtener estadísticas generales
const getEstadisticas = async (req, res) => {
    try {
        const pool = getPool();
        const request = pool.request();
        
        const stats = await request.query(`
            SELECT 
                COUNT(*) as totalBrigadas,
                ISNULL(SUM(cantidad_bomberos_activos), 0) as totalBomberos,
                ISNULL(AVG(cantidad_bomberos_activos), 0) as promedioBomberosPorBrigada
            FROM Brigadas 
            WHERE activo = 1
        `);

        res.json({
            success: true,
            data: stats.recordset[0]
        });

    } catch (err) {
        console.error('Error obteniendo estadísticas:', err);
        res.status(500).json({ 
            success: false,
            error: 'Error interno del servidor',
            message: err.message 
        });
    }
};

// 7. Obtener solo equipamiento EPP de una brigada
const getEPPByBrigada = async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!id || isNaN(id)) {
            return res.status(400).json({
                success: false,
                error: 'ID de brigada inválido'
            });
        }

        const pool = getPool();
        const request = pool.request();
        request.input('brigadeId', sql.Int, parseInt(id));

        const result = await request.query(`
            SELECT * FROM EquipamientoEPP WHERE brigada_id = @brigadeId
        `);

        res.json({
            success: true,
            data: result.recordset
        });
    } catch (err) {
        console.error('Error obteniendo EPP:', err);
        res.status(500).json({ 
            success: false,
            error: 'Error interno del servidor',
            message: err.message 
        });
    }
};

// 8. Obtener solo herramientas de una brigada
const getHerramientasByBrigada = async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!id || isNaN(id)) {
            return res.status(400).json({
                success: false,
                error: 'ID de brigada inválido'
            });
        }

        const pool = getPool();
        const request = pool.request();
        request.input('brigadeId', sql.Int, parseInt(id));

        const result = await request.query(`
            SELECT * FROM Herramientas WHERE brigada_id = @brigadeId
        `);

        res.json({
            success: true,
            data: result.recordset
        });
    } catch (err) {
        console.error('Error obteniendo herramientas:', err);
        res.status(500).json({ 
            success: false,
            error: 'Error interno del servidor',
            message: err.message 
        });
    }
};

// 9. Obtener solo medicamentos de una brigada
const getMedicamentosByBrigada = async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!id || isNaN(id)) {
            return res.status(400).json({
                success: false,
                error: 'ID de brigada inválido'
            });
        }

        const pool = getPool();
        const request = pool.request();
        request.input('brigadeId', sql.Int, parseInt(id));

        const result = await request.query(`
            SELECT * FROM Medicamentos WHERE brigada_id = @brigadeId
        `);

        res.json({
            success: true,
            data: result.recordset
        });
    } catch (err) {
        console.error('Error obteniendo medicamentos:', err);
        res.status(500).json({ 
            success: false,
            error: 'Error interno del servidor',
            message: err.message 
        });
    }
};

module.exports = {
    getAllBrigadas,
    getBrigadaById,
    createBrigada,
    updateBrigada,
    deleteBrigada,
    getEstadisticas,
    getEPPByBrigada,
    getHerramientasByBrigada,
    getMedicamentosByBrigada
};