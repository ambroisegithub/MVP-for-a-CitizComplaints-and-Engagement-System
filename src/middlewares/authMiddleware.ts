import type { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import authConfig from "../config/auth"
import dbConnection from "../database"
import { User } from "../models/User"

interface DecodedToken {
  userId: string
}

export interface AuthRequest extends Request {
  user?: User
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader) {
      return res.status(401).json({ message: "No authentication token provided" })
    }

    const token = authHeader.split(" ")[1]

    if (!token) {
      return res.status(401).json({ message: "Invalid authentication format" })
    }

    const decoded = jwt.verify(token, authConfig.jwtSecret) as DecodedToken

    const userRepository = dbConnection.getRepository(User)
    const user = await userRepository.findOne({
      where: { id: decoded.userId },
      relations: [
        "village",
        "village.cell",
        "village.cell.sector",
        "village.cell.sector.district",
        "village.cell.sector.district.province",
      ],
    })

    if (!user) {
      return res.status(401).json({ message: "User not found" })
    }

    req.user = user
    next()
  } catch (error) {
    console.error("Authentication error:", error)
    return res.status(401).json({ message: "Invalid or expired token" })
  }
}
