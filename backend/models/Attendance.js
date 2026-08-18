const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// One row per person per call session. leftAt stays null while they're still
// connected; the server fills it in when they disconnect or explicitly leave.
const Attendance = sequelize.define('Attendance', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  courseId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  fullName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    // Plain string rather than ENUM - same reasoning as User.role elsewhere in this
    // project: a SQL Server CHECK constraint baked in at table-creation time would
    // reject any role value introduced later (e.g. renaming 'teacher' to 'lecturer').
    type: DataTypes.STRING(20),
    allowNull: false
  },
  joinedAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  leftAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = Attendance;
