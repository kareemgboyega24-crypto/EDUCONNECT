require('dotenv').config();
const sequelize = require('./db');

// One-time fix: models/User.js added three new columns (emailVerified,
// verificationCode, verificationCodeExpires), but Sequelize's sync() only creates
// brand-new tables - it does NOT add new columns to a table that already exists.
// This adds them directly via raw SQL. Safe to run more than once; skips any
// column that's already present. Does nothing on SQLite (a fresh local .sqlite
// file already has the new columns since it's typically recreated from scratch).

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
    { name: 'emailVerified', ddl: 'ADD [emailVerified] BIT NOT NULL DEFAULT 0' },
    { name: 'verificationCode', ddl: 'ADD [verificationCode] NVARCHAR(255) NULL' },
    { name: 'verificationCodeExpires', ddl: 'ADD [verificationCodeExpires] DATETIMEOFFSET NULL' }
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

  console.log('Done. The Users table now has all verification columns.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
