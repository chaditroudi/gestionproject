import { pool } from "./pool.js";
import { roles } from "../constants/roles.js";

export async function runMigrations() {
  const hasUsersTableResult = await pool.query(`
    SELECT to_regclass('public.users') AS table_name
  `);

  if (!hasUsersTableResult.rows[0]?.table_name) {
    return;
  }

  const roleList = roles.map((role) => `'${role}'`).join(", ");

  await pool.query("BEGIN");

  try {
    await pool.query(`
      ALTER TABLE users
      DROP CONSTRAINT IF EXISTS users_role_check
    `);

    await pool.query(`
      UPDATE users
      SET role = 'employee'
      WHERE role = 'member'
    `);

    await pool.query(`
      ALTER TABLE users
      ADD CONSTRAINT users_role_check
      CHECK (role IN (${roleList}))
    `);

    await pool.query(`
      ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS parent_task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS task_comments (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS task_comment_mentions (
        comment_id INTEGER NOT NULL REFERENCES task_comments(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (comment_id, user_id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS task_checklist_items (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        title VARCHAR(180) NOT NULL,
        is_completed BOOLEAN NOT NULL DEFAULT FALSE,
        completed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        completed_at TIMESTAMP,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS task_activity_logs (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action_type VARCHAR(60) NOT NULL,
        message TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS task_attachments (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        label VARCHAR(180) NOT NULL,
        url TEXT NOT NULL,
        uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_task_checklist_items_task_id ON task_checklist_items(task_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_task_activity_logs_task_id ON task_activity_logs(task_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id)
    `);

    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}
