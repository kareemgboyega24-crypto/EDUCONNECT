const sequelize = require('../config/db');
const User = require('./User');
const Course = require('./Course');
const Enrollment = require('./Enrollment');
const TimetableEntry = require('./TimetableEntry');
const Assessment = require('./Assessment');
const Document = require('./Document');
const Comment = require('./Comment');
const Attendance = require('./Attendance');
const Question = require('./Question');
const Answer = require('./Answer');
const Announcement = require('./Announcement');
const Notification = require('./Notification');

const NO_CASCADE = { onDelete: 'NO ACTION', onUpdate: 'NO ACTION' };

User.hasMany(Course, { foreignKey: 'teacherId', as: 'coursesTaught', ...NO_CASCADE });
Course.belongsTo(User, { foreignKey: 'teacherId', as: 'teacher', ...NO_CASCADE });

Course.hasMany(Enrollment, { foreignKey: 'courseId', as: 'enrollments', ...NO_CASCADE });
Enrollment.belongsTo(Course, { foreignKey: 'courseId', ...NO_CASCADE });
User.hasMany(Enrollment, { foreignKey: 'studentId', as: 'enrollments', ...NO_CASCADE });
Enrollment.belongsTo(User, { foreignKey: 'studentId', as: 'student', ...NO_CASCADE });

Course.hasMany(TimetableEntry, { foreignKey: 'courseId', as: 'timetableEntries', ...NO_CASCADE });
TimetableEntry.belongsTo(Course, { foreignKey: 'courseId', ...NO_CASCADE });

Course.hasMany(Assessment, { foreignKey: 'courseId', as: 'assessments', ...NO_CASCADE });
Assessment.belongsTo(Course, { foreignKey: 'courseId', ...NO_CASCADE });
User.hasMany(Assessment, { foreignKey: 'studentId', as: 'assessments', ...NO_CASCADE });
Assessment.belongsTo(User, { foreignKey: 'studentId', as: 'student', ...NO_CASCADE });

Assessment.hasMany(Document, { foreignKey: 'assessmentId', as: 'documents', ...NO_CASCADE });
Document.belongsTo(Assessment, { foreignKey: 'assessmentId', ...NO_CASCADE });
Document.belongsTo(User, { foreignKey: 'uploadedById', as: 'uploadedBy', ...NO_CASCADE });

Assessment.hasMany(Comment, { foreignKey: 'assessmentId', as: 'comments', ...NO_CASCADE });
Comment.belongsTo(Assessment, { foreignKey: 'assessmentId', ...NO_CASCADE });
Comment.belongsTo(User, { foreignKey: 'authorId', as: 'author', ...NO_CASCADE });

Course.hasMany(Attendance, { foreignKey: 'courseId', as: 'attendanceRecords', ...NO_CASCADE });
Attendance.belongsTo(Course, { foreignKey: 'courseId', ...NO_CASCADE });

Assessment.hasMany(Question, { foreignKey: 'assessmentId', as: 'questions', ...NO_CASCADE });
Question.belongsTo(Assessment, { foreignKey: 'assessmentId', ...NO_CASCADE });

Question.hasOne(Answer, { foreignKey: 'questionId', as: 'answer', ...NO_CASCADE });
Answer.belongsTo(Question, { foreignKey: 'questionId', ...NO_CASCADE });

Course.hasMany(Announcement, { foreignKey: 'courseId', as: 'announcements', ...NO_CASCADE });
Announcement.belongsTo(Course, { foreignKey: 'courseId', ...NO_CASCADE });
Announcement.belongsTo(User, { foreignKey: 'authorId', as: 'author', ...NO_CASCADE });

User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications', ...NO_CASCADE });
Notification.belongsTo(User, { foreignKey: 'userId', ...NO_CASCADE });

async function initDb() {
  await sequelize.sync();
}

module.exports = {
  sequelize,
  initDb,
  User,
  Course,
  Enrollment,
  TimetableEntry,
  Assessment,
  Document,
  Comment,
  Attendance,
  Question,
  Answer,
  Announcement,
  Notification
};
