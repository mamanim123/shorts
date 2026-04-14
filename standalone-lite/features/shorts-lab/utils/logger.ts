/**
 * 통합 로깅 시스템
 * 프로덕션 환경에서는 DEBUG 로그를 자동으로 제거합니다.
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

class Logger {
  private static level: LogLevel = 
    import.meta.env.MODE === 'production' ? LogLevel.WARN : LogLevel.DEBUG;

  private static formatMessage(level: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}]`;
  }

  static setLevel(level: LogLevel) {
    this.level = level;
  }

  static debug(...args: any[]) {
    if (this.level <= LogLevel.DEBUG) {
      console.log(this.formatMessage('DEBUG'), ...args);
    }
  }

  static info(...args: any[]) {
    if (this.level <= LogLevel.INFO) {
      console.log(this.formatMessage('INFO'), ...args);
    }
  }

  static warn(...args: any[]) {
    if (this.level <= LogLevel.WARN) {
      console.warn(this.formatMessage('WARN'), ...args);
    }
  }

  static error(...args: any[]) {
    console.error(this.formatMessage('ERROR'), ...args);
  }

  /**
   * 성능 측정을 위한 타이머
   */
  static time(label: string) {
    if (this.level <= LogLevel.DEBUG) {
      console.time(`[TIMER] ${label}`);
    }
  }

  static timeEnd(label: string) {
    if (this.level <= LogLevel.DEBUG) {
      console.timeEnd(`[TIMER] ${label}`);
    }
  }
}

export default Logger;
