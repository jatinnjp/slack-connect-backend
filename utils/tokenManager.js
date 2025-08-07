const axios = require('axios');
const Message = require('../models/Message');
const dotenv = require('dotenv');
dotenv.config();

const CLIENT_ID = process.env.SLACK_CLIENT_ID;
const CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;

// ✅ Refresh Slack access token using refresh token
async function refreshAccessToken(userId) {
  const user = await Message.findOne({ userId });

  if (!user || !user.refreshToken) {
    throw new Error('Refresh token not found for user');
  }

  try {
    const response = await axios.post('https://slack.com/api/oauth.v2.access', null, {
      params: {
        grant_type: 'refresh_token',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: user.refreshToken
      }
    });

    const newAccessToken = response.data.access_token;

    // Save updated access token in DB
    user.accessToken = newAccessToken;
    await user.save();

    console.log(`🔁 Access token refreshed for user ${userId}`);
    return newAccessToken;
  } catch (error) {
    console.error('❌ Failed to refresh token:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  refreshAccessToken
};
