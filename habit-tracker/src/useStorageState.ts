import { useCallback, useEffect, useReducer } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

type UseStateHook<T> = [[boolean, T | null], (value: T | null) => void];

function useAsyncState<T>(
  initialValue: [boolean, T | null] = [true, null],
): UseStateHook<T> {
  return useReducer(
    (state: [boolean, T | null], action: T | null = null): [boolean, T | null] => [false, action],
    initialValue,
  ) as UseStateHook<T>;
}

/** Persists a value in SecureStore on native and localStorage on web. */
export async function setStorageItemAsync(key: string, value: string | null) {
  if (Platform.OS === 'web') {
    try {
      if (value === null) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, value);
      }
    } catch (e) {
      console.error('Local storage is unavailable:', e);
    }
  } else {
    try {
      if (value == null) {
        await SecureStore.deleteItemAsync(key);
      } else {
        await SecureStore.setItemAsync(key, value);
      }
    } catch (e) {
      // Never let a persistence failure break the current session — the value
      // simply won't survive a restart.
      console.error('Secure storage is unavailable:', e);
    }
  }
}

/**
 * Reads `key` once on mount and returns a setter for writing it back.
 * The first element of the tuple is `true` until the initial read finishes.
 */
export function useStorageState(key: string): UseStateHook<string> {
  const [state, setState] = useAsyncState<string>();

  useEffect(() => {
    if (Platform.OS === 'web') {
      try {
        // Always resolve the initial read so `isLoading` can't get stuck.
        setState(typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null);
      } catch (e) {
        console.error('Local storage is unavailable:', e);
        setState(null);
      }
    } else {
      SecureStore.getItemAsync(key)
        .then((value) => setState(value))
        .catch((e) => {
          console.error('Secure storage is unavailable:', e);
          setState(null);
        });
    }
  }, [key, setState]);

  const setValue = useCallback(
    (value: string | null) => {
      setState(value);
      setStorageItemAsync(key, value);
    },
    [key, setState],
  );

  return [state, setValue];
}
