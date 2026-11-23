// ==UserScript==
// @name         Lightnovel Reader Fix
// @namespace    amir.lightnovel
// @version      2.0
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
})();
