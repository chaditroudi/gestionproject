import { Router } from "express";
import {
  createUser,
  deleteUser,
  getUsers,
  updateUser
} from "../controllers/usersController.js";
import { authenticateToken, authorizePermission } from "../middleware/authMiddleware.js";

const router = Router();

router.use(authenticateToken);
router.get("/", authorizePermission("view_users"), getUsers);
router.post("/", authorizePermission("manage_users"), createUser);
router.put("/:id", authorizePermission("manage_users"), updateUser);
router.delete("/:id", authorizePermission("manage_users"), deleteUser);

export default router;
