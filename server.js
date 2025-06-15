const express = require('express');
console.log('🚀 Server starting...');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('<h1>🎮 Bunker Game Server</h1><p>Server is running!</p>');
});

app.get('/health', (req, res) => {
    res.json({ status: 'OK' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
});