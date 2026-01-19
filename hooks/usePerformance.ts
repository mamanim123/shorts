import { useCallback, useRef, useEffect } from 'react';

/**
 * 디바운스된 콜백을 생성하는 커스텀 훅
 * @param callback 실행할 함수
 * @param delay 지연 시간 (ms)
 * @returns 디바운스된 함수
 */
export function useDebounce<T extends (...args: any[]) => any>(
    callback: T,
    delay: number
): (...args: Parameters<T>) => void {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const callbackRef = useRef(callback);

    // 최신 callback 유지
    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    return useCallback(
        (...args: Parameters<T>) => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            timeoutRef.current = setTimeout(() => {
                callbackRef.current(...args);
            }, delay);
        },
        [delay]
    );
}

/**
 * 쓰로틀된 콜백을 생성하는 커스텀 훅
 * @param callback 실행할 함수
 * @param limit 제한 시간 (ms)
 * @returns 쓰로틀된 함수
 */
export function useThrottle<T extends (...args: any[]) => any>(
    callback: T,
    limit: number
): (...args: Parameters<T>) => void {
    const inThrottle = useRef(false);
    const callbackRef = useRef(callback);

    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    return useCallback(
        (...args: Parameters<T>) => {
            if (!inThrottle.current) {
                callbackRef.current(...args);
                inThrottle.current = true;
                setTimeout(() => {
                    inThrottle.current = false;
                }, limit);
            }
        },
        [limit]
    );
}
