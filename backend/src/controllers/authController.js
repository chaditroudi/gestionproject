import bcrypt from "bcryptjs";
import { pool } from "../db/pool.js";
import { getPermissionsForRole } from "../constants/permissions.js";
import { signToken } from "../utils/jwt.js";

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email et mot de passe sont obligatoires." });
    }

    const result = await pool.query(
      `
        SELECT id, full_name, email, password_hash, role
        FROM users
        WHERE email = $1
      `,
      [email.toLowerCase()]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: "Identifiants invalides." });
    } 

    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ message: "Identifiants invalides." });
    }

    const token = signToken(user);

    return res.json({
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        permissions: getPermissionsForRole(user.role)
      }
    });
  } catch (error) {
    return next(error);
  }
}

export async function me(req, res, next) {
  try {
    const result = await pool.query(
      `
        SELECT id, full_name, email, role, created_at
        FROM users
        WHERE id = $1
      `,
      [req.user.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: "Utilisateur introuvable." });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
}
