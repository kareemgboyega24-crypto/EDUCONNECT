const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Answer = sequelize.define('Answer', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  questionId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  selectedOptionIndex: {
    // Used for multiple_choice questions
    type: DataTypes.INTEGER,
    allowNull: true
  },
  textResponse: {
    // Used for short_answer questions
    type: DataTypes.TEXT,
    allowNull: true
  },
  isCorrect: {
    // Only meaningful for multiple_choice - computed automatically at submission time
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  pointsAwarded: {
    // Auto-filled for multiple_choice on submission; stays null for short_answer
    // until the teacher manually grades it.
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = Answer;
