const { Sequelize } = require('sequelize');
const path = require('path');

// DB_DIALECT=mssql switches to Azure SQL Database using the AZURE_SQL_* env vars.
// Default (unset) stays on local SQLite for zero-config dev/testing.
let sequelize;

if (process.env.DB_DIALECT === 'mssql') {
  sequelize = new Sequelize(
    process.env.AZURE_SQL_DATABASE,
    process.env.AZURE_SQL_USER,
    process.env.AZURE_SQL_PASSWORD,
    {
      host: process.env.AZURE_SQL_SERVER,
      dialect: 'mssql',
      dialectOptions: {
        options: {
          encrypt: true,
          trustServerCertificate: false
        }
      },
      logging: false
    }
  );
} else {
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '..', 'educonnect.sqlite'),
    logging: false
  });
}

module.exports = sequelize;
