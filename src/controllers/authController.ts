import type { Request, Response } from "express"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { User } from "../models/User"
import dbConnection from "../database"
import authConfig from "../config/auth"
import { Village } from "../models/Village"
import { UserRole } from "../enums/UserRole"
import type { AuthRequest } from "../middlewares/authMiddleware"

export class AuthController {
  static register = async (req: Request, res: Response) => {
    try {
      const { name, email, password, contact, villageId, role } = req.body

      // Validate input
      if (!name || !email || !password || !contact || !villageId) {
        return res.status(400).json({ message: "All fields are required" })
      }

      const userRepository = dbConnection.getRepository(User)
      const villageRepository = dbConnection.getRepository(Village)

      // Check if user already exists
      const existingUser = await userRepository.findOne({ where: { email } })
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" })
      }

      // Find village
      const village = await villageRepository.findOne({ where: { id: villageId } })
      if (!village) {
        return res.status(404).json({ message: "Village not found" })
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, authConfig.saltRounds)

      // Create new user
      const user = new User()
      user.name = name
      user.email = email
      user.password = hashedPassword
      user.contact = contact
      user.village = village
      user.role = role || UserRole.CITIZEN // Default to citizen if no role provided
      user.isVerified = false // Require email verification

      // Save user
      await userRepository.save(user)

      // Remove password from response
      const { password: _, ...userResponse } = user

      return res.status(201).json({
        message: "User registered successfully",
        user: userResponse,
      })
    } catch (error) {
      console.error("Registration error:", error)
      return res.status(500).json({ message: "Error registering user" })
    }
  }

  static login = async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body

      // Validate input
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" })
      }

      const userRepository = dbConnection.getRepository(User)

      // Find user
      const user = await userRepository.findOne({
        where: { email },
        relations: [
          "village",
          "village.cell",
          "village.cell.sector",
          "village.cell.sector.district",
          "village.cell.sector.district.province",
        ],
      })

      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" })
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(password, user.password)
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid credentials" })
      }

      // Check if user is verified
      if (!user.isVerified) {
        return res
          .status(403)
          .json({ message: "Account not verified. Please check your email for verification instructions." })
      }

      // Generate JWT token
      const token = jwt.sign({ userId: user.id }, authConfig.jwtSecret, { expiresIn: authConfig.jwtExpiresIn })

      // Remove password from response
      const { password: _, ...userResponse } = user

      return res.status(200).json({
        message: "Login successful",
        token,
        user: userResponse,
      })
    } catch (error) {
      console.error("Login error:", error)
      return res.status(500).json({ message: "Error during login" })
    }
  }

  static verifyEmail = async (req: Request, res: Response) => {
    try {
      const { token } = req.params

      if (!token) {
        return res.status(400).json({ message: "Verification token is required" })
      }

      const userRepository = dbConnection.getRepository(User)
      const user = await userRepository.findOne({ where: { resetPasswordToken: token } })

      if (!user) {
        return res.status(400).json({ message: "Invalid verification token" })
      }

      // Check if token is expired
      if (user.resetPasswordExpires && user.resetPasswordExpires < new Date()) {
        return res.status(400).json({ message: "Verification token has expired" })
      }

      // Update user verification status
      user.isVerified = true
      user.resetPasswordToken = null
      user.resetPasswordExpires = null
      await userRepository.save(user)

      return res.status(200).json({ message: "Email verified successfully" })
    } catch (error) {
      console.error("Email verification error:", error)
      return res.status(500).json({ message: "Error verifying email" })
    }
  }

  static forgotPassword = async (req: Request, res: Response) => {
    try {
      const { email } = req.body

      if (!email) {
        return res.status(400).json({ message: "Email is required" })
      }

      const userRepository = dbConnection.getRepository(User)
      const user = await userRepository.findOne({ where: { email } })

      if (!user) {
        // For security reasons, don't reveal that the user doesn't exist
        return res
          .status(200)
          .json({ message: "If your email is registered, you will receive password reset instructions" })
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString("hex")
      const resetTokenExpiry = new Date()
      resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1) // Token valid for 1 hour

      // Save token to user
      user.resetPasswordToken = resetToken
      user.resetPasswordExpires = resetTokenExpiry
      await userRepository.save(user)

      // TODO: Send password reset email with token

      return res
        .status(200)
        .json({ message: "If your email is registered, you will receive password reset instructions" })
    } catch (error) {
      console.error("Forgot password error:", error)
      return res.status(500).json({ message: "Error processing forgot password request" })
    }
  }

  static resetPassword = async (req: Request, res: Response) => {
    try {
      const { token, newPassword } = req.body

      if (!token || !newPassword) {
        return res.status(400).json({ message: "Token and new password are required" })
      }

      const userRepository = dbConnection.getRepository(User)
      const user = await userRepository.findOne({ where: { resetPasswordToken: token } })

      if (!user) {
        return res.status(400).json({ message: "Invalid or expired token" })
      }

      // Check if token is expired
      if (user.resetPasswordExpires && user.resetPasswordExpires < new Date()) {
        return res.status(400).json({ message: "Reset token has expired" })
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, authConfig.saltRounds)

      // Update user password
      user.password = hashedPassword
      user.resetPasswordToken = null
      user.resetPasswordExpires = null
      await userRepository.save(user)

      return res.status(200).json({ message: "Password reset successful" })
    } catch (error) {
      console.error("Reset password error:", error)
      return res.status(500).json({ message: "Error resetting password" })
    }
  }

  static getProfile = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" })
      }

      // Remove password from response
      const { password, ...userResponse } = req.user

      return res.status(200).json({
        message: "Profile retrieved successfully",
        user: userResponse,
      })
    } catch (error) {
      console.error("Get profile error:", error)
      return res.status(500).json({ message: "Error retrieving profile" })
    }
  }

  static updateProfile = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" })
      }

      const { name, contact } = req.body
      const userRepository = dbConnection.getRepository(User)

      // Update user
      if (name) req.user.name = name
      if (contact) req.user.contact = contact

      await userRepository.save(req.user)

      // Remove password from response
      const { password, ...userResponse } = req.user

      return res.status(200).json({
        message: "Profile updated successfully",
        user: userResponse,
      })
    } catch (error) {
      console.error("Update profile error:", error)
      return res.status(500).json({ message: "Error updating profile" })
    }
  }

  static changePassword = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" })
      }

      const { currentPassword, newPassword } = req.body

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" })
      }

      // Verify current password
      const isPasswordValid = await bcrypt.compare(currentPassword, req.user.password)
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Current password is incorrect" })
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, authConfig.saltRounds)

      // Update password
      const userRepository = dbConnection.getRepository(User)
      req.user.password = hashedPassword
      await userRepository.save(req.user)

      return res.status(200).json({ message: "Password changed successfully" })
    } catch (error) {
      console.error("Change password error:", error)
      return res.status(500).json({ message: "Error changing password" })
    }
  }
}
