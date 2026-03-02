const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
  host: 'aws-1-ap-southeast-1.pooler.supabase.com',
  port: 6543,
  user: 'postgres.vrgzaodsvutrfathchkm',
  password: 'Prajal@12',
  database: 'postgres',
  ssl: {
    rejectUnauthorized: false
  }
});

const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
const migrationFiles = fs.readdirSync(migrationsDir).sort();

async function runMigrations() {
  try {
    await client.connect();
    console.log('Connected to database as', client.user);

    for (const file of migrationFiles) {
      if (!file.endsWith('.sql')) continue;
      console.log(`Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query(sql);
    }

    const seedFile = path.join(process.cwd(), 'supabase', 'seed.sql');
    if (fs.existsSync(seedFile)) {
      console.log('Running seed script...');
      const seedSql = fs.readFileSync(seedFile, 'utf8');
      await client.query(seedSql);
    }

    console.log('Migrations and seed script completed successfully');
  } catch (err) {
    console.error('Error running migrations:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
