const amqp = require('amqplib');

let channel;
let connection;

const connectRabbitMQ = async () => {
  try {
    connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();

    // Create queues
    await channel.assertQueue('order.created', { durable: true });
    await channel.assertQueue('order.cancelled', { durable: true });

    console.log('RabbitMQ connected');
  } catch (error) {
    console.error('RabbitMQ connection failed:', error.message);
    // Retry after 5 seconds
    setTimeout(connectRabbitMQ, 5000);
  }
};

const publishMessage = async (queue, message) => {
  try {
    if (!channel) {
      console.log('RabbitMQ not connected, skipping publish');
      return;
    }
    channel.sendToQueue(
      queue,
      Buffer.from(JSON.stringify(message)),
      { persistent: true }
    );
    console.log(`Message published to queue: ${queue}`);
  } catch (error) {
    console.error('Publish error:', error.message);
  }
};

module.exports = { connectRabbitMQ, publishMessage };