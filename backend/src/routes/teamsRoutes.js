import { Router } from "express";
import {
  createTeam,
  deleteTeam,
  getTeams,
  updateTeam
} from "../controllers/teamsController.js";
import { authenticateToken, authorizePermission } from "../middleware/authMiddleware.js";

const router = Router();

router.use(authenticateToken);
router.get("/", authorizePermission("view_teams"), getTeams);
router.post("/", authorizePermission("manage_teams"), createTeam);
router.put("/:id", authorizePermission("manage_teams"), updateTeam);
router.delete("/:id", authorizePermission("manage_teams"), deleteTeam);

export default router;
