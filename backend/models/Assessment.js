const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Assessment = sequelize.define('Assessment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  courseId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  studentId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  status: {
    // Plain string rather than ENUM: SQL Server bakes ENUM into a CHECK constraint
    // at table-creation time, which does NOT auto-update on an existing table when
    // new valid values are added later in code - this caused exactly that failure
    // when 'assigned' was introduced. A string with app-level validation avoids
    // ever needing a database migration again for future status values.
    type: DataTypes.STRING(30),
    defaultValue: 'submitted'
  },
  grade: {
    type: DataTypes.STRING,
    allowNull: true
  },
  feedbackSummary: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = Assessment;
