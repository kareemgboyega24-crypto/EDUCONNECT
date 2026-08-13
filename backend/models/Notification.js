const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  type: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  message: {
    type: DataTypes.STRING,
    allowNull: false
  },
  link: {
    type: DataTypes.STRING,
    allowNull: true
  },
  read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  timestamps: true
});

module.exports = Notification;
