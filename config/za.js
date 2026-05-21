const axios = require('axios');

const zaClient = axios.create({
  baseURL: process.env.ZA_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.ZA_API_KEY}`
  },
  timeout: 10000
});

module.exports = zaClient;