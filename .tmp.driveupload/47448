/**
 * 서버용 에러 핸들러 (ES Module)
 */

import logger from './logger.js';

export class ApiError extends Error {
    constructor(message, statusCode = 500, details = null) {
        super(message);
        this.name = 'ApiError';
        this.statusCode = statusCode;
        this.details = details;
        this.timestamp = new Date().toISOString();

        Error.captureStackTrace(this, this.constructor);
    }

    toJSON() {
        return {
            success: false,
            error: this.message,
            statusCode: this.statusCode,
            details: this.details,
            timestamp: this.timestamp
        };
    }
}

export class ErrorHandler {
    static toErrorResponse(error) {
        const timestamp = new Date().toISOString();

        if (error instanceof ApiError) {
            return {
                success: false,
                error: error.message,
                statusCode: error.statusCode,
                details: error.details,
                timestamp: error.timestamp
            };
        }

        if (error instanceof Error) {
            return {
                success: false,
                error: error.message,
                statusCode: 500,
                timestamp
            };
        }

        return {
            success: false,
            error: String(error),
            statusCode: 500,
            timestamp
        };
    }

    static logError(error, context = {}) {
        if (error instanceof ApiError) {
            logger.error('[API Error]', {
                message: error.message,
                statusCode: error.statusCode,
                details: error.details,
                timestamp: error.timestamp,
                ...context
            });
        } else if (error instanceof Error) {
            logger.error('[Error]', {
                message: error.message,
                stack: error.stack,
                ...context
            });
        } else {
            logger.error('[Unknown Error]', error, context);
        }
    }

    static expressErrorHandler() {
        return (err, req, res, next) => {
            this.logError(err, {
                url: req.url,
                method: req.method,
                body: req.body
            });

            const response = this.toErrorResponse(err);
            const statusCode = response.statusCode || 500;

            res.status(statusCode).json(response);
        };
    }

    static getSafeErrorMessage(error) {
        if (process.env.NODE_ENV === 'production') {
            if (error instanceof ApiError) {
                return error.message;
            }
            return 'An error occurred. Please try again later.';
        }

        if (error instanceof Error) {
            return error.message;
        }
        return String(error);
    }
}

export function createSuccessResponse(data) {
    return {
        success: true,
        data,
        timestamp: new Date().toISOString()
    };
}

export function createErrorResponse(message, statusCode = 500, details = null) {
    return {
        success: false,
        error: message,
        statusCode,
        details,
        timestamp: new Date().toISOString()
    };
}
