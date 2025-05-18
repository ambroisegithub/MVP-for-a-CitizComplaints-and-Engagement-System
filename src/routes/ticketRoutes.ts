import { Router } from "express"
import { TicketController } from "../controllers/ticketController"
import { authenticate } from "../middlewares/authMiddleware"

const router = Router()

router.use(authenticate)

router.post("/", TicketController.createTicket)
router.get("/", TicketController.getTickets)
router.get("/:id", TicketController.getTicketById)
router.put("/:id/status", TicketController.updateTicketStatus)
router.post("/:id/comments", TicketController.addComment)
router.get("/:id/history", TicketController.getTicketStatusHistory)
router.get("/:id/comments", TicketController.getTicketComments)

export default router
