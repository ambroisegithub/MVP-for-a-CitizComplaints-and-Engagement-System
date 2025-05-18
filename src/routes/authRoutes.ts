import { Router } from "express"
import { AuthController } from "../controllers/authController"
import { authenticate } from "../middlewares/authMiddleware"

const router = Router()

// Public routes
router.post("/register", AuthController.register)
router.post("/login", AuthController.login)
router.get("/verify-email/:token", AuthController.verifyEmail)
router.post("/forgot-password", AuthController.forgotPassword)
router.post("/reset-password", AuthController.resetPassword)

// Protected routes
router.get("/profile", authenticate, AuthController.getProfile)
router.put("/profile", authenticate, AuthController.updateProfile)
router.post("/change-password", authenticate, AuthController.changePassword)

export default router
