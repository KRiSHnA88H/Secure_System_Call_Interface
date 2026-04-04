const mongoose = require('mongoose');

const syscallLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  username: {
    type: String,
    required: true,
  },
  command: {
    type: String,
    required: true,
  },
  syscallType: {
    type: String,
    required: true,
  },
  output: {
    type: String,
    default: '',
  },
  error: {
    type: String,
    default: '',
  },
  exitCode: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['success', 'error', 'blocked'],
    default: 'success',
  },
  executionTime: {
    type: Number, // in milliseconds
    default: 0,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// Index for faster queries
syscallLogSchema.index({ user: 1, timestamp: -1 });
syscallLogSchema.index({ timestamp: -1 });

module.exports = mongoose.model('SyscallLog', syscallLogSchema);
