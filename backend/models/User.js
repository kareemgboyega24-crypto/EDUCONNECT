const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  fullName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: { isEmail: true }
  },
  passwordHash: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    // Plain string rather than ENUM: SQL Server bakes ENUM into a CHECK constraint
    // at table-creation time, which does NOT auto-update on an existing table when
    // a new valid role (e.g. 'admin') is introduced later - the same issue we hit
    // with Assessment.status. A string with app-level validation avoids ever
    // needing another database migration for a future role value.
    type: DataTypes.STRING(20),
    allowNull: false
  },
  active: {
    // Lets an admin suspend an account without deleting it (and its history).
    // A suspended user can no longer log in, but every record they created stays intact.
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  avatarColor: {
    // used purely for consistent UI avatar coloring, no upload needed
    type: DataTypes.STRING,
    defaultValue: '#5B6CFF'
  },
  emailVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  verificationCode: {
    type: DataTypes.STRING,
    allowNull: true
  },
  verificationCodeExpires: {
    type: DataTypes.DATE,
    allowNull: true
  },
  resetCode: {
    // Kept separate from verificationCode - a user resetting their password shouldn't
    // ever interfere with (or be blocked by) their original email-verification state.
    type: DataTypes.STRING,
    allowNull: true
  },
  resetCodeExpires: {
    type: DataTypes.DATE,
    allowNull: true
  },
  lastAnnouncementsViewedAt: {
    // Powers the notification bell: any announcement created after this timestamp
    // counts as "unread". Simpler than a per-announcement read-receipt table, and
    // sufficient since announcements are a broadcast feed, not individual messages.
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = User;
