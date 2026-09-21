const { Sequelize } = require('sequelize');

// Three modes, chosen by what's set in the environment:
// 1. DATABASE_URL present -> PostgreSQL (Render), using the full connection
//    string Render provides rather than separate host/user/password fields.
// 2. DB_DIALECT=mssql -> Azure SQL Database (the original Azure deployment,
//    kept working in case of ever moving back or running it locally against
//    Azure SQL again).
// 3. Neither set -> local SQLite file, zero-config for local development.
let sequelize;

if (process.env.DATABASE_URL) {
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    dialectOptions: {
      // Render's managed Postgres requires SSL for external connections.
      // rejectUnauthorized: false is standard for Render's own cert setup -
      // it's presenting a valid cert, just not one that matches Node's default
      // trusted CA bundle in every environment.
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    logging: false
  });
} else if (process.env.DB_DIALECT === 'mssql') {
  sequelize = new Sequelize(
    process.env.AZURE_SQL_DATABASE,
    process.env.AZURE_SQL_USER,
    process.env.AZURE_SQL_PASSWORD,
    {
      host: process.env.AZURE_SQL_SERVER,
      dialect: 'mssql',
      dialectOptions: {
        options: {
          encrypt: true
        }
      },
      logging: false
    }
  );
} else {
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './educonnect.sqlite',
    logging: false
  });
}

module.exports = sequelize;
