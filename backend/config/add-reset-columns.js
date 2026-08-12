require('dotenv').config();
const sequelize = require('./db');

// One-time fix: models/User.js added two new columns (resetCode, resetCodeExpires)
// for the forgot-password flow. Same underlying reason as the earlier verification-
// columns migration: Sequelize's sync() only creates brand-new tables, it does NOT
// add new columns to a table that already exists. Safe to run more than once; skips
// any column already present. Does nothing on SQLite.

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

  const columns = [
    { name: 'resetCode', ddl: 'ADD [resetCode] NVARCHAR(255) NULL' },
    { name: 'resetCodeExpires', ddl: 'ADD [resetCodeExpires] DATETIMEOFFSET NULL' }
  ];

  for (const col of columns) {
    const exists = await columnExists('Users', col.name);
    if (exists) {
      console.log(`Column already exists: ${col.name} - skipping.`);
      continue;
    }
    console.log(`Adding column: ${col.name}`);
    await sequelize.query(`ALTER TABLE [Users] ${col.ddl};`);
  }

  console.log('Done. The Users table now has the reset-password columns.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
