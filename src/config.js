import 'dotenv/config';
export const config = {
  env: process.env.NODE_ENV || 'development',
  host: process.env.HOST || '127.0.0.1',
  port: Number(process.env.PORT || 3010),
  secret: process.env.SESSION_SECRET,
  setupToken: process.env.SETUP_TOKEN,
  db: {
    host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME || 'ruissau', user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '', charset: 'utf8mb4', timezone: 'Z',
    // Sur Vercel, plusieurs instances tournent en parallèle : DB_CONNECTION_LIMIT=3 ménage la limite d’alwaysdata.
    dateStrings: true, connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10), maxIdle: 2, idleTimeout: 30000,
    decimalNumbers: true, connectTimeout: 15000,
    // Base distante (ex. alwaysdata) : DB_SSL=1 chiffre la connexion et vérifie le certificat du serveur.
    ...(process.env.DB_SSL === '1' ? { ssl: { rejectUnauthorized: true } } : {}),
  },
};
