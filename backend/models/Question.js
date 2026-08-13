const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Question = sequelize.define('Question', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  assessmentId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  type: {
    // Plain string, not ENUM - same reasoning as Assessment.status and User.role:
    // avoids a SQL Server CHECK constraint that would need another migration if a
    // third question type is ever added. Validated at the application layer instead.
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'multiple_choice'
  },
  prompt: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  options: {
    // JSON array of strings, e.g. ["O(n)", "O(n log n)", "O(n^2)"] - only used when
    // type is 'multiple_choice'. Stored as text and parsed/stringified in the route
    // layer for portability between SQLite and SQL Server.
    type: DataTypes.TEXT,
    allowNull: true
  },
  correctOptionIndex: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  points: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  order: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  timestamps: true
});

module.exports = Question;
