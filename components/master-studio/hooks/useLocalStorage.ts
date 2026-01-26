import { useEffect, useState } from 'react';
import { getAppStorageValue, setAppStorageValue } from '../../../services/appStorageService';

// A custom hook for persisting state to app storage
function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
    const [storedValue, setStoredValue] = useState<T>(initialValue);

    useEffect(() => {
        let isMounted = true;
        const load = async () => {
            const value = await getAppStorageValue<T>(key, initialValue);
            if (isMounted) {
                setStoredValue(value);
            }
        };
        load();
        return () => {
            isMounted = false;
        };
    }, [key, initialValue]);

    const setValue = (value: T | ((val: T) => T)) => {
        try {
            const valueToStore =
                value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            setAppStorageValue(key, valueToStore);
        } catch (error) {
            console.error(`Error setting storage key “${key}”:`, error);
        }
    };

    return [storedValue, setValue];
}

export default useLocalStorage;
