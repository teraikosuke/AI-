const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function check() {
    const client = await pool.connect();
    try {
        const res = await client.query(
            "SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = 'clients' ORDER BY ordinal_position"
        );
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

check();
