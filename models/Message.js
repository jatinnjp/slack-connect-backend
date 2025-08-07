const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  userId: String,
  accessToken: String,
  refreshToken: String,
  channel: String,
  text: String,
  sendAt: Date,
  status: { type: String, default: 'scheduled' } // or 'sent'
});

module.exports = mongoose.model('Message', messageSchema);
