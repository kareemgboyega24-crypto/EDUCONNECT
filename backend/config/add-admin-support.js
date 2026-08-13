require('dotenv').config();
const sequelize = require('./db');

// One-time fix, same underlying reason as previous migrations in this project:
// 1) models/User.js changed `role` from an ENUM to a plain string, so the 'admin'
//    role isn't rejected by a CHECK constraint baked in when the table was first
//    created (only 'teacher'/'student' were valid at that time).
// 2) models/User.js also added a new `active` column for account suspension.
// Sequelize's sync() only creates brand-new tables - it does not retroactively
// alter an existing table's constraints or add new columns. Safe to run more than
// once. Does nothing on SQLite.

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

  // 1) Drop the old role CHECK constraint, if it still exists
  const [rows] = await sequelize.query(`
    SELECT cc.name AS constraint_name
    FROM sys.check_constraints cc
    JOIN sys.columns col
      ON cc.parent_object_id = col.object_id AND cc.parent_column_id = col.column_id
    WHERE cc.parent_object_id = OBJECT_ID('Users') AND col.name = 'role';
  `);
  if (rows.length === 0) {
    console.log('No CHECK constraint found on Users.role - already clean.');
  } else {
    for (const row of rows) {
      console.log(`Dropping constraint: ${row.constraint_name}`);
      await sequelize.query(`ALTER TABLE [Users] DROP CONSTRAINT [${row.constraint_name}];`);
    }
  }

  // 2) Add the active column
  const hasActive = await columnExists('Users', 'active');
  if (hasActive) {
    console.log('Column already exists: active - skipping.');
  } else {
    console.log('Adding column: active');
    await sequelize.query(`ALTER TABLE [Users] ADD [active] BIT NOT NULL DEFAULT 1;`);
  }

  console.log('Done. The Users table now supports the admin role and account suspension.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
