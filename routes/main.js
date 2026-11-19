const express = require('express');
const path = require('path');
const controller = require('../controller/ordersctrl');
const { initiateStkPush } = require('../controller/stkPush');
const { getReceipt } = require('../controller/finalrecipt');
const fs = require('fs');

const {
  setPaymentStkDetails,
  updatePaymentByCheckoutRequest,
  getPaymentByCheckoutRequest
} = require('../models/payment');

const router = express.Router();

router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/pay.html'));
});

router.get('/api/details', async (req, res) => {
  try {
    const [shipping, order, payment] = await Promise.all([
      controller.shippingDetails(),
      controller.orderSummary(),
      controller.paymentDetails()
    ]);

    res.json({ shipping, order, payment });
  } catch (error) {
    res.status(500).json({ error: 'Could not load payment details' });
  }
});

router.post('/api/orders', async (req, res) => {
  try {
    const result = await controller.createOrder(req.body);
    res.status(201).json({ message: 'Order created', orderId: result.insertId });
  } catch (error) {
    console.error(error);
    const status = error.message.includes('valid') || error.message.includes('required') || error.message.includes('positive') ? 400 : 500;
    res.status(status).json({ error: error.message || 'Could not create order' });
  }
});

router.post('/api/payments', async (req, res) => {
  try {
    const result = await controller.createPayment(req.body);

    const stkResponse = await initiateStkPush({
      phoneNumber: req.body.phoneNumber,
      amount: req.body.amount,
      accountReference: 'Robert',
      transactionDesc: 'Payment order'
    });

    await setPaymentStkDetails(result.insertId, stkResponse);

    console.log('[Safaricom accepted STK Push request]', {
      paymentId: result.insertId,
      orderId: req.body.orderId,
      phoneNumber: req.body.phoneNumber,
      amount: req.body.amount,
      checkoutRequestId: stkResponse.CheckoutRequestID,
      merchantRequestId: stkResponse.MerchantRequestID,
      responseCode: stkResponse.ResponseCode,
      responseDescription: stkResponse.ResponseDescription
    });

    res.status(201).json({
      message: 'STK Push request accepted by Safaricom',
      paymentId: result.insertId,
      checkoutRequestId: stkResponse.CheckoutRequestID,
      merchantRequestId: stkResponse.MerchantRequestID
    });
  } catch (error) {
    console.error(error);
    const status = error.message.includes('required') || error.message.includes('configured') ? 400 : 500;
    res.status(status).json({ error: error.message || 'Could not initiate M-Pesa payment' });
  }
});

router.post('/api/mpesa/callback', async (req, res) => {
  try {
    console.log(`[Safaricom callback ${new Date().toISOString()}]`, JSON.stringify(req.body));

    const callback = req.body?.Body?.stkCallback;
    if (!callback) {
      console.warn('[Safaricom callback] Missing stkCallback payload');
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const metadata = {};
    const items = callback.CallbackMetadata?.Item || [];
    for (const item of items) metadata[item.Name] = item.Value;

    const status = callback.ResultCode === 0
      ? 'confirmed'
      : (callback.ResultCode === 1032 ? 'cancelled' : 'failed');

    await updatePaymentByCheckoutRequest(callback.CheckoutRequestID, {
      status,
      resultCode: callback.ResultCode,
      resultDescription: callback.ResultDesc,
      receipt: metadata.MpesaReceiptNumber
    });

    console.log('[Database payment update]', {
      checkoutRequestId: callback.CheckoutRequestID,
      status,
      resultCode: callback.ResultCode,
      resultDescription: callback.ResultDesc,
      mpesaReceipt: metadata.MpesaReceiptNumber || null
    });

    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('M-Pesa callback error:', error);
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
});

router.get('/api/mpesa/status/:checkoutRequestId', async (req, res) => {
  try {
    const payment = await getPaymentByCheckoutRequest(req.params.checkoutRequestId);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    console.log('[Payment status check]', {
      checkoutRequestId: req.params.checkoutRequestId,
      status: payment.status,
      resultCode: payment.result_code,
      resultDescription: payment.result_description,
      mpesaReceipt: payment.mpesa_receipt
    });

    res.json({
      status: payment.status,
      resultCode: payment.result_code,
      resultDescription: payment.result_description,
      mpesaReceipt: payment.mpesa_receipt
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not check payment status' });
  }
});

router.get('/receipt/:checkoutRequestId', async (req, res) => {
  try {
    const payment = await getReceipt(req.params.checkoutRequestId);
    let html = fs.readFileSync(path.join(__dirname, '../views/finalReciptpdf.html'), 'utf8');
    html = html.replace('<body>', `<body data-receipt='${JSON.stringify(payment).replace(/'/g, '&#39;')}'>`);
    res.send(html);
  } catch (error) {
    res.status(409).send(error.message);
  }
});

router.get('/invoice/:checkoutRequestId.pdf', async (req, res) => {
  try {
    const PDFDocument = require('pdfkit');
    const invoice = await getReceipt(req.params.checkoutRequestId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${req.params.checkoutRequestId}.pdf"`);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    doc.fontSize(22).fillColor('#c92f75').text('M-Pesa Payment Invoice', { align: 'center' });
    doc.moveDown();
    doc.fillColor('#54283d').fontSize(11);
    doc.text(`Invoice / Checkout ID: ${req.params.checkoutRequestId}`);
    doc.text(`M-Pesa Receipt: ${invoice.mpesa_receipt || 'Confirmed'}`);
    doc.text(`Payment Date: ${new Date(invoice.created_at).toLocaleString()}`);
    doc.moveDown();

    doc.fontSize(13).text('Order Details');
    doc.fontSize(11);
    doc.text(`Order ID: ${invoice.order_id}`);
    doc.text(`User ID: ${invoice.user_id}`);
    doc.text(`Product ID: ${invoice.product_id}`);
    doc.text(`Quantity: ${invoice.quantity}`);
    doc.moveDown();

    doc.fontSize(13).text('Shipping Details');
    doc.fontSize(11);
    doc.text(`Recipient: ${invoice.order_recipient_name || invoice.recipient_name || ''}`);
    doc.text(`Phone: ${invoice.order_shipping_phone || invoice.phone_number || ''}`);
    doc.text(`Location: ${invoice.order_shipping_location || invoice.shipping_location || ''}`);
    doc.moveDown();

    doc.fontSize(13).text('Payment Summary');
    doc.fontSize(11);
    doc.text(`Payment Method: ${invoice.payment_method}`);
    doc.text(`Paying Phone: ${invoice.phone_number || ''}`);
    doc.text('Status: CONFIRMED');
    doc.moveDown();
    doc.fontSize(16).fillColor('#c92f75').text(`Total: Ksh ${Number(invoice.amount).toFixed(2)}`, { align: 'right' });

    doc.end();
  } catch (error) {
    res.status(409).send(error.message);
  }
});

module.exports = router;