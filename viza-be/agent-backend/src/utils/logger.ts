// A simple structured logger to be used across the application.

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

// Disable pretty-print in production for better log aggregation
const isDev = process.env.NODE_ENV !== 'production';

interface LogMetadata {
  [key: string]: unknown;
}

interface LogObject extends LogMetadata {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export class Logger {
  private serviceName: string;

  constructor(options: { serviceName: string }) {
    this.serviceName = options.serviceName;
  }

  private log(level: LogLevel, message: string, error?: Error, metadata?: LogMetadata) {
    const logObject: LogObject = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      message,
      ...metadata,
    };

    if (error) {
      logObject.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    // Custom replacer to handle BigInt serialization
    const bigIntReplacer = (_key: string, value: unknown) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    };

    const output = JSON.stringify(logObject, bigIntReplacer, isDev ? 2 : 0);

    switch (level) {
      case 'DEBUG':
        console.debug(output);
        break;
      case 'INFO':
        console.info(output);
        break;
      case 'WARN':
        console.warn(output);
        break;
      case 'ERROR':
        console.error(output);
        break;
    }
  }

  debug(message: string, metadata?: LogMetadata) {
    this.log('DEBUG', message, undefined, metadata);
  }

  info(message: string, metadata?: LogMetadata) {
    this.log('INFO', message, undefined, metadata);
  }

  warn(message: string, error?: Error, metadata?: LogMetadata) {
    this.log('WARN', message, error, metadata);
  }

  error(message: string, error: Error, metadata?: LogMetadata) {
    this.log('ERROR', message, error, metadata);
  }
}
