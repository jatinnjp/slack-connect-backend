const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const cors = require('cors');

// Load environment variables
dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log("✅ MongoDB connected");
}).catch((err) => {
  console.error("❌ MongoDB connection error:", err);
});

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Routes
const slackRoutes = require('./routes/slack');
app.use('/slack', slackRoutes);

// Cron scheduler
require('./cron/scheduler');

const PORT = process.env.PORT || 5000;
app.get('/', (req, res) => {
  res.send('Slack Connect Backend is running ✅');
});
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
