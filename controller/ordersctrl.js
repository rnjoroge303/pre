const { createOrder: createOrderRecord } = require('../models/orders');
const { createPayment: createPaymentRecord } = require('../models/payment');

const shippingDetails = async (shippingData = {}) => {
    return {
        'Recipient Name': shippingData.recipientName || shippingData.recipient_name || '',
        'Address': shippingData.location || shippingData.shippingLocation || shippingData.shipping_location || '',
        'Phone Number': shippingData.shippingPhone || shippingData.shipping_phone || ''
    };
};

const orderSummary = async (orderData = {}) => {
    return {
        'Order ID': orderData.orderId || null,
        'User ID': orderData.user_id,
        'Product ID': orderData.product_id,
        'Quantity': orderData.quantity,
        'Total Price': orderData.total_price,
        'Status': 'Processing'
    };
};

const paymentDetails = async (paymentData = {}) => {
    return {
        'Payment Method': paymentData.paymentMethod || paymentData.payment_method || 'M-pesa',
        'Phone Number': paymentData.phoneNumber || paymentData.phone_number || '',
        'Amount': paymentData.amount
    };
};

const createOrder = async (orderData) => {
    const normalized = {
        user_id: orderData.user_id,
        product_id: orderData.product_id,
        quantity: orderData.quantity,
        total_price: orderData.total_price,
        recipient_name: (orderData.recipient_name || orderData.recipientName || '').trim(),
        shipping_phone: (orderData.shipping_phone || orderData.shippingPhone || '').trim(),
        shipping_location: (orderData.shipping_location || orderData.shippingLocation || '').trim()
    };

    if (!normalized.recipient_name) throw new Error('Recipient name is required');
    if (!normalized.shipping_phone) throw new Error('Shipping phone is required');
    if (!normalized.shipping_location) throw new Error('Shipping location is required');

    return createOrderRecord(normalized);
};

const createPayment = async (paymentData) => {
    const normalized = {
        userId: paymentData.userId || paymentData.user_id,
        orderId: paymentData.orderId || paymentData.order_id,
        amount: paymentData.amount,
        paymentMethod: paymentData.paymentMethod || paymentData.payment_method || 'M-pesa',
        phoneNumber: (paymentData.phoneNumber || paymentData.phone_number || '').trim(),
        shippingPhone: (paymentData.shippingPhone || paymentData.shipping_phone || '').trim(),
        recipientName: (paymentData.recipientName || paymentData.recipient_name || '').trim(),
        shippingLocation: (paymentData.shippingLocation || paymentData.shipping_location || '').trim()
    };

    if (!normalized.phoneNumber) throw new Error('Paying phone number is required');
    if (!normalized.orderId) throw new Error('Order ID is required');

    return createPaymentRecord(normalized);
};

module.exports = {
    shippingDetails,
    orderSummary,
    paymentDetails,
    createOrder,
    createPayment
};
