import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

export async function probarConexion() {
  const client = await pool.connect();
  try {
    const resultado = await client.query("SELECT NOW()");
    console.log("Conexión exitosa a PostgreSQL");
    console.log("Fecha del servidor:", resultado.rows[0].now);
  } finally {
    client.release();
  }
}
