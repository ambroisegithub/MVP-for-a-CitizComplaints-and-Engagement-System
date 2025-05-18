import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { AnalyticsService } from "./analyticsService"
import { Ticket } from "../models/Ticket"
import { User } from "../models/User"
import { TicketHistory } from "../models/TicketHistory" // Import TicketHistory
import dbConnection from "../database"
import { TicketStatus } from "../enums/TicketStatus"

export class ReportService {
  static async generateTicketReport(locationFilter?: any, dateRange?: { start: Date; end: Date }) {
    // Create a new PDF document
    const doc = new jsPDF()

    // Add title
    doc.setFontSize(18)
    doc.text("Ticket Report", 14, 22)

    // Add report generation date
    doc.setFontSize(10)
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30)

    // Add location filter info if provided
    if (locationFilter) {
      let locationText = "Location Filter: "

      if (locationFilter.provinceName) {
        locationText += `Province: ${locationFilter.provinceName}`
      }
      if (locationFilter.districtName) {
        locationText += `, District: ${locationFilter.districtName}`
      }
      if (locationFilter.sectorName) {
        locationText += `, Sector: ${locationFilter.sectorName}`
      }
      if (locationFilter.cellName) {
        locationText += `, Cell: ${locationFilter.cellName}`
      }
      if (locationFilter.villageName) {
        locationText += `, Village: ${locationFilter.villageName}`
      }

      doc.text(locationText, 14, 38)
    }

    // Add date range info if provided
    if (dateRange) {
      const dateRangeText = `Date Range: ${dateRange.start.toLocaleDateString()} to ${dateRange.end.toLocaleDateString()}`
      doc.text(dateRangeText, 14, locationFilter ? 46 : 38)
    }

    // Get ticket statistics
    const ticketStats = await AnalyticsService.getTicketsByStatus(locationFilter)

    // Add ticket statistics table
    autoTable(doc, {
      startY: locationFilter || dateRange ? 54 : 38,
      head: [["Status", "Count", "Percentage"]],
      body: [
        ["Open", ticketStats.open.toString(), `${((ticketStats.open / ticketStats.total) * 100).toFixed(2)}%`],
        [
          "In Review",
          ticketStats.inReview.toString(),
          `${((ticketStats.inReview / ticketStats.total) * 100).toFixed(2)}%`,
        ],
        [
          "Resolved",
          ticketStats.resolved.toString(),
          `${((ticketStats.resolved / ticketStats.total) * 100).toFixed(2)}%`,
        ],
        [
          "Rejected",
          ticketStats.rejected.toString(),
          `${((ticketStats.rejected / ticketStats.total) * 100).toFixed(2)}%`,
        ],
        ["Total", ticketStats.total.toString(), "100%"],
      ],
    })

    // Get ticket category statistics
    const categoryStats = await AnalyticsService.getTicketsByCategory(locationFilter)

    // Add ticket category table
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [["Category", "Count"]],
      body: Object.entries(categoryStats).map(([category, count]) => [category, count.toString()]),
    })

    // Get average resolution time
    const avgResolutionTime = await AnalyticsService.getAverageResolutionTime(locationFilter, dateRange)

    // Add average resolution time
    doc.setFontSize(12)
    doc.text(`Average Resolution Time: ${avgResolutionTime.toFixed(2)} hours`, 14, doc.lastAutoTable.finalY + 10)

    // Get ticket trends
    const trends = await AnalyticsService.getTicketTrends(locationFilter, "weekly", 8)

    // Add ticket trends table
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 20,
      head: [["Date", "Total", "Open", "In Review", "Resolved", "Rejected"]],
      body: trends.map((trend) => [
        trend.date,
        trend.total.toString(),
        trend.open.toString(),
        trend.inReview.toString(),
        trend.resolved.toString(),
        trend.rejected.toString(),
      ]),
    })

    return doc
  }

  static async generateUserReport(locationFilter?: any) {
    // Create a new PDF document
    const doc = new jsPDF()

    // Add title
    doc.setFontSize(18)
    doc.text("User Report", 14, 22)

    // Add report generation date
    doc.setFontSize(10)
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30)

    // Add location filter info if provided
    if (locationFilter) {
      let locationText = "Location Filter: "

      if (locationFilter.provinceName) {
        locationText += `Province: ${locationFilter.provinceName}`
      }
      if (locationFilter.districtName) {
        locationText += `, District: ${locationFilter.districtName}`
      }
      if (locationFilter.sectorName) {
        locationText += `, Sector: ${locationFilter.sectorName}`
      }
      if (locationFilter.cellName) {
        locationText += `, Cell: ${locationFilter.cellName}`
      }
      if (locationFilter.villageName) {
        locationText += `, Village: ${locationFilter.villageName}`
      }

      doc.text(locationText, 14, 38)
    }

    // Get user repository
    const userRepository = dbConnection.getRepository(User)

    // Build query based on location filter
    let query = userRepository
      .createQueryBuilder("user")
      .leftJoinAndSelect("user.village", "village")
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

    const users = await query.getMany()

    // Group users by role
    const usersByRole: Record<string, number> = {}
    users.forEach((user) => {
      usersByRole[user.role] = (usersByRole[user.role] || 0) + 1
    })

    // Add users by role table
    autoTable(doc, {
      startY: locationFilter ? 46 : 38,
      head: [["Role", "Count", "Percentage"]],
      body: Object.entries(usersByRole).map(([role, count]) => [
        role,
        count.toString(),
        `${((count / users.length) * 100).toFixed(2)}%`,
      ]),
    })

    // Add total users
    doc.setFontSize(12)
    doc.text(`Total Users: ${users.length}`, 14, doc.lastAutoTable.finalY + 10)

    return doc
  }

  static async generatePerformanceReport(locationFilter?: any, dateRange?: { start: Date; end: Date }) {
    // Create a new PDF document
    const doc = new jsPDF()

    // Add title
    doc.setFontSize(18)
    doc.text("Performance Report", 14, 22)

    // Add report generation date
    doc.setFontSize(10)
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30)

    // Add location filter info if provided
    if (locationFilter) {
      let locationText = "Location Filter: "

      if (locationFilter.provinceName) {
        locationText += `Province: ${locationFilter.provinceName}`
      }
      if (locationFilter.districtName) {
        locationText += `, District: ${locationFilter.districtName}`
      }
      if (locationFilter.sectorName) {
        locationText += `, Sector: ${locationFilter.sectorName}`
      }
      if (locationFilter.cellName) {
        locationText += `, Cell: ${locationFilter.cellName}`
      }
      if (locationFilter.villageName) {
        locationText += `, Village: ${locationFilter.villageName}`
      }

      doc.text(locationText, 14, 38)
    }

    // Add date range info if provided
    if (dateRange) {
      const dateRangeText = `Date Range: ${dateRange.start.toLocaleDateString()} to ${dateRange.end.toLocaleDateString()}`
      doc.text(dateRangeText, 14, locationFilter ? 46 : 38)
    }

    // Get ticket repository and history repository
    const ticketRepository = dbConnection.getRepository(Ticket)
    const historyRepository = dbConnection.getRepository(TicketHistory)

    // Build query for tickets
    let ticketQuery = ticketRepository
      .createQueryBuilder("ticket")
      .leftJoinAndSelect("ticket.village", "village")
      .leftJoinAndSelect("village.cell", "cell")
      .leftJoinAndSelect("cell.sector", "sector")
      .leftJoinAndSelect("sector.district", "district")
      .leftJoinAndSelect("district.province", "province")

    // Apply location filter if provided
    if (locationFilter) {
      if (locationFilter.villageId) {
        ticketQuery = ticketQuery.andWhere("village.id = :villageId", { villageId: locationFilter.villageId })
      } else if (locationFilter.cellId) {
        ticketQuery = ticketQuery.andWhere("cell.id = :cellId", { cellId: locationFilter.cellId })
      } else if (locationFilter.sectorId) {
        ticketQuery = ticketQuery.andWhere("sector.id = :sectorId", { sectorId: locationFilter.sectorId })
      } else if (locationFilter.districtId) {
        ticketQuery = ticketQuery.andWhere("district.id = :districtId", { districtId: locationFilter.districtId })
      } else if (locationFilter.provinceId) {
        ticketQuery = ticketQuery.andWhere("province.id = :provinceId", { provinceId: locationFilter.provinceId })
      }
    }

    // Apply date range filter if provided
    if (dateRange) {
      ticketQuery = ticketQuery.andWhere("ticket.createdAt BETWEEN :start AND :end", {
        start: dateRange.start,
        end: dateRange.end,
      })
    }

    const tickets = await ticketQuery.getMany()

    // Calculate performance metrics
    const totalTickets = tickets.length
    const resolvedTickets = tickets.filter((ticket) => ticket.status === TicketStatus.RESOLVED).length
    const resolutionRate = totalTickets > 0 ? (resolvedTickets / totalTickets) * 100 : 0

    // Get average resolution time
    const avgResolutionTime = await AnalyticsService.getAverageResolutionTime(locationFilter, dateRange)

    // Add performance metrics table
    autoTable(doc, {
      startY: locationFilter || dateRange ? 54 : 38,
      head: [["Metric", "Value"]],
      body: [
        ["Total Tickets", totalTickets.toString()],
        ["Resolved Tickets", resolvedTickets.toString()],
        ["Resolution Rate", `${resolutionRate.toFixed(2)}%`],
        ["Average Resolution Time", `${avgResolutionTime.toFixed(2)} hours`],
      ],
    })

    return doc
  }
}
