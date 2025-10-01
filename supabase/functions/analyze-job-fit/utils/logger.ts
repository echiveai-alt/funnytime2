export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

interface LogContext {
  [key: string]: any;
}

export class Logger {
  private level: LogLevel;
  
  constructor() {
    const envLevel = Deno.env.get('LOG_LEVEL')?.toUpperCase() || 'INFO';
    this.level = LogLevel[envLevel as keyof typeof LogLevel] ?? LogLevel.INFO;
  }
  
  private log(level: LogLevel, message: string, context?: LogContext) {
    if (level < this.level) return;
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      message,
      ...context
    };
    
    console.log(JSON.stringify(logEntry));
  }
  
  debug(message: string, context?: LogContext) {
    this.log(LogLevel.DEBUG, message, context);
  }
  
  info(message: string, context?: LogContext) {
    this.log(LogLevel.INFO, message, context);
  }
  
  warn(message: string, context?: LogContext) {
    this.log(LogLevel.WARN, message, context);
  }
  
  error(message: string, error: Error, context?: LogContext) {
    this.log(LogLevel.ERROR, message, {
      ...context,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      }
    });
  }
}
