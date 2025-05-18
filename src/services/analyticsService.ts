import dbConnection from "../database"
import { Ticket } from "../models/Ticket"
import { TicketStatus } from "../enums/TicketStatus"
import { TicketHistory } from "../models/TicketHistory"

export class AnalyticsService {
  static async getTicketsByStatus(locationFilter?: any) {
    const ticketRepository = dbConnection.getRepository(Ticket)

    let query = ticketRepository
      .createQueryBuilder("ticket")
      .leftJoinAndSelect("ticket.village", "village")
      .leftJoinAndSelect("village.cell", "cell")
      .leftJoinAndSelect("cell.sector", "sector")
      .leftJoinAndSelect("sector.district", "district")
      .leftJoinAndSelect("district.province", "province")

    // Apply location filter if provided
    if (locationFilter) {
      if (locationFilter.villageId) {
        query = query.andWhere("village.id = :villageId", { villageId: locationFilter.villageId })
      } else if (locationFilter.cellId) {
        query = query.andWhere("cell.id = :cellId", { cellId: locationFilter.cellId })
      } else if (locationFilter.sectorId) {
        query = query.andWhere("sector.id = :sectorId", { sectorId: locationFilter.sectorId })
      } else if (locationFilter.districtId) {
        query = query.andWhere("district.id = :districtId", { districtId: locationFilter.districtId })
      } else if (locationFilter.provinceId) {
        query = query.andWhere("province.id = :provinceId", { provinceId: locationFilter.provinceId })
      }
    }

    const tickets = await query.getMany()

    return {
      total: tickets.length,
      open: tickets.filter((ticket) => ticket.status === TicketStatus.OPEN).length,
      inReview: tickets.filter((ticket) => ticket.status === TicketStatus.IN_REVIEW).length,
      resolved: tickets.filter((ticket) => ticket.status === TicketStatus.RESOLVED).length,
      rejected: tickets.filter((ticket) => ticket.status === TicketStatus.REJECTED).length,
    }
  }

  static async getTicketsByCategory(locationFilter?: any) {
    const ticketRepository = dbConnection.getRepository(Ticket)

    let query = ticketRepository
      .createQueryBuilder("ticket")
      .leftJoinAndSelect("ticket.village", "village")
      .leftJoinAndSelect("village.cell", "cell")
      .leftJoinAndSelect("cell.sector", "sector")
      .leftJoinAndSelect("sector.district", "district")
      .leftJoinAndSelect("district.province", "province")

    // Apply location filter if provided
    if (locationFilter) {
      if (locationFilter.villageId) {
        query = query.andWhere("village.id = :villageId", { villageId: locationFilter.villageId })
      } else if (locationFilter.cellId) {
        query = query.andWhere("cell.id = :cellId", { cellId: locationFilter.cellId })
      } else if (locationFilter.sectorId) {
        query = query.andWhere("sector.id = :sectorId", { sectorId: locationFilter.sectorId })
      } else if (locationFilter.districtId) {
        query = query.andWhere("district.id = :districtId", { districtId: locationFilter.districtId })
      } else if (locationFilter.provinceId) {
        query = query.andWhere("province.id = :provinceId", { provinceId: locationFilter.provinceId })
      }
    }

    const tickets = await query.getMany()

    // Group tickets by AI category
    const categories: Record<string, number> = {}
    tickets.forEach((ticket) => {
      if (ticket.aiCategory) {
        categories[ticket.aiCategory] = (categories[ticket.aiCategory] || 0) + 1
      }
    })

    return categories
  }

  static async getAverageResolutionTime(locationFilter?: any, dateRange?: { start: Date; end: Date }) {
    const historyRepository = dbConnection.getRepository(TicketHistory)

    // Find all ticket histories where status changed to RESOLVED
    let query = historyRepository
      .createQueryBuilder("history")
      .leftJoinAndSelect("history.ticket", "ticket")
      .leftJoinAndSelect("ticket.village", "village")
      .leftJoinAndSelect("village.cell", "cell")
      .leftJoinAndSelect("cell.sector", "sector")
      .leftJoinAndSelect("sector.district", "district")
      .leftJoinAndSelect("district.province", "province")
      .where("history.status = :status", { status: TicketStatus.RESOLVED })

    // Apply location filter if provided
    if (locationFilter) {
      if (locationFilter.villageId) {
        query = query.andWhere("village.id = :villageId", { villageId: locationFilter.villageId })
      } else if (locationFilter.cellId) {
        query = query.andWhere("cell.id = :cellId", { cellId: locationFilter.cellId })
      } else if (locationFilter.sectorId) {
        query = query.andWhere("sector.id = :sectorId", { sectorId: locationFilter.sectorId })
      } else if (locationFilter.districtId) {
        query = query.andWhere("district.id = :districtId", { districtId: locationFilter.districtId })
      } else if (locationFilter.provinceId) {
        query = query.andWhere("province.id = :provinceId", { provinceId: locationFilter.provinceId })
      }
    }

    // Apply date range filter if provided
    if (dateRange) {
      query = query.andWhere("history.timestamp BETWEEN :start AND :end", {
        start: dateRange.start,
        end: dateRange.end,
      })
    }

    const resolvedHistories = await query.getMany()

    // Calculate average resolution time
    let totalResolutionTime = 0
    let resolvedTicketsCount = 0

    for (const history of resolvedHistories) {
      // Find when the ticket was created
      const ticket = await dbConnection.getRepository(Ticket).findOne({
        where: { id: history.ticket.id },
      })

      if (ticket) {
        const creationTime = ticket.createdAt.getTime()
        const resolutionTime = history.timestamp.getTime()
        const timeDiff = resolutionTime - creationTime

        totalResolutionTime += timeDiff
        resolvedTicketsCount++
      }
    }

    if (resolvedTicketsCount === 0) {
      return 0
    }

    // Return average resolution time in hours
    return totalResolutionTime / resolvedTicketsCount / (1000 * 60 * 60)
  }

  static async getTicketTrends(locationFilter?: any, period: "daily" | "weekly" | "monthly" = "daily", limit = 30) {
    const ticketRepository = dbConnection.getRepository(Ticket)

    // Calculate date range based on period
    const endDate = new Date()
    const startDate = new Date()

    if (period === "daily") {
      startDate.setDate(endDate.getDate() - limit)
    } else if (period === "weekly") {
      startDate.setDate(endDate.getDate() - limit * 7)
    } else if (period === "monthly") {
      startDate.setMonth(endDate.getMonth() - limit)
    }

    let query = ticketRepository
      .createQueryBuilder("ticket")
      .leftJoinAndSelect("ticket.village", "village")
      .leftJoinAndSelect("village.cell", "cell")
      .leftJoinAndSelect("cell.sector", "sector")
      .leftJoinAndSelect("sector.district", "district")
      .leftJoinAndSelect("district.province", "province")
      .where("ticket.createdAt BETWEEN :startDate AND :endDate", { startDate, endDate })

    // Apply location filter if provided
    if (locationFilter) {
      if (locationFilter.villageId) {
        query = query.andWhere("village.id = :villageId", { villageId: locationFilter.villageId })
      } else if (locationFilter.cellId) {
        query = query.andWhere("cell.id = :cellId", { cellId: locationFilter.cellId })
      } else if (locationFilter.sectorId) {
        query = query.andWhere("sector.id = :sectorId", { sectorId: locationFilter.sectorId })
      } else if (locationFilter.districtId) {
        query = query.andWhere("district.id = :districtId", { districtId: locationFilter.districtId })
      } else if (locationFilter.provinceId) {
        query = query.andWhere("province.id = :provinceId", { provinceId: locationFilter.provinceId })
      }
    }

    const tickets = await query.getMany()

    // Group tickets by date
    const trends: Record<
      string,
      { total: number; open: number; inReview: number; resolved: number; rejected: number }
    > = {}

    tickets.forEach((ticket) => {
      let dateKey

      if (period === "daily") {
        dateKey = ticket.createdAt.toISOString().split("T")[0] // YYYY-MM-DD
      } else if (period === "weekly") {
        const date = new Date(ticket.createdAt)
        const firstDayOfWeek = new Date(date.setDate(date.getDate() - date.getDay()))
        dateKey = firstDayOfWeek.toISOString().split("T")[0] // First day of week
      } else if (period === "monthly") {
        dateKey = `${ticket.createdAt.getFullYear()}-${String(ticket.createdAt.getMonth() + 1).padStart(2, "0")}` // YYYY-MM
      }

      if (!trends[dateKey]) {
        trends[dateKey] = { total: 0, open: 0, inReview: 0, resolved: 0, rejected: 0 }
      }

      trends[dateKey].total++

      switch (ticket.status) {
        case TicketStatus.OPEN:
          trends[dateKey].open++
          break
        case TicketStatus.IN_REVIEW:
          trends[dateKey].inReview++
          break
        case TicketStatus.RESOLVED:
          trends[dateKey].resolved++
          break
        case TicketStatus.REJECTED:
          trends[dateKey].rejected++
          break
      }
    })

    // Convert to array and sort by date
    const trendsArray = Object.entries(trends)
      .map(([date, stats]) => ({
        date,
        ...stats,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return trendsArray
  }
}
