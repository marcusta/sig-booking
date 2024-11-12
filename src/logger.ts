import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

// Create a Winston logger configuration
const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.errors({ stack: true, cause: true }),
    winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...metadata }) => {
      let msg = `${timestamp} [${level}]: ${message}`;
      if (Object.keys(metadata).length > 0) {
        msg += ` ${JSON.stringify(metadata)}`;
      }
      return msg;
    })
  ),
});

const fileTransport = new DailyRotateFile({
  dirname: "./logs",
  filename: "application-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  maxSize: "20m",
  maxFiles: "14d",
  zippedArchive: true,
  format: winston.format.combine(
    winston.format.errors({ stack: true, cause: true }),
    winston.format.timestamp(),
    winston.format.json()
  ),
});

const logger = winston.createLogger({
  level: "debug",
  transports: [consoleTransport, fileTransport],
});

// Export the logger
export default logger;
