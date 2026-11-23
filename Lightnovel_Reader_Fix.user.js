// ==UserScript==
// @name         Lightnovel Reader Fix
// @namespace    amir.lightnovel
// @version      2.1
// @description  Disable chapter autoload and guard reader scroll resets.
// @match        https://lightnovel.to/*
// @match        https://www.lightnovel.to/*
// @run-at       document-start
// @grant        none
// @sandbox      raw
// ==/UserScript==

(() => {
    'use strict';

    const isChapter = () => /^\/novel\/[^/]+\/chapter-[^/]+\/?$/.test(location.pathname);

    // Preserve appearance settings; disable only continuous chapters.
    try {
        const key = 'ln-reader-prefs';
        const prefs = JSON.parse(localStorage.getItem(key) || '{}');
        if (prefs && typeof prefs === 'object' && !Array.isArray(prefs)) {
            localStorage.setItem(key, JSON.stringify({ ...prefs, cont: false }));
        }
    } catch (error) {
        console.warn('[LN Fix] Could not update reader preference.', error);
    }

    // Suppress the captured reader's specific chapter-loading marker.
    const NativeObserver = window.IntersectionObserver;
    if (NativeObserver) {
        window.IntersectionObserver = class extends NativeObserver {
            constructor(callback, options) {
                super((entries, observer) => {
                    const loader = isChapter() && !options?.root &&
                        options?.rootMargin === '1400px 0px';
                    const filtered = loader ? entries.filter(({ target: node }) =>
                        !(node.tagName === 'DIV' &&
                          node.getAttribute('aria-hidden') === 'true' &&
                          node.style.height === '1px' &&
                          node.closest('article'))
                    ) : entries;
                    if (filtered.length) callback(filtered, observer);
                }, options);
            }
        };
    }

    const nativeScrollTo = window.scrollTo;
    let allowResetUntil = 0;
    let lastPath = location.pathname;

    // Explicit actions can intentionally return to the top.
    for (const type of ['pointerdown', 'touchstart', 'keydown']) {
        addEventListener(type, () => {
            allowResetUntil = Date.now() + 1000;
        }, { capture: true, passive: true });
    }

    window.scrollTo = function (...args) {
        const path = location.pathname;
        const sameChapter = path === lastPath;
        lastPath = path;

        // Guard the numeric scrollTo(0, 0) used in the reader bundle.
        if (isChapter() && sameChapter && args.length >= 2 &&
            args[0] === 0 && args[1] === 0 && window.scrollY > 500 &&
            Date.now() > allowResetUntil) {
            const stack = String(new Error().stack || '');
            if (stack.includes('/_next/static/chunks/')) {
                console.info('[LN Fix] Blocked reader scroll reset.');
                return;
            }
        }
        return Reflect.apply(nativeScrollTo, window, args);
    };

    // Recover actual top jumps, including DOM/layout resets and scroll APIs
    // that bypass window.scrollTo. Never carry a position to another chapter.
    let readingPath = location.pathname + location.search;
    let readingY = window.scrollY;
    let upwardUntil = 0;
    let restoreFrame = 0;
    let touchY = null;
    let scrollbarHeld = false;

    const currentPath = () => location.pathname + location.search;
    const stopRecovery = () => {
        cancelAnimationFrame(restoreFrame);
        restoreFrame = 0;
    };
    const allowUpward = () => {
        upwardUntil = Date.now() + 1500;
        stopRecovery();
    };
    const resetChapter = () => {
        stopRecovery();
        readingPath = currentPath();
        readingY = window.scrollY;
    };

    addEventListener('wheel', event => {
        if (event.isTrusted && event.deltaY < 0) allowUpward();
    }, { capture: true, passive: true });

    addEventListener('keydown', event => {
        if (event.isTrusted &&
            (['Home', 'PageUp', 'ArrowUp'].includes(event.key) ||
             (event.code === 'Space' && event.shiftKey))) allowUpward();
    }, { capture: true });

    addEventListener('touchstart', event => {
        touchY = event.touches[0]?.clientY ?? null;
    }, { passive: true });
    addEventListener('touchmove', event => {
        const y = event.touches[0]?.clientY;
        if (event.isTrusted && touchY !== null && y > touchY) allowUpward();
        touchY = y ?? null;
    }, { passive: true });

    addEventListener('pointerdown', event => {
        if (!event.isTrusted) return;
        // Permit manual scrollbar dragging, including overlay scrollbars.
        if (event.clientX >= document.documentElement.clientWidth - 20) {
            scrollbarHeld = true;
            allowUpward();
        }
        // Explicit links and buttons may intentionally move the viewport.
        if (event.target?.closest?.('a, button, [role="button"]')) allowUpward();
    }, { capture: true, passive: true });
    addEventListener('pointerup', () => { scrollbarHeld = false; }, true);
    addEventListener('blur', () => { scrollbarHeld = false; });
    addEventListener('popstate', resetChapter);
    addEventListener('hashchange', resetChapter);
    addEventListener('pageshow', resetChapter);

    function recoverPosition(target) {
        stopRecovery();
        const deadline = Date.now() + 3000;
        const tick = () => {
            restoreFrame = 0;
            if (currentPath() !== readingPath || !isChapter() ||
                scrollbarHeld || Date.now() < upwardUntil ||
                Date.now() > deadline) return;

            // If content briefly collapsed, wait for its height to return.
            const root = document.scrollingElement || document.documentElement;
            const available = root.scrollHeight - innerHeight;
            if (available >= target - 2) {
                const oldBehavior = root.style.scrollBehavior;
                root.style.scrollBehavior = 'auto';
                Reflect.apply(nativeScrollTo, window, [
                    { top: target, left: window.scrollX, behavior: 'instant' }
                ]);
                root.style.scrollBehavior = oldBehavior;
                if (Math.abs(window.scrollY - target) <= 3) {
                    readingY = window.scrollY;
                    return;
                }
            }
            restoreFrame = requestAnimationFrame(tick);
        };
        restoreFrame = requestAnimationFrame(tick);
    }

    addEventListener('scroll', () => {
        if (currentPath() !== readingPath) {
            resetChapter();
            return;
        }
        if (!isChapter()) {
            readingY = window.scrollY;
            return;
        }
        if (restoreFrame) return;
        const y = window.scrollY;
        if (readingY > 700 && y < 100 && !scrollbarHeld &&
            Date.now() > upwardUntil) {
            recoverPosition(readingY);
            return;
        }
        readingY = y;
    }, { passive: true });

})();
