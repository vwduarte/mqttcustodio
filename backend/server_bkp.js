const express = require('express');
const { Pool } = require('pg');
const mqtt = require('mqtt');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());
const path = require('path');
 
// 1. Torna os arquivos da pasta frontend acessíveis (CSS, JS, Imagens)
app.use(express.static(path.join(__dirname, '..', 'frontend')));
 
// 2. Rota principal: entrega o seu index.html quando acessar o domínio puro
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Configuração do Banco de Dados
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

console.log("--- MODO SEGURO ATIVADO: SISTEMA CETREL ---");

/* ---------------- 1. ROTA DE LOGIN (MODO SEGURO) ---------------- */
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    const userClean = username ? username.trim() : "";
    const passClean = password ? password.trim() : "";

    try {
        // Busca o usuário no banco
        const result = await pool.query('SELECT * FROM usuarios WHERE nome = $1', [userClean]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: "Usuário ou senha incorretos" });
        }

        const user = result.rows[0];

        // COMPARAÇÃO SEGURA: O servidor não sabe a senha, ele apenas compara hashes
        const senhaBate = await bcrypt.compare(passClean, user.senha.trim());

        if (senhaBate) {
            // Gera o Token JWT
            const token = jwt.sign(
                { id: user.id, nome: user.nome }, 
                process.env.JWT_SECRET, 
                { expiresIn: '8h' }
            );
            
            console.log(`✅ Login realizado: ${user.nome}`);
            return res.json({ token, username: user.nome });
        }

        // Se a senha não bater
        console.log(`❌ Tentativa inválida para usuário: ${userClean}`);
        res.status(401).json({ error: "Usuário ou senha incorretos" });

    } catch (err) {
        console.error("Erro no login:", err);
        res.status(500).json({ error: "Erro interno no servidor" });
    }
});

/* ---------------- 2. ROTA DE DADOS (PROTEGIDA) ---------------- */
app.get('/api/dados', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: "Acesso negado" });

    try {
        jwt.verify(token, process.env.JWT_SECRET);
        const result = await pool.query(`
            SELECT DISTINCT ON (cliente, topico) cliente, topico, valor, data 
            FROM dados 
            ORDER BY cliente, topico, data DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(403).json({ error: "Sessão expirada" });
    }
});

/* ---------------- 3. INTEGRAÇÃO MQTT ---------------- */
const mqttClient = mqtt.connect(process.env.MQTT_BROKER, {
    username: process.env.MQTT_USER,
    password: process.env.MQTT_PASSWORD
});

mqttClient.on('connect', () => {
    console.log("📡 MQTT: Conexão segura estabelecida.");
    mqttClient.subscribe('+/+');
});

mqttClient.on('message', async (topic, message) => {
    const parts = topic.split('/');
    if (parts.length >= 2) {
        try {
            await pool.query(
                'INSERT INTO dados (cliente, topico, valor) VALUES ($1, $2, $3)', 
                [parts[0], parts[1], message.toString()]
            );
        } catch (e) {
            console.error("Erro MQTT:", e.message);
        }
    }
});

/* ---------------- 4. START ---------------- */
const PORT = 8084;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 SERVIDOR RODANDO EM MODO SEGURO: https://custodiamqtt.cetrel.com.br:${PORT}`);
});