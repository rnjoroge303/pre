const db = require('mysql2/promise');

const pool = db.createPool({
  host: 'bmnc3a9flhw4fp51upag-mysql.services.clever-cloud.com',
  user: 'u4nck9h4umyrfk9r',
  password: 'yoOuw0b3AbnHYWKjJUl4',
  database: 'bmnc3a9flhw4fp51upag',
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0
}); 

module.exports = pool;