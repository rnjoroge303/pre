const db = require('mysql2/promise');

const pool = db.createPool({
  host: 'localhost',
  user: 'root',
  password: 'mrRover@25',
  database: 'pay',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
}); 

module.exports = pool;