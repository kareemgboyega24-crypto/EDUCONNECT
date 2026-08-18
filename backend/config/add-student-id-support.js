require('dotenv').config();
const sequelize = require('./db');

// One-time fix, same underlying reason as every other migration in this project:
// models/User.js added a new studentIdNumber column, but Sequelize's sync() only
// creates brand-new tables, it does NOT add new columns to a table that already
// exists. Safe to run more than once. Does nothing on SQLite.

async function columnExists(tableName, columnName) {
  const [rows] = await sequelize.query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = '${tableName}' AND COLUMN_NAME = '${columnName}';
  `);
  return rows.length > 0;
}

async function run() {
  if (sequelize.getDialect() !== 'mssql') {
    console.log(`Dialect is "${sequelize.getDialect()}", not mssql - nothing to fix. Exiting.`);
    process.exit(0);
  }

  const hasColumn = await columnExists('Users', 'studentIdNumber');
  if (hasColumn) {
    console.log('Column already exists: studentIdNumber - skipping.');
  } else {
    console.log('Adding column: studentIdNumber');
    await sequelize.query(`ALTER TABLE [Users] ADD [studentIdNumber] NVARCHAR(255) NULL;`);
  }

  console.log('Done. The Users table now supports student ID numbers.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
