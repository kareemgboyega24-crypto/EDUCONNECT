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
    type: DataTypes.STRING(20),
    allowNull: false
  },
  active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  avatarColor: {
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
    type: DataTypes.STRING,
    allowNull: true
  },
  resetCodeExpires: {
    type: DataTypes.DATE,
    allowNull: true
  },
  lastAnnouncementsViewedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  studentIdNumber: {
    // Named studentIdNumber (not studentId) to avoid confusion with the existing
    // studentId foreign key used throughout the app (Enrollment.studentId,
    // Assessment.studentId, etc.), which always refers to a User's primary key, not
    // an institution-issued ID number. Only meaningful when role is 'student';
    // null for lecturer/admin accounts.
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = User;
