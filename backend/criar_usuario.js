const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();
 
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});
 
async function criar(nome, senha) {
    // Gera o hash da senha (o "segredo" para o bcrypt funcionar)
    const salt = await bcrypt.genSalt(10);
    const senhaCripto = await bcrypt.hash(senha, salt);
 
    try {
        await pool.query('INSERT INTO usuarios (nome, senha) VALUES ($1, $2)', [nome, senhaCripto]);
        console.log(`✅ Usuário ${nome} criado com sucesso!`);
    } catch (err) {
        console.error("❌ Erro ao criar usuário:", err.message);
    } finally {
        pool.end();
    }
}
 
// Coloque aqui o nome e a senha que você deseja
criar('operacao', 'oper123');