/**
 * DBマイグレーション: apply_job_name と future_vision カラムを追加
 * 
 * 実行方法:
 * https://st70aifr22.execute-api.ap-northeast-1.amazonaws.com/prod/candidates/1?migrate=add-apply-job-future-vision-20260211
 */

import pkg from 'pg';
const { Pool } = pkg;

export async function runMigration() {
    const pool = new Pool({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: { rejectUnauthorized: false }
    });

    const client = await pool.connect();

    try {
        console.log('[Migration] Starting: add apply_job_name and future_vision columns');

        // apply_job_name カラムを追加（応募求人名）
        await client.query(`
      ALTER TABLE candidates 
      ADD COLUMN IF NOT EXISTS apply_job_name TEXT;
    `);
        console.log('[Migration] ✓ Added apply_job_name column');

        // future_vision カラムを追加（将来のビジョン）
        await client.query(`
      ALTER TABLE candidates 
      ADD COLUMN IF NOT EXISTS future_vision TEXT;
    `);
        console.log('[Migration] ✓ Added future_vision column');

        // 確認クエリ
        const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'candidates' 
      AND column_name IN ('apply_job_name', 'future_vision')
      ORDER BY column_name;
    `);

        console.log('[Migration] Success! Added columns:', result.rows);

        return {
            success: true,
            message: 'Migration completed successfully',
            columns: result.rows
        };

    } catch (error) {
        console.error('[Migration] Error:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}
