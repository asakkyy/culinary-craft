import { Client } from 'pg';

export async function database(work) {
  if (!process.env.E2E_DB_URL?.startsWith('jdbc:postgresql://')) throw new Error('An explicit isolated E2E database is required');
  const location = new URL(process.env.E2E_DB_URL.slice(5));
  const client = new Client({
    host: location.hostname,
    port: Number(location.port || 5432),
    database: location.pathname.slice(1),
    user: process.env.DB_USERNAME || 'culinary_demo',
    password: process.env.DB_PASSWORD || 'culinary_demo_local',
  });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}
