const Order = require('../models/Order');
const { publishMessage } = require('../messaging/publisher');

// Place order
exports.createOrder = async (req, res) => {
  try {
    const { items, shippingAddress } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'No items in order' });
    }

    const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const order = await Order.create({
      userId: req.user.id,
      userEmail: req.user.email,
      items,
      totalAmount: Math.round(totalAmount * 100) / 100,
      shippingAddress
    });

    // Publish to RabbitMQ — Payment Service will consume this
    await publishMessage('order.created', {
      orderId: order._id.toString(),
      userId: order.userId,
      userEmail: order.userEmail,
      totalAmount: order.totalAmount,
      items: order.items,
      timestamp: new Date().toISOString()
    });

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      service: 'order-service',
      data: order
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get user orders
exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json({ success: true, count: orders.length, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get single order
exports.getOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user.id });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update order status (internal — called by payment service)
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, paymentStatus } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status, paymentStatus },
      { new: true }
    );
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Cancel order
exports.cancelOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user.id });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Can only cancel pending orders' });
    }

    order.status = 'cancelled';
    await order.save();

    await publishMessage('order.cancelled', {
      orderId: order._id.toString(),
      userId: order.userId,
      totalAmount: order.totalAmount
    });

    res.json({ success: true, message: 'Order cancelled', data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};