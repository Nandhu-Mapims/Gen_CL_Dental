const Notification = require('../models/Notification');

// Get notifications for logged-in user
exports.getMyNotifications = async (req, res) => {
  try {
    const userId = req.user?.sub || req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const { unreadOnly, limit = 20 } = req.query;
    const filter = { user: userId };
    if (unreadOnly === 'true') {
      filter.isRead = false;
    }

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10));

    const unreadCount = await Notification.countDocuments({
      user: userId,
      isRead: false,
    });

    res.json({
      notifications,
      unreadCount,
    });
  } catch (err) {
    console.error('getMyNotifications error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Mark single notification as read
exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user?.sub || req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const { id } = req.params;
    const notification = await Notification.findOneAndUpdate(
      { _id: id, user: userId },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json(notification);
  } catch (err) {
    console.error('markAsRead error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Mark all notifications as read for current user
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user?.sub || req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const result = await Notification.updateMany(
      { user: userId, isRead: false },
      { isRead: true }
    );

    res.json({
      message: 'All notifications marked as read',
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    console.error('markAllAsRead error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

