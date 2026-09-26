const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const path = require('path');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres?schema=public';
const pool = new Pool({ connectionString });
const prisma = new PrismaClient = require(path.join(__dirname, 'packages', 'db', 'src', 'generated', 'prisma', 'client.js'));

(async () => {
  const rows = await prisma.botMessagingCredential.findMany({
    where: { provider: 'slack' },
    select: { id: true, botId: true, config: true },
  });
  console.log(JSON.stringify(rows, null, 2));
  await pool.end();
})().catch(e => { console.error(e); pool.end(); process.exit(1); });
