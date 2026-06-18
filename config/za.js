const axios = require('axios');

const headers = { 'Content-Type': 'application/json' };
if (process.env.ZA_API_KEY) {
  headers['Authorization'] = `Bearer ${process.env.ZA_API_KEY}`;
}

const zaClient = axios.create({
  baseURL: process.env.ZA_BASE_URL,
  headers,
  timeout: 10000
});

module.exports = zaClient;
