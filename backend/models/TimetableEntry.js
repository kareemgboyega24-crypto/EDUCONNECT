const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const TimetableEntry = sequelize.define('TimetableEntry', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  courseId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  dayOfWeek: {
    // 0 = Monday ... 6 = Sunday
    type: DataTypes.INTEGER,
    allowNull: false
  },
  startTime: {
    // "09:00"
    type: DataTypes.STRING,
    allowNull: false
  },
  endTime: {
    // "10:30"
    type: DataTypes.STRING,
    allowNull: false
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = TimetableEntry;
