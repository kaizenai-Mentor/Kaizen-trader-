const mongoose = require('mongoose');

const connectDB = async () => {
  // No URI (tests, offline boots) → skip the connection instead of crashing,
  // and fail queries instantly instead of buffering them for 10s each.
  if (!process.env.MONGODB_URI) {
    console.warn('MONGODB_URI not set — skipping DB connection');
    mongoose.set('bufferCommands', false);
    return;
  }
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;