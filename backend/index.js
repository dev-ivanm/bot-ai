const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // En producción restringir al dominio del frontend
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Monitor de peticiones para depuración
app.use((req, res, next) => {
    console.log(`[Backend] ${req.method} ${req.url}`);
    next();
});

// Endpoint de salud para verificar si el backend está vivo y actualizado
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date(), version: '1.0.4', sync: 'STAMP_DEPLOY_VERIFY_V2' });
});

// Inyectar io en el request para que las rutas lo usen
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Main Router
const { router: whatsappRouter, startPlanExpirationMonitor } = require('./routes/whatsapp');
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/webhook', require('./routes/webhook'));

// Iniciar monitores en segundo plano
startPlanExpirationMonitor();

io.on('connection', (socket) => {
    console.log(`[Socket] Nuevo cliente conectado: ${socket.id}`);
    socket.on('disconnect', () => {
        console.log(`[Socket] Cliente desconectado`);
    });
});

server.listen(PORT, () => {
    console.log(`[Backend] Server running on port ${PORT}`);
});
