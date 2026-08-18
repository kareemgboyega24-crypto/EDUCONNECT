require('dotenv').config();
const sequelize = require('./db');

// One-time fix with two jobs:
// 1) Drops the CHECK constraint on Attendances.role, which was never touched by the
//    earlier admin-role migration (that one only fixed Users.role) - the exact same
//    class of problem, just discovered on a second table.
// 2) Renames every existing 'teacher' value to 'lecturer' on both the Users and
//    Attendances tables, so accounts and historical records created before this
//    rename keep working correctly rather than silently breaking role checks.
// Safe to run more than once. Does nothing on SQLite.

async function dropCheckConstraint(tableName, columnName) {
  const [rows] = await sequelize.query(`
    SELECT cc.name AS constraint_name
    FROM sys.check_constraints cc
    JOIN sys.columns col
      ON cc.parent_object_id = col.object_id AND cc.parent_column_id = col.column_id
    WHERE cc.parent_object_id = OBJECT_ID('${tableName}') AND col.name = '${columnName}';
  `);
  if (rows.length === 0) {
    console.log(`No CHECK constraint found on ${tableName}.${columnName} - already clean.`);
    return;
  }
  for (const row of rows) {
    console.log(`Dropping constraint: ${row.constraint_name}`);
    await sequelize.query(`ALTER TABLE [${tableName}] DROP CONSTRAINT [${row.constraint_name}];`);
  }
}

async function run() {
  if (sequelize.getDialect() !== 'mssql') {
    console.log(`Dialect is "${sequelize.getDialect()}", not mssql - nothing to fix. Exiting.`);
    process.exit(0);
  }

  await dropCheckConstraint('Attendances', 'role');

  const [userResult] = await sequelize.query(`UPDATE [Users] SET [role] = 'lecturer' WHERE [role] = 'teacher';`);
  console.log(`Updated Users rows: ${userResult.rowsAffected ?? 'done'}`);

  const [attResult] = await sequelize.query(`UPDATE [Attendances] SET [role] = 'lecturer' WHERE [role] = 'teacher';`);
  console.log(`Updated Attendances rows: ${attResult.rowsAffected ?? 'done'}`);

  console.log('Done. Every existing "teacher" role value is now "lecturer".');
  process.exit(0);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
