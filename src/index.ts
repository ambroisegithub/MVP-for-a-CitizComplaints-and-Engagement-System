import "reflect-metadata"
import dotenv from "dotenv"
import app from "./app"
import dbConnection from "./database"
import { createServer } from "http"

// Load environment variables
dotenv.config()

const PORT = process.env.PORT || 3000
const httpServer = createServer(app)
// Initialize database and start server
// Initialize database and start server
;(async () => {
  try {
    // Initialize the database connection
    if (!dbConnection.isInitialized) {
      await dbConnection.initialize()
      console.log("Database connection established successfully.")
    }


    // Start the HTTP server
    httpServer.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`)
      console.log(`WebSocket server is available at ws://localhost:${PORT}/socket.io/`)
    })
  } catch (error) {
    console.error("Error initializing database connection:", error)
    process.exit(1) // Exit the application if the database connection fails
  }
})()
