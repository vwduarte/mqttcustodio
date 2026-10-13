const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');

// POST /login - Autenticação Real
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  // Busca no banco (Simulação da lógica)
  const user = await pool.query('SELECT * FROM usuarios WHERE nome = $1', [username]);
  
  if (user.rows.length > 0 && await bcrypt.compare(password, user.rows[0].senha)) {
    const token = jwt.sign({ id: user.rows[0].id }, process.env.JWT_SECRET, { expiresIn: '8h' });
    return res.json({ token, username });
  }
  res.status(401).json({ error: "Credenciais inválidas" });
});

// GET /dados - Retorna o último estado de cada sensor
router.get('/dados', auth, async (req, res) => {
  const result = await pool.query(`
    SELECT DISTINCT ON (cliente, topico) cliente, topico, valor 
    FROM dados ORDER BY cliente, topico, data DESC
  `);
  res.json(result.rows);
});

module.exports = router;