const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  // User reference (polymorphic - can be Admin or Employee)
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'userModel'
  },
  userModel: {
    type: String,
    required: true,
    enum: ['Admin', 'Employee']
  },

  // Session timing
  loginTime: {
    type: Date,
    default: Date.now
  },
  logoutTime: {
    type: Date
  },
  lastActivityAt: {
    type: Date,
    default: Date.now
  },

  // Calculated duration in minutes
  sessionDuration: {
    type: Number,
    default: 0
  },

  // Session status
  isActive: {
    type: Boolean,
    default: true
  },

  // Security info (optional)
  ipAddress: {
    type: String,
    default: ''
  },
  userAgent: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
sessionSchema.index({ user: 1, userModel: 1 });
sessionSchema.index({ loginTime: -1 });
sessionSchema.index({ isActive: 1 });
sessionSchema.index({ user: 1, loginTime: -1 });

// Method to close session and calculate duration
sessionSchema.methods.closeSession = function() {
  this.logoutTime = new Date();
  this.isActive = false;
  
  // Calculate duration in minutes
  const durationMs = this.logoutTime - this.loginTime;
  this.sessionDuration = Math.round(durationMs / (1000 * 60));
  
  return this.save();
};

// Method to update last activity (for heartbeat)
sessionSchema.methods.updateActivity = function() {
  this.lastActivityAt = new Date();
  return this.save();
};

// Static method to get active session for a user
sessionSchema.statics.getActiveSession = function(userId, userModel) {
  return this.findOne({
    user: userId,
    userModel: userModel,
    isActive: true
  }).sort({ loginTime: -1 });
};

// Static method to close all active sessions for a user
sessionSchema.statics.closeAllSessions = async function(userId, userModel) {
  const activeSessions = await this.find({
    user: userId,
    userModel: userModel,
    isActive: true
  });

  const closePromises = activeSessions.map(session => session.closeSession());
  return Promise.all(closePromises);
};

// Static method to get session stats for a user within date range
sessionSchema.statics.getSessionStats = async function(userId, userModel, startDate, endDate) {
  const sessions = await this.find({
    user: userId,
    userModel: userModel,
    loginTime: { $gte: startDate, $lte: endDate }
  });

  const totalSessions = sessions.length;
  const totalDuration = sessions.reduce((sum, s) => sum + (s.sessionDuration || 0), 0);
  const avgDuration = totalSessions > 0 ? Math.round(totalDuration / totalSessions) : 0;

  return {
    totalSessions,
    totalDuration, // in minutes
    avgDuration,   // in minutes
    sessions: sessions.map(s => ({
      loginTime: s.loginTime,
      logoutTime: s.logoutTime,
      duration: s.sessionDuration,
      isActive: s.isActive
    }))
  };
};

module.exports = mongoose.model('Session', sessionSchema);
