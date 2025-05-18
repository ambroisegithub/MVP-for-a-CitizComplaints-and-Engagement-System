import { Router } from "express"
import { LocationController } from "../controllers/locationController"
import { authenticate } from "../middlewares/authMiddleware"
import { isAdmin, isGovernor, isMayor, isSectorExec } from "../middlewares/roleMiddleware"
const router = Router()

// Public location routes
router.get("/provinces", LocationController.getProvinces)
router.get("/districts", LocationController.getDistricts)
router.get("/sectors", LocationController.getSectors)
router.get("/cells", LocationController.getCells)
router.get("/villages", LocationController.getVillages)
// Protected location creation routes
router.post("/provinces", 
    
    authenticate, isAdmin,
     LocationController.createProvince)
router.post("/districts", 
    authenticate, isAdmin, 
    LocationController.createDistrict)
router.post("/sectors", 
    authenticate, [isAdmin, isGovernor],
     LocationController.createSector)
router.post("/cells", 
    authenticate, [isAdmin, isGovernor, isMayor], 
    LocationController.createCell)
router.post("/villages",
    
    authenticate, [isAdmin, isGovernor, isMayor, isSectorExec], 
    LocationController.createVillage)

export default router
