const axios = require('axios');
const { getMpesaAccessToken } = require('../middleware/authMpesa');

const formatPhoneNumber = (phone) => {
    let digits = String(phone).replace(/\D/g, '');
    if (digits.startsWith('0')) digits = `254${digits.slice(1)}`;
    if (digits.startsWith('7') || digits.startsWith('1')) digits = `254${digits}`;
    return digits;
};

const initiateStkPush = async ({ phoneNumber, amount, accountReference, transactionDesc }) => {
    const accessToken = await getMpesaAccessToken();
    const baseUrl = process.env.MPESA_ENV === 'production'
        ? 'https://api.safaricom.co.ke'
        : 'https://sandbox.safaricom.co.ke';

    const shortCode = process.env.MPESA_SHORT_CODE;
    const passkey = process.env.MPESA_PASSKEY;
    const callbackUrl = process.env.MPESA_CALLBACK_URL;

    if (!shortCode || !passkey) {
        throw new Error('M-Pesa shortcode or passkey is not configured');
    }

    if (!callbackUrl) {
        throw new Error('M-Pesa callback URL is not configured');
    }

    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64');
    let response;
    try {
        response = await axios.post(
            `${baseUrl}/mpesa/stkpush/v1/processrequest`,
            {
                BusinessShortCode: shortCode,
                Password: password,
                Timestamp: timestamp,
                TransactionType: 'CustomerPayBillOnline',
                Amount: Math.round(Number(amount)),
                PartyA: formatPhoneNumber(phoneNumber),
                PartyB: shortCode,
                PhoneNumber: formatPhoneNumber(phoneNumber),
                CallBackURL: callbackUrl,
                AccountReference: accountReference,
                TransactionDesc: transactionDesc || 'Payment'
            },
            { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        if (error.response && error.response.data) {
            const { errorCode, errorMessage } = error.response.data;
            throw new Error(`STK Push failed: ${errorMessage} (Error Code: ${errorCode})`);
        } else {
            throw new Error('STK Push failed: ' + error.message);
        }
    }

    return response.data;
};

module.exports = { initiateStkPush, formatPhoneNumber };