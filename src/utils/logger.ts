import winston from "winston";

const logLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    verbose: 4,
    debug: 5,
    silly: 6,
  },
  colors: {
    error: "red",
    warn: "yellow",
    info: "green",
    http: "magenta",
    verbose: "cyan",
    debug: "blue",
    silly: "grey",
  },
};

winston.addColors(logLevels.colors);

const level = () => {
  const env = process.env.NODE_ENV || "development";
  return env === "production" ? "info" : "debug";
};

const isProduction = process.env.NODE_ENV === "production";

const logger = winston.createLogger({
  levels: logLevels.levels,
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.colorize({ all: true }),
    winston.format.printf(
      (info) => `${info.timestamp} [${info.level}]: ${info.message}`
    )
  ),
  transports: [
    new winston.transports.Console({
      level: isProduction ? "info" : "debug",
      stderrLevels: ["error"],
      silent: isProduction ? false : true
    }),
  ],
});

/**
 * The Logger class provides a unified logging interface for the application using Winston.
 * It supports multiple logging levels including fatal, error, warn, info, and debug.
 * The logger's output format and destination can be customized as needed.
 *
 * Usage:
 *   - The class is statically initialized and does not need to be instantiated.
 *   - Call the logging methods directly on the Logger class.
 *
 * Example:
 * ```javascript
 * import Logger from './Logger';
 *
 * Logger.info('This is an informational message');
 * Logger.error('This is an error message');
 * ```
 *
 * The logger is configured to output to the console by default, but this can be changed
 * by modifying the transports in the configure method. The log level can be adjusted based
 * on the NODE_ENV environment variable to provide more verbose output in development versus production.
 */
export default class Logger {
  static error(msg: string) {
    if (!isProduction) {
      logger.error(msg);
    }
  }

  static warn(msg: string) {
    if (!isProduction) {
      logger.warn(msg);
    }
  }

  static info(msg: string) {
    logger.info(msg);
  }

  static http(msg: string) {
    if (!isProduction) {
      logger.http(msg);
    }
  }

  static verbose(msg: string) {
    if (!isProduction) {
      logger.verbose(msg);
    }
  }

  static debug(msg: string) {
    if (!isProduction) {
      logger.debug(msg);
    }
  }

  static silly(msg: string) {
    if (!isProduction) {
      logger.silly(msg);
    }
  }
}
