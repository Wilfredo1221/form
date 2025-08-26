// routes/brigadasRoutes.js - Rutas para Brigadas de Bomberos
const express = require('express');
const router = express.Router();

// Importar controladores
const {
    getAllBrigadas,
    getBrigadaById,
    createBrigada,
    updateBrigada,
    deleteBrigada,
    getEstadisticas,
    getEPPByBrigada,
    getHerramientasByBrigada,
    getMedicamentosByBrigada
} = require('../controllers/brigadas.Controller');

// Middleware para validar ID numérico
const validateNumericId = (req, res, next) => {
    const { id } = req.params;
    if (id && isNaN(parseInt(id))) {
        return res.status(400).json({
            success: false,
            error: 'El ID debe ser un número válido'
        });
    }
    next();
};

// RUTAS PRINCIPALES

// GET - Obtener estadísticas generales (debe ir antes que /brigadas/:id)
router.get('/estadisticas', getEstadisticas);

// GET - Obtener todas las brigadas
router.get('/brigadas', getAllBrigadas);

// GET - Obtener información completa de una brigada específica
router.get('/brigadas/:id', validateNumericId, getBrigadaById);

// POST - Crear nueva brigada
router.post('/brigadas', createBrigada);

// PUT - Actualizar brigada existente
router.put('/brigadas/:id', validateNumericId, updateBrigada);

// DELETE - Eliminar brigada (soft delete)
router.delete('/brigadas/:id', validateNumericId, deleteBrigada);

// RUTAS ESPECÍFICAS DE EQUIPAMIENTO

// GET - Obtener solo equipamiento EPP de una brigada
router.get('/brigadas/:id/epp', validateNumericId, getEPPByBrigada);

// GET - Obtener solo herramientas de una brigada
router.get('/brigadas/:id/herramientas', validateNumericId, getHerramientasByBrigada);

// GET - Obtener solo medicamentos de una brigada
router.get('/brigadas/:id/medicamentos', validateNumericId, getMedicamentosByBrigada);

module.exports = router;