require('dotenv').config();
const sequelize = require('./db');

// One-time fix: the Assessment.status column was originally created as a Sequelize
// ENUM, which on SQL Server becomes a CHECK constraint baked in at table-creation
// time. Changing the model to a plain string (see models/Assessment.js) does NOT
// retroactively remove that constraint from an already-existing table - this script
// finds and drops it directly. Safe to run more than once; it's a no-op if the
// constraint is already gone. Does nothing on SQLite (no such constraint exists there).

async function run() {
  if (sequelize.getDialect() !== 'mssql') {
    console.log(`Dialect is "${sequelize.getDialect()}", not mssql - nothing to fix. Exiting.`);
    process.exit(0);
  }

  const [rows] = await sequelize.query(`
    SELECT cc.name AS constraint_name
    FROM sys.check_constraints cc
    JOIN sys.columns col
      ON cc.parent_object_id = col.object_id AND cc.parent_column_id = col.column_id
    WHERE cc.parent_object_id = OBJECT_ID('Assessments') AND col.name = 'status';
  `);

  if (rows.length === 0) {
    console.log('No CHECK constraint found on Assessments.status - already clean, nothing to do.');
    process.exit(0);
  }

  for (const row of rows) {
    console.log(`Dropping constraint: ${row.constraint_name}`);
    await sequelize.query(`ALTER TABLE [Assessments] DROP CONSTRAINT [${row.constraint_name}];`);
  }

  console.log('Done. The status column will now accept any string value (validated at the application layer).');
  process.exit(0);
}

run().catch((err) => {
  console.error('Fix script failed:', err);
  process.exit(1);
});
