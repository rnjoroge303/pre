const pool = require('../db/db');

const initializePaymentsTable = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS payments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            order_id INT NOT NULL,
            amount DECIMAL(10, 2) NOT NULL,
            payment_method VARCHAR(50) NOT NULL,
            phone_number VARCHAR(30),
            shipping_phone VARCHAR(30),
            recipient_name VARCHAR(150),
            shipping_location VARCHAR(255),
            checkout_request_id VARCHAR(100),
            merchant_request_id VARCHAR(100),
            mpesa_receipt VARCHAR(100),
            status VARCHAR(30) DEFAULT 'pending',
            result_code INT,
            result_description VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES orders(id)
        )
    `);

    const [columns] = await pool.query('SHOW COLUMNS FROM payments');
    const names = new Set(columns.map((column) => column.Field));
    const migrations = {
        checkout_request_id: 'VARCHAR(100)',
        merchant_request_id: 'VARCHAR(100)',
        mpesa_receipt: 'VARCHAR(100)',
        status: "VARCHAR(30) DEFAULT 'pending'",
        result_code: 'INT',
        result_description: 'VARCHAR(255)'
    };

    for (const [name, definition] of Object.entries(migrations)) {
        if (!names.has(name)) {
            await pool.query(`ALTER TABLE payments ADD COLUMN ${name} ${definition}`);
        }
    }
};

initializePaymentsTable().catch((error) => {
    console.error('Error creating payments table:', error);
});

// Payment model functions
const createPayment = async (paymentInfo) => {
    await initializePaymentsTable();

    if (!paymentInfo.userId || !paymentInfo.orderId) {
        throw new Error('User ID and order ID are required');
    }

    if (!Number.isFinite(Number(paymentInfo.amount)) || Number(paymentInfo.amount) <= 0) {
        throw new Error('A valid payment amount is required');
    }

    const [result] = await pool.execute(
        `INSERT INTO payments (
            user_id,
            order_id,
            amount,
            payment_method,
            phone_number,
            shipping_phone,
            recipient_name,
            shipping_location,
            checkout_request_id,
            merchant_request_id,
            mpesa_receipt,
            status,
            result_code,
            result_description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            paymentInfo.userId ?? null,
            paymentInfo.orderId ?? null,
            paymentInfo.amount ?? null,
            paymentInfo.paymentMethod ?? 'M-pesa',
            paymentInfo.phoneNumber ?? null,
            paymentInfo.shippingPhone ?? null,
            paymentInfo.recipientName ?? null,
            paymentInfo.shippingLocation ?? null,
            paymentInfo.checkoutRequestId ?? null,
            paymentInfo.merchantRequestId ?? null,
            paymentInfo.mpesaReceipt ?? null,
            paymentInfo.status ?? 'pending',
            paymentInfo.resultCode ?? null,
            paymentInfo.resultDescription ?? null
        ]
    );
    return result;
};

const getPayment = async (paymentId) => {
    const [rows] = await pool.execute('SELECT * FROM payments WHERE id = ?', [paymentId]);
    return rows[0];
};

const setPaymentStkDetails = async (paymentId, details) => {
    await pool.execute(
        `UPDATE payments
         SET checkout_request_id = ?, merchant_request_id = ?, status = 'pending'
         WHERE id = ?`,
        [details.CheckoutRequestID ?? null, details.MerchantRequestID ?? null, paymentId]
    );
};

const updatePaymentByCheckoutRequest = async (checkoutRequestId, updates) => {
    await pool.execute(
        `UPDATE payments
         SET status = ?, result_code = ?, result_description = ?, mpesa_receipt = ?
         WHERE checkout_request_id = ?`,
        [updates.status ?? 'pending', updates.resultCode ?? null, updates.resultDescription ?? null, updates.receipt ?? null, checkoutRequestId]
    );
};

const getPaymentByCheckoutRequest = async (checkoutRequestId) => {
    const [rows] = await pool.execute(
        'SELECT * FROM payments WHERE checkout_request_id = ?',
        [checkoutRequestId]
    );
    return rows[0];
};

const getConfirmedInvoiceByCheckoutRequest = async (checkoutRequestId) => {
    const [rows] = await pool.execute(
        `SELECT p.*, o.product_id, o.quantity, o.total_price,
                o.recipient_name AS order_recipient_name,
                o.shipping_phone AS order_shipping_phone,
                o.shipping_location AS order_shipping_location
         FROM payments p
         JOIN orders o ON o.id = p.order_id
         WHERE p.checkout_request_id = ? AND p.status = 'confirmed'`,
        [checkoutRequestId]
    );
    return rows[0];
};

module.exports = {
    createPayment,
    getPayment,
    setPaymentStkDetails,
    updatePaymentByCheckoutRequest,
    getPaymentByCheckoutRequest,
    getConfirmedInvoiceByCheckoutRequest
};