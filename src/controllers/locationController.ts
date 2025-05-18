import type { Request, Response } from "express"
import dbConnection from "../database"
import { Province } from "../models/Province"
import { District } from "../models/District"
import { Sector } from "../models/Sector"
import { Cell } from "../models/Cell"
import { Village } from "../models/Village"
import type { AuthRequest } from "../middlewares/authMiddleware"
import { UserRole } from "../enums/UserRole"

export class LocationController {
  static getProvinces = async (req: Request, res: Response) => {
    try {
      const provinceRepository = dbConnection.getRepository(Province)
      const provinces = await provinceRepository.find({
        order: { name: "ASC" },
      })

      return res.status(200).json({
        message: "Provinces retrieved successfully",
        provinces,
      })
    } catch (error) {
      console.error("Get provinces error:", error)
      return res.status(500).json({ message: "Error retrieving provinces" })
    }
  }

  static getDistricts = async (req: Request, res: Response) => {
    try {
      const { provinceId } = req.query

      const districtRepository = dbConnection.getRepository(District)

      let query = districtRepository
        .createQueryBuilder("district")
        .leftJoinAndSelect("district.province", "province")
        .orderBy("district.name", "ASC")

      if (provinceId) {
        query = query.where("province.id = :provinceId", { provinceId })
      }

      const districts = await query.getMany()

      return res.status(200).json({
        message: "Districts retrieved successfully",
        districts,
      })
    } catch (error) {
      console.error("Get districts error:", error)
      return res.status(500).json({ message: "Error retrieving districts" })
    }
  }

  static getSectors = async (req: Request, res: Response) => {
    try {
      const { districtId } = req.query

      const sectorRepository = dbConnection.getRepository(Sector)

      let query = sectorRepository
        .createQueryBuilder("sector")
        .leftJoinAndSelect("sector.district", "district")
        .leftJoinAndSelect("district.province", "province")
        .orderBy("sector.name", "ASC")

      if (districtId) {
        query = query.where("district.id = :districtId", { districtId })
      }

      const sectors = await query.getMany()

      return res.status(200).json({
        message: "Sectors retrieved successfully",
        sectors,
      })
    } catch (error) {
      console.error("Get sectors error:", error)
      return res.status(500).json({ message: "Error retrieving sectors" })
    }
  }

  static getCells = async (req: Request, res: Response) => {
    try {
      const { sectorId } = req.query

      const cellRepository = dbConnection.getRepository(Cell)

      let query = cellRepository
        .createQueryBuilder("cell")
        .leftJoinAndSelect("cell.sector", "sector")
        .leftJoinAndSelect("sector.district", "district")
        .leftJoinAndSelect("district.province", "province")
        .orderBy("cell.name", "ASC")

      if (sectorId) {
        query = query.where("sector.id = :sectorId", { sectorId })
      }

      const cells = await query.getMany()

      return res.status(200).json({
        message: "Cells retrieved successfully",
        cells,
      })
    } catch (error) {
      console.error("Get cells error:", error)
      return res.status(500).json({ message: "Error retrieving cells" })
    }
  }

  static getVillages = async (req: Request, res: Response) => {
    try {
      const { cellId } = req.query

      const villageRepository = dbConnection.getRepository(Village)

      let query = villageRepository
        .createQueryBuilder("village")
        .leftJoinAndSelect("village.cell", "cell")
        .leftJoinAndSelect("cell.sector", "sector")
        .leftJoinAndSelect("sector.district", "district")
        .leftJoinAndSelect("district.province", "province")
        .orderBy("village.name", "ASC")

      if (cellId) {
        query = query.where("cell.id = :cellId", { cellId })
      }

      const villages = await query.getMany()

      return res.status(200).json({
        message: "Villages retrieved successfully",
        villages,
      })
    } catch (error) {
      console.error("Get villages error:", error)
      return res.status(500).json({ message: "Error retrieving villages" })
    }
  }

  static createProvince = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" })
      }

      // Only admin can create provinces
      if (req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ message: "Only admin can create provinces" })
      }

      const { name } = req.body

      if (!name) {
        return res.status(400).json({ message: "Province name is required" })
      }

      const provinceRepository = dbConnection.getRepository(Province)

      // Check if province already exists
      const existingProvince = await provinceRepository.findOne({ where: { name } })
      if (existingProvince) {
        return res.status(400).json({ message: "Province with this name already exists" })
      }

      // Create province
      const province = new Province()
      province.name = name
      await provinceRepository.save(province)

      return res.status(201).json({
        message: "Province created successfully",
        province,
      })
    } catch (error) {
      console.error("Create province error:", error)
      return res.status(500).json({ message: "Error creating province" })
    }
  }

  static createDistrict = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" })
      }

      // Only admin can create districts
      if (req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ message: "Only admin can create districts" })
      }

      const { name, provinceId } = req.body

      if (!name || !provinceId) {
        return res.status(400).json({ message: "District name and province ID are required" })
      }

      const districtRepository = dbConnection.getRepository(District)
      const provinceRepository = dbConnection.getRepository(Province)

      // Find province
      const province = await provinceRepository.findOne({ where: { id: provinceId } })
      if (!province) {
        return res.status(404).json({ message: "Province not found" })
      }

      // Check if district already exists in this province
      const existingDistrict = await districtRepository.findOne({
        where: {
          name,
          province: { id: provinceId },
        },
      })
      if (existingDistrict) {
        return res.status(400).json({ message: "District with this name already exists in this province" })
      }

      // Create district
      const district = new District()
      district.name = name
      district.province = province
      await districtRepository.save(district)

      return res.status(201).json({
        message: "District created successfully",
        district,
      })
    } catch (error) {
      console.error("Create district error:", error)
      return res.status(500).json({ message: "Error creating district" })
    }
  }

  static createSector = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" })
      }

      // Only admin or governor can create sectors
      if (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.GOVERNOR) {
        return res.status(403).json({ message: "Only admin or governor can create sectors" })
      }

      const { name, districtId } = req.body

      if (!name || !districtId) {
        return res.status(400).json({ message: "Sector name and district ID are required" })
      }

      const sectorRepository = dbConnection.getRepository(Sector)
      const districtRepository = dbConnection.getRepository(District)

      // Find district
      const district = await districtRepository.findOne({
        where: { id: districtId },
        relations: ["province"],
      })
      if (!district) {
        return res.status(404).json({ message: "District not found" })
      }

      // If user is governor, check if they have jurisdiction over this district
      if (req.user.role === UserRole.GOVERNOR) {
        if (district.province.id !== req.user.village?.cell?.sector?.district?.province?.id) {
          return res.status(403).json({ message: "You do not have jurisdiction over this district" })
        }
      }

      // Check if sector already exists in this district
      const existingSector = await sectorRepository.findOne({
        where: {
          name,
          district: { id: districtId },
        },
      })
      if (existingSector) {
        return res.status(400).json({ message: "Sector with this name already exists in this district" })
      }

      // Create sector
      const sector = new Sector()
      sector.name = name
      sector.district = district
      await sectorRepository.save(sector)

      return res.status(201).json({
        message: "Sector created successfully",
        sector,
      })
    } catch (error) {
      console.error("Create sector error:", error)
      return res.status(500).json({ message: "Error creating sector" })
    }
  }

  static createCell = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" })
      }

      // Only admin, governor, or mayor can create cells
      if (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.GOVERNOR && req.user.role !== UserRole.MAYOR) {
        return res.status(403).json({ message: "Only admin, governor, or mayor can create cells" })
      }

      const { name, sectorId } = req.body

      if (!name || !sectorId) {
        return res.status(400).json({ message: "Cell name and sector ID are required" })
      }

      const cellRepository = dbConnection.getRepository(Cell)
      const sectorRepository = dbConnection.getRepository(Sector)

      // Find sector
      const sector = await sectorRepository.findOne({
        where: { id: sectorId },
        relations: ["district", "district.province"],
      })
      if (!sector) {
        return res.status(404).json({ message: "Sector not found" })
      }

      // Check if user has jurisdiction over this sector
      if (req.user.role === UserRole.GOVERNOR) {
        if (sector.district.province.id !== req.user.village?.cell?.sector?.district?.province?.id) {
          return res.status(403).json({ message: "You do not have jurisdiction over this sector" })
        }
      } else if (req.user.role === UserRole.MAYOR) {
        if (sector.district.id !== req.user.village?.cell?.sector?.district?.id) {
          return res.status(403).json({ message: "You do not have jurisdiction over this sector" })
        }
      }

      // Check if cell already exists in this sector
      const existingCell = await cellRepository.findOne({
        where: {
          name,
          sector: { id: sectorId },
        },
      })
      if (existingCell) {
        return res.status(400).json({ message: "Cell with this name already exists in this sector" })
      }

      // Create cell
      const cell = new Cell()
      cell.name = name
      cell.sector = sector
      await cellRepository.save(cell)

      return res.status(201).json({
        message: "Cell created successfully",
        cell,
      })
    } catch (error) {
      console.error("Create cell error:", error)
      return res.status(500).json({ message: "Error creating cell" })
    }
  }

  static createVillage = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" })
      }

      // Only admin, governor, mayor, or sector executive can create villages
      if (
        req.user.role !== UserRole.ADMIN &&
        req.user.role !== UserRole.GOVERNOR &&
        req.user.role !== UserRole.MAYOR &&
        req.user.role !== UserRole.SECTOR_EXEC
      ) {
        return res.status(403).json({ message: "Only admin, governor, mayor, or sector executive can create villages" })
      }

      const { name, cellId } = req.body

      if (!name || !cellId) {
        return res.status(400).json({ message: "Village name and cell ID are required" })
      }

      const villageRepository = dbConnection.getRepository(Village)
      const cellRepository = dbConnection.getRepository(Cell)

      // Find cell
      const cell = await cellRepository.findOne({
        where: { id: cellId },
        relations: ["sector", "sector.district", "sector.district.province"],
      })
      if (!cell) {
        return res.status(404).json({ message: "Cell not found" })
      }

      // Check if user has jurisdiction over this cell
      if (req.user.role === UserRole.GOVERNOR) {
        if (cell.sector.district.province.id !== req.user.village?.cell?.sector?.district?.province?.id) {
          return res.status(403).json({ message: "You do not have jurisdiction over this cell" })
        }
      } else if (req.user.role === UserRole.MAYOR) {
        if (cell.sector.district.id !== req.user.village?.cell?.sector?.district?.id) {
          return res.status(403).json({ message: "You do not have jurisdiction over this cell" })
        }
      } else if (req.user.role === UserRole.SECTOR_EXEC) {
        if (cell.sector.id !== req.user.village?.cell?.sector?.id) {
          return res.status(403).json({ message: "You do not have jurisdiction over this cell" })
        }
      }

      // Check if village already exists in this cell
      const existingVillage = await villageRepository.findOne({
        where: {
          name,
          cell: { id: cellId },
        },
      })
      if (existingVillage) {
        return res.status(400).json({ message: "Village with this name already exists in this cell" })
      }

      // Create village
      const village = new Village()
      village.name = name
      village.cell = cell
      await villageRepository.save(village)

      return res.status(201).json({
        message: "Village created successfully",
        village,
      })
    } catch (error) {
      console.error("Create village error:", error)
      return res.status(500).json({ message: "Error creating village" })
    }
  }
}
