import type { Response, NextFunction } from "express"
import type { AuthRequest } from "./authMiddleware"
import { UserRole } from "../enums/UserRole"

export const checkRole = (roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" })
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access forbidden: Insufficient permissions" })
    }

    next()
  }
}

// Specific role middleware
export const isAdmin = checkRole([UserRole.ADMIN])
export const isGovernor = checkRole([UserRole.GOVERNOR, UserRole.ADMIN])
export const isMayor = checkRole([UserRole.MAYOR, UserRole.GOVERNOR, UserRole.ADMIN])
export const isSectorExec = checkRole([UserRole.SECTOR_EXEC, UserRole.MAYOR, UserRole.GOVERNOR, UserRole.ADMIN])
export const isCellExec = checkRole([
  UserRole.CELL_EXEC,
  UserRole.SECTOR_EXEC,
  UserRole.MAYOR,
  UserRole.GOVERNOR,
  UserRole.ADMIN,
])
export const isChairman = checkRole([
  UserRole.CHAIRMAN,
  UserRole.CELL_EXEC,
  UserRole.SECTOR_EXEC,
  UserRole.MAYOR,
  UserRole.GOVERNOR,
  UserRole.ADMIN,
])
export const isOfficial = checkRole([
  UserRole.CHAIRMAN,
  UserRole.CELL_EXEC,
  UserRole.SECTOR_EXEC,
  UserRole.MAYOR,
  UserRole.GOVERNOR,
  UserRole.ADMIN,
])
