import { DataSource } from 'typeorm';
import config from '../config/db';
import dotenv from 'dotenv';
dotenv.config();

export class DbConnection {
  private static _instance: DbConnection;
  private static dbConnection = new DataSource({
    type: 'postgres',
    logging: false,
    ssl: config.ssl,
    synchronize: true,
    url: process.env.DATABASE_URL,
    migrations: [__dirname + '/../migrations/*{.ts,.js}'], // Ensure migrations path is correct
    entities: [__dirname + '/../models/*{.ts,.js}'], // Include all entity files
  });

  private constructor() {}

  public static get instance(): DbConnection {
    if (!this._instance) this._instance = new DbConnection();
    return this._instance;
  }

  public static get connection(): DataSource {
    return this.dbConnection;
  }

  initializeDb = async () => {
    try {
      const connection = await DbConnection.dbConnection.initialize();
      console.log('Database initialized successfully.');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  };

  disconnectDb = async () => {
    try {
      await DbConnection.dbConnection.destroy();
      console.log('Database connection closed.');
    } catch (error) {
      console.error('Failed to disconnect database:', error);
    }
  };
}

const dbConnection = DbConnection.connection;

export default dbConnection;