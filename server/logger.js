/**
 * 서버용 Logger (CommonJS)
 * Node.js 환경에서 사용
 */

const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

class Logger {
    constructor() {
        this.level = process.env.NODE_ENV === 'production' ? LogLevel.WARN : LogLevel.DEBUG;
    }

    formatMessage(level, ...args) {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${level}]`;
    }

    setLevel(level) {
        this.level = level;
    }

    debug(...args) {
        if (this.level <= LogLevel.DEBUG) {
            console.log(this.formatMessage('DEBUG'), ...args);
        }
    }

    info(...args) {
        if (this.level <= LogLevel.INFO) {
            console.log(this.formatMessage('INFO'), ...args);
        }
    }

    warn(...args) {
        if (this.level <= LogLevel.WARN) {
            console.warn(this.formatMessage('WARN'), ...args);
        }
    }

    error(...args) {
        console.error(this.formatMessage('ERROR'), ...args);
    }

    time(label) {
        if (this.level <= LogLevel.DEBUG) {
            console.time(`[TIMER] ${label}`);
        }
    }

    timeEnd(label) {
        if (this.level <= LogLevel.DEBUG) {
            console.timeEnd(`[TIMER] ${label}`);
        }
    }
}

const logger = new Logger();

export { logger as default, LogLevel };
