const axios = require('axios');
const { getMpesaAccessToken } = require('../middleware/authMpesa');

const formatPhoneNumber = (phone) => {
    let digits = String(phone ?? '').replace(/\D/g, '');
    if (digits.startsWith('0')) digits = `254${digits.slice(1)}`;
    if (digits.startsWith('7') || digits.startsWith('1')) digits = `254${digits}`;
    if (!/^254[17]\d{8}$/.test(digits)) {
        throw new Error('Enter a valid Safaricom mobile number');
    }
    return digits;
};

const getNairobiTimestamp = () => {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Nairobi',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${values.year}${values.month}${values.day}${values.hour}${values.minute}${values.second}`;
};

const initiateStkPush = async ({ phoneNumber, amount, accountReference, transactionDesc }) => {
    const baseUrl = process.env.MPESA_ENV === 'production'
        ? 'https://api.safaricom.co.ke'
        : 'https://sandbox.safaricom.co.ke';
    const shortCode = process.env.MPESA_SHORT_CODE;
    const tillNumber = process.env.MPESA_TILL_NUMBER;
    const passkey = process.env.MPESA_PASSKEY;
    const callbackUrl = process.env.MPESA_CALLBACK_URL;

    if (!shortCode || !passkey) {
        throw new Error('M-Pesa shortcode or passkey is not configured');
    }
    if (!/^\d+$/.test(shortCode)) {
        throw new Error('M-Pesa shortcode must contain digits only');
    }
    if (!tillNumber || !/^\d+$/.test(tillNumber)) {
        throw new Error('Configure a numeric MPESA_TILL_NUMBER for Buy Goods');
    }
    if (!callbackUrl) {
        throw new Error('M-Pesa callback URL is not configured');
    }

    const normalizedPhone = formatPhoneNumber(phoneNumber);
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        throw new Error('M-Pesa amount must be a positive number');
    }

    const reference = String(accountReference ?? '').trim();
    const description = String(transactionDesc || 'Payment').trim();
    if (!/^[A-Za-z0-9]{1,12}$/.test(reference)) {
        throw new Error('M-Pesa account reference must be 1 to 12 alphanumeric characters');
    }
    if (!description || description.length > 13) {
        throw new Error('M-Pesa transaction description must be 1 to 13 characters');
    }

    const timestamp = getNairobiTimestamp();
    const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64');
    const accessToken = await getMpesaAccessToken();

    try {
        const response = await axios.post(
            `${baseUrl}/mpesa/stkpush/v1/processrequest`,
            {
                BusinessShortCode: shortCode,
                Password: password,
                Timestamp: timestamp,
                TransactionType: 'CustomerBuyGoodsOnline',
                Amount: Math.round(numericAmount),
                PartyA: normalizedPhone,
                PartyB: tillNumber,
                PhoneNumber: normalizedPhone,
                CallBackURL: callbackUrl,
                AccountReference: reference,
                TransactionDesc: description
            },
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        return response.data;
    } catch (error) {
        const providerError = error.response?.data;
        if (providerError) {
            const message = providerError.errorMessage || providerError.ResponseDescription || 'Unknown Daraja error';
            const code = providerError.errorCode || providerError.ResponseCode;
            throw new Error(`STK Push failed: ${message}${code ? ` (Error Code: ${code})` : ''}`);
        }
        throw new Error(`STK Push failed: ${error.message}`);
    }
};

module.exports = { initiateStkPush, formatPhoneNumber };
