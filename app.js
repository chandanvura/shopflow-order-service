const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const client = require('prom-client');
const { connectRabbitMQ } = require('./src/messaging/publisher');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3004;

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestCounter = new client.Counter({
  name: 'order_service_requests_total',
  help: 'Total requests to order service',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
});

app.use(helmet());
app.use(cors());
app.use(express.json());

// Internal route — no auth (called by payment service)
const { updateOrderStatus } = require('./src/controllers/orderController');
app.put('/internal/orders/:id/status', updateOrderStatus);

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

connectRabbitMQ();

app.use('/api/orders', require('./src/routes/orders'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'order-service', timestamp: new Date().toISOString() });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.listen(PORT, () => {
  console.log(`Order Service running on port ${PORT}`);
});