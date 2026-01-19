/**
 * API 에러 클래스 및 에러 핸들러
 */

import Logger from './logger';

export class ApiError extends Error {
    public statusCode: number;
    public details: any;
    public timestamp: string;

    constructor(message: string, statusCode: number = 500, details: any = null) {
        super(message);
        this.name = 'ApiError';
        this.statusCode = statusCode;
        this.details = details;
        this.timestamp = new Date().toISOString();

        // TypeScript에서 Error 상속 시 필요
        Object.setPrototypeOf(this, ApiError.prototype);
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

/**
 * 일반적인 에러 응답 형식
 */
export interface ErrorResponse {
    success: false;
    error: string;
    statusCode?: number;
    details?: any;
    timestamp: string;
}

/**
 * 성공 응답 형식
 */
export interface SuccessResponse<T = any> {
    success: true;
    data: T;
    timestamp?: string;
}

/**
 * API 응답 타입
 */
export type ApiResponse<T = any> = SuccessResponse<T> | ErrorResponse;

/**
 * 에러 핸들러 유틸리티
 */
export class ErrorHandler {
    /**
     * 에러를 ErrorResponse 형식으로 변환
     */
    static toErrorResponse(error: unknown): ErrorResponse {
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

    /**
     * 에러 로깅
     */
    static logError(error: unknown, context?: Record<string, any>) {
        if (error instanceof ApiError) {
            Logger.error('[API Error]', {
                message: error.message,
                statusCode: error.statusCode,
                details: error.details,
                timestamp: error.timestamp,
                ...context
            });
        } else if (error instanceof Error) {
            Logger.error('[Error]', {
                message: error.message,
                stack: error.stack,
                ...context
            });
        } else {
            Logger.error('[Unknown Error]', error, context);
        }
    }

    /**
     * Express 미들웨어용 에러 핸들러
     */
    static expressErrorHandler() {
        return (err: any, req: any, res: any, next: any) => {
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

    /**
     * 안전한 에러 메시지 (프로덕션용)
     */
    static getSafeErrorMessage(error: unknown): string {
        if (import.meta.env.MODE === 'production') {
            if (error instanceof ApiError) {
                return error.message;
            }
            return 'An error occurred. Please try again later.';
        }

        // 개발 환경에서는 상세 메시지 반환
        if (error instanceof Error) {
            return error.message;
        }
        return String(error);
    }
}

/**
 * 성공 응답 생성 헬퍼
 */
export function createSuccessResponse<T>(data: T): SuccessResponse<T> {
    return {
        success: true,
        data,
        timestamp: new Date().toISOString()
    };
}

/**
 * 에러 응답 생성 헬퍼
 */
export function createErrorResponse(
    message: string,
    statusCode: number = 500,
    details?: any
): ErrorResponse {
    return {
        success: false,
        error: message,
        statusCode,
        details,
        timestamp: new Date().toISOString()
    };
}

export default ErrorHandler;
