import express, { type Application, type Request, type Response, type NextFunction } from "express"
import cors from "cors"
import helmet from "helmet"
import morgan from "morgan"
import authRoutes from "./routes/authRoutes"
import ticketRoutes from "./routes/ticketRoutes"
import adminRoutes from "./routes/adminRoutes"
import locationRoutes from "./routes/locationRoutes"

const app: Application = express()

// Middleware
app.use(cors())
app.use(helmet())
app.use(morgan("dev"))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/tickets", ticketRoutes)
app.use("/api/admin", adminRoutes)
app.use("/api/locations", locationRoutes)

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok", message: "Server is running" })
})

// Root endpoint
app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    message: "Welcome to Rwanda E-Governance Structure API",
    version: "1.0.0",
    documentation: "/api-docs",
  })
})

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Error:", err)
  res.status(500).json({ message: "Internal server error" })
})

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ message: "Route not found" })
})

export default app
