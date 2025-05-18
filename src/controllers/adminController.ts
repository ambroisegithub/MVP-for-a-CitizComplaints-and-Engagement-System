import type { Response } from "express"
import dbConnection from "../database"
import { User } from "../models/User"
import { UserRole } from "../enums/UserRole"
import type { AuthRequest } from "../middlewares/authMiddleware"
import bcrypt from "bcrypt"
import authConfig from "../config/auth"
import { Village } from "../models/Village"
import { Cell } from "../models/Cell"
import { Sector } from "../models/Sector"
import { District } from "../models/District"
import { Province } from "../models/Province"
import { Ticket } from "../models/Ticket"
import { TicketStatus } from "../enums/TicketStatus"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"

export class AdminController {
  static assignLeader = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" })
      }

      const { userId, role, locationId } = req.body

      if (!userId || !role || !locationId) {
        return res.status(400).json({ message: "User ID, role, and location ID are required" })
      }

      // Validate role
      if (!Object.values(UserRole).includes(role as UserRole)) {
        return res.status(400).json({ message: "Invalid role" })
      }

      // Check if assigner has permission to assign this role
      let canAssign = false
      switch (req.user.role) {
        case UserRole.ADMIN:
          // Admin can assign any role
          canAssign = true
          break
        case UserRole.GOVERNOR:
          // Governor can assign mayor, sector_exec, cell_exec, chairman
          canAssign = [UserRole.MAYOR, UserRole.SECTOR_EXEC, UserRole.CELL_EXEC, UserRole.CHAIRMAN].includes(
            role as UserRole,
          )
          break
        case UserRole.MAYOR:
          // Mayor can assign sector_exec, cell_exec, chairman
          canAssign = [UserRole.SECTOR_EXEC, UserRole.CELL_EXEC, UserRole.CHAIRMAN].includes(role as UserRole)
          break
        case UserRole.SECTOR_EXEC:
          // Sector executive can assign cell_exec, chairman
          canAssign = [UserRole.CELL_EXEC, UserRole.CHAIRMAN].includes(role as UserRole)
          break
        case UserRole.CELL_EXEC:
          // Cell executive can assign chairman
          canAssign = [UserRole.CHAIRMAN].includes(role as UserRole)
          break
        default:
          canAssign = false
      }

      if (!canAssign) {
        return res.status(403).json({ message: "You do not have permission to assign this role" })
      }

      const userRepository = dbConnection.getRepository(User)
      const villageRepository = dbConnection.getRepository(Village)
      const cellRepository = dbConnection.getRepository(Cell)
      const sectorRepository = dbConnection.getRepository(Sector)
      const districtRepository = dbConnection.getRepository(District)
      const provinceRepository = dbConnection.getRepository(Province)

      // Find user to assign role to
      const user = await userRepository.findOne({ where: { id: userId } })
      if (!user) {
        return res.status(404).json({ message: "User not found" })
      }

      // Find location based on role
      let location
      switch (role) {
        case UserRole.CHAIRMAN:
          location = await villageRepository.findOne({
            where: { id: locationId },
            relations: ["cell", "cell.sector", "cell.sector.district", "cell.sector.district.province"],
          })
          break
        case UserRole.CELL_EXEC:
          location = await cellRepository.findOne({
            where: { id: locationId },
            relations: ["sector", "sector.district", "sector.district.province"],
          })
          break
        case UserRole.SECTOR_EXEC:
          location = await sectorRepository.findOne({
            where: { id: locationId },
            relations: ["district", "district.province"],
          })
          break
        case UserRole.MAYOR:
          location = await districtRepository.findOne({
            where: { id: locationId },
            relations: ["province"],
          })
          break
        case UserRole.GOVERNOR:
          location = await provinceRepository.findOne({ where: { id: locationId } })
          break
        default:
          return res.status(400).json({ message: "Invalid role for location assignment" })
      }

      if (!location) {
        return res.status(404).json({ message: "Location not found" })
      }

      // Check if assigner has jurisdiction over this location
      let hasJurisdiction = false
      switch (req.user.role) {
        case UserRole.ADMIN:
          // Admin has jurisdiction over all locations
          hasJurisdiction = true
          break
        case UserRole.GOVERNOR:
          // Governor has jurisdiction over districts in their province
          if (role === UserRole.MAYOR) {
            hasJurisdiction = location.province.id === req.user.village?.cell?.sector?.district?.province?.id
          } else if (role === UserRole.SECTOR_EXEC) {
            hasJurisdiction = location.district.province.id === req.user.village?.cell?.sector?.district?.province?.id
          } else if (role === UserRole.CELL_EXEC) {
            hasJurisdiction =
              location.sector.district.province.id === req.user.village?.cell?.sector?.district?.province?.id
          } else if (role === UserRole.CHAIRMAN) {
            hasJurisdiction =
              location.cell.sector.district.province.id === req.user.village?.cell?.sector?.district?.province?.id
          }
          break
        case UserRole.MAYOR:
          // Mayor has jurisdiction over sectors in their district
          if (role === UserRole.SECTOR_EXEC) {
            hasJurisdiction = location.district.id === req.user.village?.cell?.sector?.district?.id
          } else if (role === UserRole.CELL_EXEC) {
            hasJurisdiction = location.sector.district.id === req.user.village?.cell?.sector?.district?.id
          } else if (role === UserRole.CHAIRMAN) {
            hasJurisdiction = location.cell.sector.district.id === req.user.village?.cell?.sector?.district?.id
          }
          break
        case UserRole.SECTOR_EXEC:
          // Sector executive has jurisdiction over cells in their sector
          if (role === UserRole.CELL_EXEC) {
            hasJurisdiction = location.sector.id === req.user.village?.cell?.sector?.id
          } else if (role === UserRole.CHAIRMAN) {
            hasJurisdiction = location.cell.sector.id === req.user.village?.cell?.sector?.id
          }
          break
        case UserRole.CELL_EXEC:
          // Cell executive has jurisdiction over villages in their cell
          if (role === UserRole.CHAIRMAN) {
            hasJurisdiction = location.cell.id === req.user.village?.cell?.id
          }
          break
      }

      if (!hasJurisdiction) {
        return res.status(403).json({ message: "You do not have jurisdiction over this location" })
      }

      // Check if there's already a leader with this role in this location
      const existingLeaderQuery = userRepository.createQueryBuilder("user").where("user.role = :role", { role })

      switch (role) {
        case UserRole.CHAIRMAN:
          existingLeaderQuery.andWhere("user.village.id = :locationId", { locationId })
          break
        case UserRole.CELL_EXEC:
          existingLeaderQuery
            .innerJoin("user.village", "village")
            .innerJoin("village.cell", "cell")
            .andWhere("cell.id = :locationId", { locationId })
          break
        case UserRole.SECTOR_EXEC:
          existingLeaderQuery
            .innerJoin("user.village", "village")
            .innerJoin("village.cell", "cell")
            .innerJoin("cell.sector", "sector")
            .andWhere("sector.id = :locationId", { locationId })
          break
        case UserRole.MAYOR:
          existingLeaderQuery
            .innerJoin("user.village", "village")
            .innerJoin("village.cell", "cell")
            .innerJoin("cell.sector", "sector")
            .innerJoin("sector.district", "district")
            .andWhere("district.id = :locationId", { locationId })
          break
        case UserRole.GOVERNOR:
          existingLeaderQuery
            .innerJoin("user.village", "village")
            .innerJoin("village.cell", "cell")
            .innerJoin("cell.sector", "sector")
            .innerJoin("sector.district", "district")
            .innerJoin("district.province", "province")
            .andWhere("province.id = :locationId", { locationId })
          break
      }

      const existingLeader = await existingLeaderQuery.getOne()
      if (existingLeader && existingLeader.id !== userId) {
        return res.status(400).json({
          message: `There is already a ${role} assigned to this location`,
          existingLeader: {
            id: existingLeader.id,
            name: existingLeader.name,
            email: existingLeader.email,
          },
        })
      }

      // Update user role and location
      user.role = role as UserRole
      user.assignedBy = req.user

      // Set the appropriate location based on role
      switch (role) {
        case UserRole.CHAIRMAN:
          user.village = location as Village
          break
        case UserRole.CELL_EXEC:
        case UserRole.SECTOR_EXEC:
        case UserRole.MAYOR:
        case UserRole.GOVERNOR:
          // Find a village in the assigned area
          let village
          if (role === UserRole.CELL_EXEC) {
            village = await villageRepository.findOne({
              where: { cell: { id: locationId } },
              relations: ["cell", "cell.sector", "cell.sector.district", "cell.sector.district.province"],
            })
          } else if (role === UserRole.SECTOR_EXEC) {
            village = await villageRepository.findOne({
              where: { cell: { sector: { id: locationId } } },
              relations: ["cell", "cell.sector", "cell.sector.district", "cell.sector.district.province"],
            })
          } else if (role === UserRole.MAYOR) {
            village = await villageRepository.findOne({
              where: { cell: { sector: { district: { id: locationId } } } },
              relations: ["cell", "cell.sector", "cell.sector.district", "cell.sector.district.province"],
            })
          } else if (role === UserRole.GOVERNOR) {
            village = await villageRepository.findOne({
              where: { cell: { sector: { district: { province: { id: locationId } } } } },
              relations: ["cell", "cell.sector", "cell.sector.district", "cell.sector.district.province"],
            })
          }

          if (!village) {
            return res.status(404).json({ message: "Could not find a village in the assigned area" })
          }

          user.village = village
          break
      }

      await userRepository.save(user)

      return res.status(200).json({
        message: "Leader assigned successfully",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          village: user.village
            ? {
                id: user.village.id,
                name: user.village.name,
                cell: user.village.cell
                  ? {
                      id: user.village.cell.id,
                      name: user.village.cell.name,
                      sector: user.village.cell.sector
                        ? {
                            id: user.village.cell.sector.id,
                            name: user.village.cell.sector.name,
                            district: user.village.cell.sector.district
                              ? {
                                  id: user.village.cell.sector.district.id,
                                  name: user.village.cell.sector.district.name,
                                  province: user.village.cell.sector.district.province
                                    ? {
                                        id: user.village.cell.sector.district.province.id,
                                        name: user.village.cell.sector.district.province.name,
                                      }
                                    : null,
                                }
                              : null,
                          }
                        : null,
                    }
                  : null,
              }
            : null,
          assignedBy: {
            id: req.user.id,
            name: req.user.name,
            role: req.user.role,
          },
        },
      })
    } catch (error) {
      console.error("Assign leader error:", error)
      return res.status(500).json({ message: "Error assigning leader" })
    }
  }

  static getUsers = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" })
      }

      // Only officials can view user lists
      if (req.user.role === UserRole.CITIZEN) {
        return res.status(403).json({ message: "Citizens cannot view user lists" })
      }

      const { role, villageId, cellId, sectorId, districtId, provinceId } = req.query

      const userRepository = dbConnection.getRepository(User)

      // Build query based on user role and filters
      let query = userRepository
        .createQueryBuilder("user")
        .leftJoinAndSelect("user.village", "village")
        .leftJoinAndSelect("village.cell", "cell")
        .leftJoinAndSelect("cell.sector", "sector")
        .leftJoinAndSelect("sector.district", "district")
        .leftJoinAndSelect("district.province", "province")
        .leftJoinAndSelect("user.assignedBy", "assignedBy")

      // Apply role filter if provided
      if (role) {
        query = query.andWhere("user.role = :role", { role })
      }

      // Apply location filters based on user role
      switch (req.user.role) {
        case UserRole.CHAIRMAN:
          // Village chairmen can only see users in their village
          if (!req.user.village) {
            return res.status(400).json({ message: "User is not assigned to a village" })
          }
          query = query.andWhere("village.id = :villageId", { villageId: req.user.village.id })
          break

        case UserRole.CELL_EXEC:
          // Cell executives can see users from all villages in their cell
          if (!req.user.village?.cell) {
            return res.status(400).json({ message: "User is not assigned to a cell" })
          }
          query = query.andWhere("cell.id = :cellId", { cellId: req.user.village.cell.id })
          break

        case UserRole.SECTOR_EXEC:
          // Sector executives can see users from all cells in their sector
          if (!req.user.village?.cell?.sector) {
            return res.status(400).json({ message: "User is not assigned to a sector" })
          }
          query = query.andWhere("sector.id = :sectorId", { sectorId: req.user.village.cell.sector.id })
          break

        case UserRole.MAYOR:
          // Mayors can see users from all sectors in their district
          if (!req.user.village?.cell?.sector?.district) {
            return res.status(400).json({ message: "User is not assigned to a district" })
          }
          query = query.andWhere("district.id = :districtId", { districtId: req.user.village.cell.sector.district.id })
          break

        case UserRole.GOVERNOR:
          // Governors can see users from all districts in their province
          if (!req.user.village?.cell?.sector?.district?.province) {
            return res.status(400).json({ message: "User is not assigned to a province" })
          }
          query = query.andWhere("province.id = :provinceId", {
            provinceId: req.user.village.cell.sector.district.province.id,
          })
          break

        case UserRole.ADMIN:
          // Admins can see all users, but can still filter by location if needed
          if (villageId) {
            query = query.andWhere("village.id = :villageId", { villageId })
          } else if (cellId) {
            query = query.andWhere("cell.id = :cellId", { cellId })
          } else if (sectorId) {
            query = query.andWhere("sector.id = :sectorId", { sectorId })
          } else if (districtId) {
            query = query.andWhere("district.id = :districtId", { districtId })
          } else if (provinceId) {
            query = query.andWhere("province.id = :provinceId", { provinceId })
          }
          break
      }

      // Apply additional location filters if provided (and user has permission)
      if (req.user.role !== UserRole.CHAIRMAN) {
        if (villageId) {
          query = query.andWhere("village.id = :villageId", { villageId })
        }
      }

      if (req.user.role !== UserRole.CHAIRMAN && req.user.role !== UserRole.CELL_EXEC) {
        if (cellId) {
          query = query.andWhere("cell.id = :cellId", { cellId })
        }
      }

      if (
        req.user.role !== UserRole.CHAIRMAN &&
        req.user.role !== UserRole.CELL_EXEC &&
        req.user.role !== UserRole.SECTOR_EXEC
      ) {
        if (sectorId) {
          query = query.andWhere("sector.id = :sectorId", { sectorId })
        }
      }

      if (
        req.user.role !== UserRole.CHAIRMAN &&
        req.user.role !== UserRole.CELL_EXEC &&
        req.user.role !== UserRole.SECTOR_EXEC &&
        req.user.role !== UserRole.MAYOR
      ) {
        if (districtId) {
          query = query.andWhere("district.id = :districtId", { districtId })
        }
      }

      // Order by role and name
      query = query.orderBy("user.role", "ASC").addOrderBy("user.name", "ASC")

      const users = await query.getMany()

      // Remove passwords from response
      const usersWithoutPasswords = users.map((user) => {
        const { password, ...userWithoutPassword } = user
        return userWithoutPassword
      })

      return res.status(200).json({
        message: "Users retrieved successfully",
        users: usersWithoutPasswords,
      })
    } catch (error) {
      console.error("Get users error:", error)
      return res.status(500).json({ message: "Error retrieving users" })
    }
  }

  static createUser = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" })
      }

      // Only officials can create users
      if (req.user.role === UserRole.CITIZEN) {
        return res.status(403).json({ message: "Citizens cannot create users" })
      }

      const { name, email, password, contact, role, villageId } = req.body

      // Validate input
      if (!name || !email || !password || !contact || !villageId) {
        return res.status(400).json({ message: "All fields are required" })
      }

      // Validate role
      if (role && !Object.values(UserRole).includes(role as UserRole)) {
        return res.status(400).json({ message: "Invalid role" })
      }

      // Check if user has permission to create this role
      if (role) {
        let canCreate = false
        switch (req.user.role) {
          case UserRole.ADMIN:
            // Admin can create any role
            canCreate = true
            break
          case UserRole.GOVERNOR:
            // Governor can create mayor, sector_exec, cell_exec, chairman, citizen
            canCreate = [
              UserRole.MAYOR,
              UserRole.SECTOR_EXEC,
              UserRole.CELL_EXEC,
              UserRole.CHAIRMAN,
              UserRole.CITIZEN,
            ].includes(role as UserRole)
            break
          case UserRole.MAYOR:
            // Mayor can create sector_exec, cell_exec, chairman, citizen
            canCreate = [UserRole.SECTOR_EXEC, UserRole.CELL_EXEC, UserRole.CHAIRMAN, UserRole.CITIZEN].includes(
              role as UserRole,
            )
            break
          case UserRole.SECTOR_EXEC:
            // Sector executive can create cell_exec, chairman, citizen
            canCreate = [UserRole.CELL_EXEC, UserRole.CHAIRMAN, UserRole.CITIZEN].includes(role as UserRole)
            break
          case UserRole.CELL_EXEC:
            // Cell executive can create chairman, citizen
            canCreate = [UserRole.CHAIRMAN, UserRole.CITIZEN].includes(role as UserRole)
            break
          case UserRole.CHAIRMAN:
            // Chairman can create citizen
            canCreate = [UserRole.CITIZEN].includes(role as UserRole)
            break
        }

        if (!canCreate) {
          return res.status(403).json({ message: "You do not have permission to create this role" })
        }
      }

      const userRepository = dbConnection.getRepository(User)
      const villageRepository = dbConnection.getRepository(Village)

      // Check if user already exists
      const existingUser = await userRepository.findOne({ where: { email } })
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" })
      }

      // Find village
      const village = await villageRepository.findOne({
        where: { id: villageId },
        relations: ["cell", "cell.sector", "cell.sector.district", "cell.sector.district.province"],
      })
      if (!village) {
        return res.status(404).json({ message: "Village not found" })
      }

      // Check if user has jurisdiction over this village
      let hasJurisdiction = false
      switch (req.user.role) {
        case UserRole.ADMIN:
          // Admin has jurisdiction over all villages
          hasJurisdiction = true
          break
        case UserRole.GOVERNOR:
          // Governor has jurisdiction over villages in their province
          hasJurisdiction =
            village.cell.sector.district.province.id === req.user.village?.cell?.sector?.district?.province?.id
          break
        case UserRole.MAYOR:
          // Mayor has jurisdiction over villages in their district
          hasJurisdiction = village.cell.sector.district.id === req.user.village?.cell?.sector?.district?.id
          break
        case UserRole.SECTOR_EXEC:
          // Sector executive has jurisdiction over villages in their sector
          hasJurisdiction = village.cell.sector.id === req.user.village?.cell?.sector?.id
          break
        case UserRole.CELL_EXEC:
          // Cell executive has jurisdiction over villages in their cell
          hasJurisdiction = village.cell.id === req.user.village?.cell?.id
          break
        case UserRole.CHAIRMAN:
          // Chairman has jurisdiction over their village
          hasJurisdiction = village.id === req.user.village?.id
          break
      }

      if (!hasJurisdiction) {
        return res.status(403).json({ message: "You do not have jurisdiction over this village" })
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
      user.role = (role as UserRole) || UserRole.CITIZEN // Default to citizen if no role provided
      user.assignedBy = req.user
      user.isVerified = true // Auto-verify users created by officials

      // Save user
      await userRepository.save(user)

      // Remove password from response
      const { password: _, ...userResponse } = user

      return res.status(201).json({
        message: "User created successfully",
        user: userResponse,
      })
    } catch (error) {
      console.error("Create user error:", error)
      return res.status(500).json({ message: "Error creating user" })
    }
  }

  static getAnalytics = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" })
      }

      // Only officials can view analytics
      if (req.user.role === UserRole.CITIZEN) {
        return res.status(403).json({ message: "Citizens cannot view analytics" })
      }

      const { villageId, cellId, sectorId, districtId, provinceId } = req.query

      const ticketRepository = dbConnection.getRepository(Ticket)

      // Build query based on user role and filters
      let query = ticketRepository
        .createQueryBuilder("ticket")
        .leftJoinAndSelect("ticket.village", "village")
        .leftJoinAndSelect("village.cell", "cell")
        .leftJoinAndSelect("cell.sector", "sector")
        .leftJoinAndSelect("sector.district", "district")
        .leftJoinAndSelect("district.province", "province")

      // Apply location filters based on user role
      switch (req.user.role) {
        case UserRole.CHAIRMAN:
          // Village chairmen can only see analytics for their village
          if (!req.user.village) {
            return res.status(400).json({ message: "User is not assigned to a village" })
          }
          query = query.andWhere("village.id = :villageId", { villageId: req.user.village.id })
          break

        case UserRole.CELL_EXEC:
          // Cell executives can see analytics for all villages in their cell
          if (!req.user.village?.cell) {
            return res.status(400).json({ message: "User is not assigned to a cell" })
          }
          query = query.andWhere("cell.id = :cellId", { cellId: req.user.village.cell.id })
          break

        case UserRole.SECTOR_EXEC:
          // Sector executives can see analytics for all cells in their sector
          if (!req.user.village?.cell?.sector) {
            return res.status(400).json({ message: "User is not assigned to a sector" })
          }
          query = query.andWhere("sector.id = :sectorId", { sectorId: req.user.village.cell.sector.id })
          break

        case UserRole.MAYOR:
          // Mayors can see analytics for all sectors in their district
          if (!req.user.village?.cell?.sector?.district) {
            return res.status(400).json({ message: "User is not assigned to a district" })
          }
          query = query.andWhere("district.id = :districtId", { districtId: req.user.village.cell.sector.district.id })
          break

        case UserRole.GOVERNOR:
          // Governors can see analytics for all districts in their province
          if (!req.user.village?.cell?.sector?.district?.province) {
            return res.status(400).json({ message: "User is not assigned to a province" })
          }
          query = query.andWhere("province.id = :provinceId", {
            provinceId: req.user.village.cell.sector.district.province.id,
          })
          break

        case UserRole.ADMIN:
          // Admins can see all analytics, but can still filter by location if needed
          if (villageId) {
            query = query.andWhere("village.id = :villageId", { villageId })
          } else if (cellId) {
            query = query.andWhere("cell.id = :cellId", { cellId })
          } else if (sectorId) {
            query = query.andWhere("sector.id = :sectorId", { sectorId })
          } else if (districtId) {
            query = query.andWhere("district.id = :districtId", { districtId })
          } else if (provinceId) {
            query = query.andWhere("province.id = :provinceId", { provinceId })
          }
          break
      }

      const tickets = await query.getMany()

      // Calculate analytics
      const totalTickets = tickets.length

      const ticketsByStatus = {
        [TicketStatus.OPEN]: tickets.filter((ticket) => ticket.status === TicketStatus.OPEN).length,
        [TicketStatus.IN_REVIEW]: tickets.filter((ticket) => ticket.status === TicketStatus.IN_REVIEW).length,
        [TicketStatus.RESOLVED]: tickets.filter((ticket) => ticket.status === TicketStatus.RESOLVED).length,
        [TicketStatus.REJECTED]: tickets.filter((ticket) => ticket.status === TicketStatus.REJECTED).length,
      }

      // Group tickets by AI category
      const ticketsByCategory: Record<string, number> = {}
      tickets.forEach((ticket) => {
        if (ticket.aiCategory) {
          ticketsByCategory[ticket.aiCategory] = (ticketsByCategory[ticket.aiCategory] || 0) + 1
        }
      })

      // Get AI summary of tickets
      let aiSummary = ""
      try {
        // Only generate AI summary if there are tickets
        if (tickets.length > 0) {
          const ticketDescriptions = tickets.map((ticket) => ticket.description).join("\n\n")

          const { text } = await generateText({
            model: openai("gpt-4"),
            prompt: `Analyze these citizen complaints and provide a summary of the main issues, trends, and recommendations for government officials. Keep your response concise (max 300 words).
            
            Complaints:
            ${ticketDescriptions}`,
          })

          aiSummary = text
        }
      } catch (aiError) {
        console.error("AI summary error:", aiError)
        aiSummary = "AI summary generation failed"
      }

      return res.status(200).json({
        message: "Analytics retrieved successfully",
        analytics: {
          totalTickets,
          ticketsByStatus,
          ticketsByCategory,
          aiSummary,
        },
      })
    } catch (error) {
      console.error("Get analytics error:", error)
      return res.status(500).json({ message: "Error retrieving analytics" })
    }
  }
}
