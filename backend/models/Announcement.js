const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Announcement = sequelize.define('Announcement', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  courseId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  authorId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  body: {
    type: DataTypes.TEXT,
    allowNull: false
  }
}, {
  timestamps: true
});

module.exports = Announcement;
