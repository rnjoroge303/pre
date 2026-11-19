const axios = require('axios');

let cachedToken;
let tokenExpiresAt = 0;

const getMpesaAccessToken = async () => {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const baseUrl = process.env.MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    throw new Error('M-Pesa consumer credentials are not configured');
  }

  const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const response = await axios.get(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` }
  });
  cachedToken = response.data.access_token;
  tokenExpiresAt = Date.now() + (Number(response.data.expires_in || 3600) - 60) * 1000;
  return cachedToken;
};

module.exports = { getMpesaAccessToken };