/**
 * PsychThread — a psychology conversation with KAIZEN (V2, owner vision
 * 13 Sep 2026: the ChatGPT-style surface where the trader works on their mind).
 *
 * NEVER DELETABLE (owner decision D2): the memory is the reference — when a
 * pattern repeats months later, KAIZEN looks back and recognizes it. There
 * are no delete routes for threads or messages anywhere in the product.
 */
const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'kaizen'], required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const PsychThreadSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: { type: String, default: 'Conversation', trim: true, maxlength: 80 },
  imported: { type: Boolean, default: false }, // seeded from V1 Memory docs
  messages: [MessageSchema],
  lastMessageAt: { type: Date, default: Date.now },
  messageCount: { type: Number, default: 0 }
}, { timestamps: true });

PsychThreadSchema.index({ userId: 1, lastMessageAt: -1 });

module.exports = mongoose.model('PsychThread', PsychThreadSchema);
