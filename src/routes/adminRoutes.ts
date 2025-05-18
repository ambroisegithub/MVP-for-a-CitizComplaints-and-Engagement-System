import { Router } from "express"
import { AdminController } from "../controllers/adminController"
import { authenticate } from "../middlewares/authMiddleware"
import { isOfficial } from "../middlewares/roleMiddleware"

const router = Router()

router.use(authenticate)
router.use(isOfficial)

// Admin routes
router.post("/assign-leader", AdminController.assignLeader)
router.get("/users", AdminController.getUsers)
router.post("/users", AdminController.createUser)
router.get("/analytics", AdminController.getAnalytics)

export default router
