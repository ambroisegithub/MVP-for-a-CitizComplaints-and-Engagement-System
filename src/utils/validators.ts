import { validate } from "class-validator"
import type { Request, Response, NextFunction } from "express"

export const validateRequest = (schema: any) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const instance = Object.assign(new schema(), req.body)
      const errors = await validate(instance)

      if (errors.length > 0) {
        const validationErrors = errors.map((error) => {
          const constraints = error.constraints || {}
          return {
            property: error.property,
            constraints: Object.values(constraints),
          }
        })

        return res.status(400).json({
          message: "Validation failed",
          errors: validationErrors,
        })
      }

      next()
    } catch (error) {
      console.error("Validation error:", error)
      return res.status(500).json({ message: "Error validating request" })
    }
  }
}

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export const validatePassword = (password: string): boolean => {
  // Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/
  return passwordRegex.test(password)
}

export const validatePhoneNumber = (phoneNumber: string): boolean => {
  // Simple phone number validation (can be customized based on Rwanda's phone number format)
  const phoneRegex = /^\+?[0-9]{10,15}$/
  return phoneRegex.test(phoneNumber)
}
