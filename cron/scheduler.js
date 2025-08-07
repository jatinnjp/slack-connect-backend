const cron = require('node-cron');
const axios = require('axios');
const Message = require('../models/Message');
const { refreshAccessToken } = require('../utils/tokenManager');

// Run every minute
cron.schedule('* * * * *', () => {
  (async () => {
    console.log('⏰ Checking for scheduled messages...');

    const now = new Date();

    try {
      const messages = await Message.find({
        sendAt: { $lte: now },
        status: 'scheduled'
      });

      for (const msg of messages) {
        try {
          // Try sending message with current token
          await axios.post('https://slack.com/api/chat.postMessage', {
            channel: msg.channel,
            text: msg.text
          }, {
            headers: {
              Authorization: `Bearer ${msg.accessToken}`,
              'Content-Type': 'application/json'
            }
          });

          msg.status = 'sent';
          await msg.save();
          console.log(`✅ Sent message to ${msg.channel}`);
        } catch (error) {
          if (error.response?.status === 401) {
            // Token expired — try refreshing
            try {
              const newToken = await refreshAccessToken(msg.userId);
              await axios.post('https://slack.com/api/chat.postMessage', {
                channel: msg.channel,
                text: msg.text
              }, {
                headers: {
                  Authorization: `Bearer ${newToken}`,
                  'Content-Type': 'application/json'
                }
              });

              msg.status = 'sent';
              msg.accessToken = newToken;
              await msg.save();
              console.log(`🔁 Retried and sent with refreshed token.`);
            } catch (refreshErr) {
              console.error(`❌ Token refresh failed for ${msg._id}`, refreshErr.message);
            }
          } else {
            console.error(`❌ Failed to send message ${msg._id}:`, error.message);
          }
        }
      }
    } catch (err) {
      console.error('❌ Error in scheduler:', err.message);
    }
  })();
});
