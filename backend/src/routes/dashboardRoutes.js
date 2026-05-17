import { Router } from "express";
import { getDashboardReport, getDashboardSummary } from "../controllers/dashboardController.js";
import { authenticateToken, authorizePermission } from "../middleware/authMiddleware.js";

const router = Router();

router.use(authenticateToken);
router.get("/summary", authorizePermission("view_dashboard"), getDashboardSummary);
router.get("/report", authorizePermission("view_dashboard"), getDashboardReport);

export default router;
