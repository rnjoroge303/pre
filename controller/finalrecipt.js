const { getConfirmedInvoiceByCheckoutRequest } = require('../models/payment');

const getReceipt = async (checkoutRequestId) => {
    const invoice = await getConfirmedInvoiceByCheckoutRequest(checkoutRequestId);
    if (!invoice) throw new Error('Receipt not found or payment is not confirmed');
    return invoice;
};

module.exports = { getReceipt };