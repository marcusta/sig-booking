import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

// Create a Winston logger configuration
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    // Console transport
    new winston.transports.Console(),

    // File transport with daily rotation
    new DailyRotateFile({
      dirname: "./logs",
      filename: "application-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxSize: "20m", // Maximum file size
      maxFiles: "14d", // Keep logs for 14 days
      zippedArchive: true, // Compress old logs
    }),
  ],
});

// Export the logger
export default logger;
