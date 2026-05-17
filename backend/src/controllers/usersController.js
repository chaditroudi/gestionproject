import bcrypt from "bcryptjs";
import { pool } from "../db/pool.js";
import { roles } from "../constants/roles.js";
import { canAssignRole, getAccessibleTeamIds } from "../utils/access.js";

const allowedRoles = roles;

const baseUserQuery = `
  SELECT
    u.id,
    u.full_name,
    u.email,
    u.role,
    u.created_at,
    COUNT(DISTINCT tm.team_id)::int AS team_count,
    COUNT(DISTINCT managed.id)::int AS managed_team_count,
    COUNT(DISTINCT task.id)::int AS assigned_task_count
  FROM users u
  LEFT JOIN team_members tm ON tm.user_id = u.id
  LEFT JOIN teams managed ON managed.manager_id = u.id
  LEFT JOIN tasks task ON task.assignee_id = u.id
`;

async function fetchUsers(viewer, userId = null) {
  const params = [];
  const conditions = [];

  if (userId) {
    params.push(userId);
    conditions.push(`u.id = $${params.length}`);
  }

  if (!["admin", "director", "hr"].includes(viewer.role)) {
    const accessibleTeamIds = await getAccessibleTeamIds(pool, viewer);

    params.push(viewer.id);
    const selfCondition = `u.id = $${params.length}`;

    if (accessibleTeamIds?.length) {
      params.push(accessibleTeamIds);
      conditions.push(`
        (${selfCondition} OR EXISTS (
          SELECT 1
          FROM team_members tm_visibility
          WHERE tm_visibility.user_id = u.id
            AND tm_visibility.team_id = ANY($${params.length}::int[])
        ))
      `);
    } else {
      conditions.push(selfCondition);
    }
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await pool.query(
    `
      ${baseUserQuery}
      ${whereClause}
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `,
    params
  );

  return result.rows;
}

export async function getUsers(req, res, next) {
  try {
    const users = await fetchUsers(req.user);
    return res.json(users);
  } catch (error) {
    return next(error);
  }
}

export async function createUser(req, res, next) {
  try {
    const { fullName, email, password, role } = req.body;

    if (!fullName || !email || !password || !role) {
      return res.status(400).json({
        message: "Nom complet, email, mot de passe et role sont obligatoires."
      });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: "Role utilisateur invalide." });
    }

    if (!canAssignRole(req.user.role, role)) {
      return res.status(403).json({ message: "Vous ne pouvez pas attribuer ce role." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `
        INSERT INTO users (full_name, email, password_hash, role)
        VALUES ($1, $2, $3, $4)
        RETURNING id, full_name, email, role, created_at
      `,
      [fullName, email.toLowerCase(), passwordHash, role]
    );

    const [createdUser] = await fetchUsers(req.user, result.rows[0].id);
    return res.status(201).json(createdUser);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Cet email existe deja." });
    }

    return next(error);
  }
}

export async function updateUser(req, res, next) {
  try {
    const userId = Number(req.params.id);
    const { fullName, email, password, role } = req.body;

    if (!fullName || !email || !role) {
      return res.status(400).json({
        message: "Nom complet, email et role sont obligatoires."
      });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: "Role utilisateur invalide." });
    }

    if (!canAssignRole(req.user.role, role)) {
      return res.status(403).json({ message: "Vous ne pouvez pas attribuer ce role." });
    }

    let query = `
      UPDATE users
      SET full_name = $1,
          email = $2,
          role = $3
    `;
    const params = [fullName, email.toLowerCase(), role];

    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      query += `, password_hash = $4 WHERE id = $5 RETURNING id`;
      params.push(passwordHash, userId);
    } else {
      query += ` WHERE id = $4 RETURNING id`;
      params.push(userId);
    }

    const result = await pool.query(query, params);

    if (!result.rows[0]) {
      return res.status(404).json({ message: "Utilisateur introuvable." });
    }

    const [updatedUser] = await fetchUsers(req.user, userId);
    return res.json(updatedUser);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Cet email existe deja." });
    }

    return next(error);
  }
}

export async function deleteUser(req, res, next) {
  try {
    const userId = Number(req.params.id);

    if (req.user.id === userId) {
      return res.status(400).json({
        message: "Vous ne pouvez pas supprimer votre propre compte."
      });
    }

    const result = await pool.query("DELETE FROM users WHERE id = $1 RETURNING id", [userId]);

    if (!result.rows[0]) {
      return res.status(404).json({ message: "Utilisateur introuvable." });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}
