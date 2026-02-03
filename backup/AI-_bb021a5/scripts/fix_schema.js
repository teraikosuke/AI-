const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function fix() {
    const client = await pool.connect();
    try {
        console.log("Altering warranty_period to TEXT...");
        await client.query("ALTER TABLE clients ALTER COLUMN warranty_period TYPE TEXT");
        console.log("Done.");
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

fix();
