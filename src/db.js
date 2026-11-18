import mysql from 'mysql2/promise';
import { config } from './config.js';
export const pool = mysql.createPool(config.db);
export async function rows(sql, params = [], db = pool) {
  const [result] = await db.execute(sql, params);
  return result;
}
export async function transaction(work) {
  const connection = await pool.getConnection();
  try {
    // Les lectures après un verrou voient les paiements validés entre-temps.
    await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}
