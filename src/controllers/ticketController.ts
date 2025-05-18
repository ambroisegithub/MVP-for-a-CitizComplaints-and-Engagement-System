import type { Response } from "express"
import dbConnection from "../database"
import { Ticket } from "../models/Ticket"
import { TicketHistory } from "../models/TicketHistory"
import { TicketComment } from "../models/TicketComment"
import { Village } from "../models/Village"
import { TicketStatus } from "../enums/TicketStatus"
import { TicketPriority } from "../enums/TicketPriority"
import type { AuthRequest } from "../middlewares/authMiddleware"
import { UserRole } from "../enums/UserRole"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"

export class TicketController {
  static createTicket = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" })
      }

      const { title, description, villageId, priority } = req.body

      // Validate input
      if (!title || !description || !villageId) {
        return res.status(400).json({ message: "Title, description, and village are required" })
      }

      const ticketRepository = dbConnection.getRepository(Ticket)
      const villageRepository = dbConnection.getRepository(Village)
      const historyRepository = dbConnection.getRepository(TicketHistory)

      // Find village
      const village = await villageRepository.findOne({ where: { id: Number(villageId) } })
      if (!village) {
        return res.status(404).json({ message: "Village not found" })
      }

      // Create ticket
      const ticket = new Ticket()
      ticket.title = title
      ticket.description = description
      ticket.citizen = req.user
      ticket.village = village
      ticket.status = TicketStatus.OPEN
      ticket.priority = priority || TicketPriority.MEDIUM

      // Use AI to categorize the ticket
      try {
        const { text } = await generateText({
          model: openai("gpt-4o"),
          prompt: `Categorize this citizen complaint into one of these categories: Infrastructure, Water, Electricity, Security, Healthcare, Education, Waste Management, Land Dispute, or Other. Only respond with the category name.
          
          Complaint: ${description}`,
        })

        ticket.aiCategory = text.trim()
      } catch (aiError) {
        console.error("AI categorization error:", aiError)
        // Continue without AI categorization if it fails
      }

      await ticketRepository.save(ticket)

      // Create initial ticket history
      const history = new TicketHistory()
      history.ticket = ticket
      history.status = TicketStatus.OPEN
      history.reviewedBy = req.user
      history.note = "Ticket created"
      await historyRepository.save(history)

      return res.status(201).json({
        message: "Ticket created successfully",
        ticket,
      })
    } catch (error) {
      console.error("Create ticket error:", error)
      return res.status(500).json({ message: "Error creating ticket" })
    }
  }

  static getTickets = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" })
      }

      const { status, priority, villageId, cellId, sectorId, districtId, provinceId } = req.query

      const ticketRepository = dbConnection.getRepository(Ticket)

      // Build query based on user role and filters
      let query = ticketRepository
        .createQueryBuilder("ticket")
        .leftJoinAndSelect("ticket.citizen", "citizen")
        .leftJoinAndSelect("ticket.village", "village")
        .leftJoinAndSelect("village.cell", "cell")
        .leftJoinAndSelect("cell.sector", "sector")
        .leftJoinAndSelect("sector.district", "district")
        .leftJoinAndSelect("district.province", "province")

      // Apply status filter if provided
      if (status) {
        query = query.andWhere("ticket.status = :status", { status })
      }

      // Apply priority filter if provided
      if (priority) {
        query = query.andWhere("ticket.priority = :priority", { priority })
      }

      // Apply location filters based on user role
      switch (req.user.role) {
        case UserRole.CITIZEN:
          // Citizens can only see their own tickets
          query = query.andWhere("ticket.citizen.id = :citizenId", { citizenId: req.user.id })
          break

        case UserRole.CHAIRMAN:
          // Village chairmen can see tickets from their village
          if (!req.user.village) {
            return res.status(400).json({ message: "User is not assigned to a village" })
          }
          query = query.andWhere("village.id = :villageId", { villageId: req.user.village.id })
          break

        case UserRole.CELL_EXEC:
          // Cell executives can see tickets from all villages in their cell
          if (!req.user.village?.cell) {
            return res.status(400).json({ message: "User is not assigned to a cell" })
          }
          query = query.andWhere("cell.id = :cellId", { cellId: req.user.village.cell.id })
          break

        case UserRole.SECTOR_EXEC:
          // Sector executives can see tickets from all cells in their sector
          if (!req.user.village?.cell?.sector) {
            return res.status(400).json({ message: "User is not assigned to a sector" })
          }
          query = query.andWhere("sector.id = :sectorId", { sectorId: req.user.village.cell.sector.id })
          break

        case UserRole.MAYOR:
          // Mayors can see tickets from all sectors in their district
          if (!req.user.village?.cell?.sector?.district) {
            return res.status(400).json({ message: "User is not assigned to a district" })
          }
          query = query.andWhere("district.id = :districtId", { districtId: req.user.village.cell.sector.district.id })
          break

        case UserRole.GOVERNOR:
          // Governors can see tickets from all districts in their province
          if (!req.user.village?.cell?.sector?.district?.province) {
            return res.status(400).json({ message: "User is not assigned to a province" })
          }
          query = query.andWhere("province.id = :provinceId", {
            provinceId: req.user.village.cell.sector.district.province.id,
          })
          break

        case UserRole.ADMIN:
          // Admins can see all tickets, but can still filter by location if needed
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
      if (req.user.role !== UserRole.CITIZEN && req.user.role !== UserRole.CHAIRMAN) {
        if (villageId) {
          query = query.andWhere("village.id = :villageId", { villageId })
        }
      }

      if (
        req.user.role !== UserRole.CITIZEN &&
        req.user.role !== UserRole.CHAIRMAN &&
        req.user.role !== UserRole.CELL_EXEC
      ) {
        if (cellId) {
          query = query.andWhere("cell.id = :cellId", { cellId })
        }
      }

      if (
        req.user.role !== UserRole.CITIZEN &&
        req.user.role !== UserRole.CHAIRMAN &&
        req.user.role !== UserRole.CELL_EXEC &&
        req.user.role !== UserRole.SECTOR_EXEC
      ) {
        if (sectorId) {
          query = query.andWhere("sector.id = :sectorId", { sectorId })
        }
      }

      if (
        req.user.role !== UserRole.CITIZEN &&
        req.user.role !== UserRole.CHAIRMAN &&
        req.user.role !== UserRole.CELL_EXEC &&
        req.user.role !== UserRole.SECTOR_EXEC &&
        req.user.role !== UserRole.MAYOR
      ) {
        if (districtId) {
          query = query.andWhere("district.id = :districtId", { districtId })
        }
      }

      // Order by creation date (newest first)
      query = query.orderBy("ticket.createdAt", "DESC")

      const tickets = await query.getMany()

      return res.status(200).json({
        message: "Tickets retrieved successfully",
        tickets,
      })
    } catch (error) {
      console.error("Get tickets error:", error)
      return res.status(500).json({ message: "Error retrieving tickets" })
    }
  }

  static getTicketById = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" })
      }

      const { id } = req.params

      const ticketRepository = dbConnection.getRepository(Ticket)

      const ticket = await ticketRepository.findOne({
        where: { id: Number(id) }, 
        relations: [
          "citizen",
          "village",
          "village.cell",
          "village.cell.sector",
          "village.cell.sector.district",
          "village.cell.sector.district.province",
          "statusHistory",
          "statusHistory.reviewedBy",
          "comments",
          "comments.user",
        ],
      })

      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" })
      }

      // Check if user has permission to view this ticket
      let hasPermission = false

      switch (req.user.role) {
        case UserRole.CITIZEN:
          // Citizens can only view their own tickets
          hasPermission = ticket.citizen.id === req.user.id
          break

        case UserRole.CHAIRMAN:
          // Village chairmen can view tickets from their village
          hasPermission = ticket.village.id === req.user.village?.id
          break

        case UserRole.CELL_EXEC:
          // Cell executives can view tickets from all villages in their cell
          hasPermission = ticket.village.cell.id === req.user.village?.cell?.id
          break

        case UserRole.SECTOR_EXEC:
          // Sector executives can view tickets from all cells in their sector
          hasPermission = ticket.village.cell.sector.id === req.user.village?.cell?.sector?.id
          break

        case UserRole.MAYOR:
          // Mayors can view tickets from all sectors in their district
          hasPermission = ticket.village.cell.sector.district.id === req.user.village?.cell?.sector?.district?.id
          break

        case UserRole.GOVERNOR:
          // Governors can view tickets from all districts in their province
          hasPermission =
            ticket.village.cell.sector.district.province.id === req.user.village?.cell?.sector?.district?.province?.id
          break

        case UserRole.ADMIN:
          // Admins can view all tickets
          hasPermission = true
          break
      }

      if (!hasPermission) {
        return res.status(403).json({ message: "You do not have permission to view this ticket" })
      }

      return res.status(200).json({
        message: "Ticket retrieved successfully",
        ticket,
      })
    } catch (error) {
      console.error("Get ticket error:", error)
      return res.status(500).json({ message: "Error retrieving ticket" })
    }
  }

  static updateTicketStatus = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" })
      }

      // Only officials can update ticket status
      if (req.user.role === UserRole.CITIZEN) {
        return res.status(403).json({ message: "Citizens cannot update ticket status" })
      }

      const { id } = req.params
      const { status, note } = req.body

      if (!status) {
        return res.status(400).json({ message: "Status is required" })
      }

      // Validate status
      if (!Object.values(TicketStatus).includes(status as TicketStatus)) {
        return res.status(400).json({ message: "Invalid status" })
      }

      const ticketRepository = dbConnection.getRepository(Ticket)
      const historyRepository = dbConnection.getRepository(TicketHistory)

      const ticket = await ticketRepository.findOne({
        where: { id: Number(id) }, // Convert id to number
        relations: [
          "village",
          "village.cell",
          "village.cell.sector",
          "village.cell.sector.district",
          "village.cell.sector.district.province",
        ],
      })

      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" })
      }

      // Check if user has permission to update this ticket
      let hasPermission = false

      switch (req.user.role) {
        case UserRole.CHAIRMAN:
          // Village chairmen can update tickets from their village
          hasPermission = ticket.village.id === req.user.village?.id
          break

        case UserRole.CELL_EXEC:
          // Cell executives can update tickets from all villages in their cell
          hasPermission = ticket.village.cell.id === req.user.village?.cell?.id
          break

        case UserRole.SECTOR_EXEC:
          // Sector executives can update tickets from all cells in their sector
          hasPermission = ticket.village.cell.sector.id === req.user.village?.cell?.sector?.id
          break

        case UserRole.MAYOR:
          // Mayors can update tickets from all sectors in their district
          hasPermission = ticket.village.cell.sector.district.id === req.user.village?.cell?.sector?.district?.id
          break

        case UserRole.GOVERNOR:
          // Governors can update tickets from all districts in their province
          hasPermission =
            ticket.village.cell.sector.district.province.id === req.user.village?.cell?.sector?.district?.province?.id
          break

        case UserRole.ADMIN:
          // Admins can update all tickets
          hasPermission = true
          break
      }

      if (!hasPermission) {
        return res.status(403).json({ message: "You do not have permission to update this ticket" })
      }

      // Update ticket status
      ticket.status = status as TicketStatus
      await ticketRepository.save(ticket)

      // Create ticket history entry
      const history = new TicketHistory()
      history.ticket = ticket
      history.status = status as TicketStatus
      history.reviewedBy = req.user
      history.note = note || `Status updated to ${status}`
      await historyRepository.save(history)

      return res.status(200).json({
        message: "Ticket status updated successfully",
        ticket,
        history,
      })
    } catch (error) {
      console.error("Update ticket status error:", error)
      return res.status(500).json({ message: "Error updating ticket status" })
    }
  }

  static addComment = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" })
      }

      const { id } = req.params
      const { content } = req.body

      if (!content) {
        return res.status(400).json({ message: "Comment content is required" })
      }

      const ticketRepository = dbConnection.getRepository(Ticket)
      const commentRepository = dbConnection.getRepository(TicketComment)

      const ticket = await ticketRepository.findOne({
        where: { id: Number(id) }, // Convert id to number
        relations: [
          "village",
          "village.cell",
          "village.cell.sector",
          "village.cell.sector.district",
          "village.cell.sector.district.province",
          "citizen",
        ],
      })

      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" })
      }

      // Check if user has permission to comment on this ticket
      let hasPermission = false

      // The ticket creator can always comment
      if (ticket.citizen.id === req.user.id) {
        hasPermission = true
      } else {
        switch (req.user.role) {
          case UserRole.CHAIRMAN:
            // Village chairmen can comment on tickets from their village
            hasPermission = ticket.village.id === req.user.village?.id
            break

          case UserRole.CELL_EXEC:
            // Cell executives can comment on tickets from all villages in their cell
            hasPermission = ticket.village.cell.id === req.user.village?.cell?.id
            break

          case UserRole.SECTOR_EXEC:
            // Sector executives can comment on tickets from all cells in their sector
            hasPermission = ticket.village.cell.sector.id === req.user.village?.cell?.sector?.id
            break

          case UserRole.MAYOR:
            // Mayors can comment on tickets from all sectors in their district
            hasPermission = ticket.village.cell.sector.district.id === req.user.village?.cell?.sector?.district?.id
            break

          case UserRole.GOVERNOR:
            // Governors can comment on tickets from all districts in their province
            hasPermission =
              ticket.village.cell.sector.district.province.id === req.user.village?.cell?.sector?.district?.province?.id
            break

          case UserRole.ADMIN:
            // Admins can comment on all tickets
            hasPermission = true
            break
        }
      }

      if (!hasPermission) {
        return res.status(403).json({ message: "You do not have permission to comment on this ticket" })
      }

      // Create comment
      const comment = new TicketComment()
      comment.ticket = ticket
      comment.user = req.user
      comment.content = content
      await commentRepository.save(comment)

      return res.status(201).json({
        message: "Comment added successfully",
        comment,
      })
    } catch (error) {
      console.error("Add comment error:", error)
      return res.status(500).json({ message: "Error adding comment" })
    }
  }

  static getTicketStatusHistory = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" })
      }

      const { id } = req.params

      const ticketRepository = dbConnection.getRepository(Ticket)
      const historyRepository = dbConnection.getRepository(TicketHistory)

      const ticket = await ticketRepository.findOne({
        where: { id: Number(id) }, // Convert id to number
        relations: [
          "village",
          "village.cell",
          "village.cell.sector",
          "village.cell.sector.district",
          "village.cell.sector.district.province",
          "citizen",
        ],
      })

      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" })
      }

      // Check if user has permission to view this ticket's history
      let hasPermission = false

      // The ticket creator can always view history
      if (ticket.citizen.id === req.user.id) {
        hasPermission = true
      } else {
        switch (req.user.role) {
          case UserRole.CHAIRMAN:
            // Village chairmen can view history for tickets from their village
            hasPermission = ticket.village.id === req.user.village?.id
            break

          case UserRole.CELL_EXEC:
            // Cell executives can view history for tickets from all villages in their cell
            hasPermission = ticket.village.cell.id === req.user.village?.cell?.id
            break

          case UserRole.SECTOR_EXEC:
            // Sector executives can view history for tickets from all cells in their sector
            hasPermission = ticket.village.cell.sector.id === req.user.village?.cell?.sector?.id
            break

          case UserRole.MAYOR:
            // Mayors can view history for tickets from all sectors in their district
            hasPermission = ticket.village.cell.sector.district.id === req.user.village?.cell?.sector?.district?.id
            break

          case UserRole.GOVERNOR:
            // Governors can view history for tickets from all districts in their province
            hasPermission =
              ticket.village.cell.sector.district.province.id === req.user.village?.cell?.sector?.district?.province?.id
            break

          case UserRole.ADMIN:
            // Admins can view history for all tickets
            hasPermission = true
            break
        }
      }

      if (!hasPermission) {
        return res.status(403).json({ message: "You do not have permission to view this ticket's history" })
      }

      // Get ticket history
      const history = await historyRepository.find({
        where: { ticket: { id: ticket.id } },
        relations: ["reviewedBy"],
        order: { timestamp: "DESC" },
      })

      return res.status(200).json({
        message: "Ticket history retrieved successfully",
        history,
      })
    } catch (error) {
      console.error("Get ticket history error:", error)
      return res.status(500).json({ message: "Error retrieving ticket history" })
    }
  }

  static getTicketComments = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" })
      }

      const { id } = req.params

      const ticketRepository = dbConnection.getRepository(Ticket)
      const commentRepository = dbConnection.getRepository(TicketComment)

      const ticket = await ticketRepository.findOne({
        where: { id: Number(id) }, // Convert id to number
        relations: [
          "village",
          "village.cell",
          "village.cell.sector",
          "village.cell.sector.district",
          "village.cell.sector.district.province",
          "citizen",
        ],
      })

      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" })
      }

      // Check if user has permission to view this ticket's comments
      let hasPermission = false

      // The ticket creator can always view comments
      if (ticket.citizen.id === req.user.id) {
        hasPermission = true
      } else {
        switch (req.user.role) {
          case UserRole.CHAIRMAN:
            // Village chairmen can view comments for tickets from their village
            hasPermission = ticket.village.id === req.user.village?.id
            break

          case UserRole.CELL_EXEC:
            // Cell executives can view comments for tickets from all villages in their cell
            hasPermission = ticket.village.cell.id === req.user.village?.cell?.id
            break

          case UserRole.SECTOR_EXEC:
            // Sector executives can view comments for tickets from all cells in their sector
            hasPermission = ticket.village.cell.sector.id === req.user.village?.cell?.sector?.id
            break

          case UserRole.MAYOR:
            // Mayors can view comments for tickets from all sectors in their district
            hasPermission = ticket.village.cell.sector.district.id === req.user.village?.cell?.sector?.district?.id
            break

          case UserRole.GOVERNOR:
            // Governors can view comments for tickets from all districts in their province
            hasPermission =
              ticket.village.cell.sector.district.province.id === req.user.village?.cell?.sector?.district?.province?.id
            break

          case UserRole.ADMIN:
            // Admins can view comments for all tickets
            hasPermission = true
            break
        }
      }

      if (!hasPermission) {
        return res.status(403).json({ message: "You do not have permission to view this ticket's comments" })
      }

      // Get ticket comments
      const comments = await commentRepository.find({
        where: { ticket: { id: ticket.id } },
        relations: ["user"],
        order: { createdAt: "ASC" },
      })

      return res.status(200).json({
        message: "Ticket comments retrieved successfully",
        comments,
      })
    } catch (error) {
      console.error("Get ticket comments error:", error)
      return res.status(500).json({ message: "Error retrieving ticket comments" })
    }
  }
}
