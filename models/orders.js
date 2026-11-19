const pool = require('../db/db');

// Create the orders table and add shipping columns to existing installations.
const initializeOrdersTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      product_id INT NOT NULL,
      quantity INT NOT NULL,
      total_price DECIMAL(10, 2) NOT NULL,
      recipient_name VARCHAR(150),
      shipping_phone VARCHAR(30),
      shipping_location VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [columns] = await pool.query('SHOW COLUMNS FROM orders');
  const columnNames = new Set(columns.map((column) => column.Field));

  if (!columnNames.has('recipient_name')) {
    await pool.query('ALTER TABLE orders ADD COLUMN recipient_name VARCHAR(150)');
  }
  if (!columnNames.has('shipping_phone')) {
    await pool.query('ALTER TABLE orders ADD COLUMN shipping_phone VARCHAR(30)');
  }
  if (!columnNames.has('shipping_location')) {
    await pool.query('ALTER TABLE orders ADD COLUMN shipping_location VARCHAR(255)');
  }
};

initializeOrdersTable().catch((error) => {
  console.error('Error creating orders table:', error);
});

const createOrder = async (orderData) => {
  const {
    user_id,
    product_id,
    quantity,
    total_price,
    recipient_name,
    shipping_phone,
    shipping_location
  } = orderData;

  if (!Number.isInteger(Number(user_id)) || Number(user_id) <= 0) {
    throw new Error('A valid user_id is required');
  }

  if (!Number.isInteger(Number(product_id)) || Number(product_id) <= 0) {
    throw new Error('A valid product_id is required');
  }

  if (!Number.isInteger(Number(quantity)) || Number(quantity) <= 0) {
    throw new Error('Quantity must be a positive integer');
  }

  if (!Number.isFinite(Number(total_price)) || Number(total_price) <= 0) {
    throw new Error('Total price must be a positive number');
  }

  await initializeOrdersTable();

  const [result] = await pool.execute(
    `
      INSERT INTO orders (
        user_id,
        product_id,
        quantity,
        total_price,
        recipient_name,
        shipping_phone,
        shipping_location
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      Number(user_id),
      Number(product_id),
      Number(quantity),
      Number(total_price),
      recipient_name,
      shipping_phone,
      shipping_location
    ]
  );

  return result;
};

module.exports = { createOrder };