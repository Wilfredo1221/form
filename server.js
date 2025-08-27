// server.js - Servidor Principal para Brigadas de Bomberos
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

// Importar configuración de base de datos, pool y el middleware de conexión
const { initializeDatabase, getPool, checkConnection } = require('./config/db');
const brigadasRoutes = require('./routes/brigada.Routes');

const app = express();
const port = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Middlewares globales
app.use(cors({
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('combined'));

// Ruta de salud básica (sin middleware de conexión)
app.get('/api/health', (req, res) => {
    let dbStatus;
    try {
        const pool = getPool();
        dbStatus = pool.connected ? 'Conectada' : 'Desconectada';
    } catch (error) {
        dbStatus = 'Error de conexión';
    }
    
    res.json({ 
        status: 'OK', 
        message: 'API de Brigadas de Bomberos funcionando correctamente',
        timestamp: new Date().toISOString(),
        database: dbStatus,
        version: '1.0.0'
    });
});

// Aplicar el middleware de verificación de conexión y luego las rutas
app.use('/api', checkConnection, brigadasRoutes);

// Middleware para manejar errores de validación JSON
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        console.error('❌ Error de sintaxis JSON:', err.message);
        return res.status(400).json({
            success: false,
            error: 'JSON inválido en el cuerpo de la petición',
            message: 'Por favor, verifica que el JSON esté bien formateado'
        });
    }
    next(err);
});

// Manejo de errores globales
app.use((err, req, res, next) => {
    console.error('❌ Error global:', err);
    res.status(500).json({ 
        success: false,
        error: 'Error interno del servidor',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Ha ocurrido un error inesperado'
    });
});

// Ruta para manejar rutas no encontradas
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Ruta no encontrada',
        message: `La ruta ${req.originalUrl} no existe`,
        availableRoutes: [
            'GET /api/health',
            'GET /api/brigadas',
            'GET /api/brigadas/:id',
            'POST /api/brigadas',
            'PUT /api/brigadas/:id',
            'DELETE /api/brigadas/:id',
            'GET /api/estadisticas',
            'GET /api/brigadas/:id/epp',
            'GET /api/brigadas/:id/herramientas',
            'GET /api/brigadas/:id/medicamentos'
        ]
    });
});

// Función para inicializar el servidor
async function startServer() {
    try {
        // Inicializar conexión a base de datos
        console.log('🔄 Inicializando conexión a base de datos...');
        await initializeDatabase();
        
        // Iniciar servidor HTTP
        app.listen(port, () => {
            console.log('🚀 =====================================');
            console.log(`🔥 Servidor corriendo en puerto ${port}`);
            console.log(`📚 API disponible en http://localhost:${port}/api`);
            console.log(`🏥 Health check: http://localhost:${port}/api/health`);
            console.log(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);
            console.log('🚀 =====================================');
        });
        
    } catch (error) {
        console.error('❌ Error iniciando servidor:', error);
        process.exit(1);
    }
}

// Manejo de cierre graceful del servidor
const gracefulShutdown = async (signal) => {
    console.log(`\n🛑 Recibida señal ${signal}. Cerrando servidor...`);
    try {
        const pool = getPool();
        if (pool && pool.connected) {
            await pool.close();
            console.log('✅ Conexión a base de datos cerrada');
        }
        console.log('✅ Servidor cerrado exitosamente');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error cerrando servidor:', error);
        process.exit(1);
    }
};

// Eventos de cierre
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
    console.error('❌ Error no capturado:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promise rechazada no manejada:', reason);
    console.error('Promise:', promise);
    process.exit(1);
});

// Inicializar el servidor
startServer().catch(console.error);

// Exportar la app para pruebas
module.exports = app;