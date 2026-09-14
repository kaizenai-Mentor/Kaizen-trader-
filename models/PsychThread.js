/**
 * PsychThread — a coach conversation thread (V2).
 *
 * Two kinds share this store (one chat infrastructure, two lanes):
 *   kind 'psychology' — the mind room (spec §3.1)
 *   kind 'trading'    — the trades room, KAIZEN AI (spec §3.2)
 *
 * NEVER DELETABLE (owner decision D2): the memory is the reference — when a
 * pattern repeats months later, KAIZEN looks back and recognizes it. There
 * are no delete routes for threads or messages anywhere in the product.
 */
const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'kaizen'], required: true },
  text: { type: String, required: true },
  hasImage: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const PsychThreadSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  kind: { type: String, enum: ['psychology', 'trading'], default: 'psychology' },
  title: { type: String, default: 'Conversation', trim: true, maxlength: 80 },
  imported: { type: Boolean, default: false }, // seeded from V1 Memory docs
  messages: [MessageSchema],
  lastMessageAt: { type: Date, default: Date.now },
  messageCount: { type: Number, default: 0 }
}, { timestamps: true });

PsychThreadSchema.index({ userId: 1, kind: 1, lastMessageAt: -1 });

module.exports = mongoose.model('PsychThread', PsychThreadSchema);
