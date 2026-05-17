import { Router } from "express";
import {
  addTaskAttachment,
  addTaskChecklistItem,
  addTaskComment,
  createTask,
  deleteTask,
  deleteTaskAttachment,
  deleteTaskChecklistItem,
  getTaskById,
  getTasks,
  updateTask,
  updateTaskChecklistItem,
  updateTaskStatus
} from "../controllers/tasksController.js";
import { authenticateToken, authorizePermission } from "../middleware/authMiddleware.js";

const router = Router();

router.use(authenticateToken);
router.get("/", authorizePermission("view_tasks"), getTasks);
router.get("/:id", authorizePermission("view_tasks"), getTaskById);
router.post("/", authorizePermission("manage_tasks"), createTask);
router.put("/:id", authorizePermission("manage_tasks"), updateTask);
router.patch("/:id/status", authorizePermission("view_tasks"), updateTaskStatus);
router.post("/:id/comments", authorizePermission("view_tasks"), addTaskComment);
router.post("/:id/checklist", authorizePermission("view_tasks"), addTaskChecklistItem);
router.patch("/:id/checklist/:itemId", authorizePermission("view_tasks"), updateTaskChecklistItem);
router.delete("/:id/checklist/:itemId", authorizePermission("view_tasks"), deleteTaskChecklistItem);
router.post("/:id/attachments", authorizePermission("view_tasks"), addTaskAttachment);
router.delete("/:id/attachments/:attachmentId", authorizePermission("view_tasks"), deleteTaskAttachment);
router.delete("/:id", authorizePermission("manage_tasks"), deleteTask);

export default router;
