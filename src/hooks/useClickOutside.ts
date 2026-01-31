import { useEffect, RefObject } from 'react';

/**
 * Hook to detect clicks outside of an element
 * Used to close modals, popovers, dropdowns
 */
export function useClickOutside<T extends HTMLElement = HTMLElement>(
    ref: RefObject<T>,
    handler: (event: MouseEvent | TouchEvent) => void,
    enabled: boolean = true
) {
    useEffect(() => {
        if (!enabled) return;

        const listener = (event: MouseEvent | TouchEvent) => {
            const el = ref.current;

            // Do nothing if:
            // - Element doesn't exist
            // - Click was INSIDE the element
            if (!el || el.contains(event.target as Node)) {
                return;
            }

            handler(event);
        };

        // Use capture to ensure we run before other handlers
        document.addEventListener('mousedown', listener, true);
        document.addEventListener('touchstart', listener, true);

        return () => {
            document.removeEventListener('mousedown', listener, true);
            document.removeEventListener('touchstart', listener, true);
        };
    }, [ref, handler, enabled]);
}
