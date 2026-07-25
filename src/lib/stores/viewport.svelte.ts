import { browser } from "$app/environment";

const DEFAULT_WIDTH = 1024;
const DEFAULT_HEIGHT = 768;

function createViewport() {
  let width = $state(browser ? window.innerWidth : DEFAULT_WIDTH);
  let height = $state(browser ? window.innerHeight : DEFAULT_HEIGHT);
  let consumers = 0;
  let rafId = 0;

  function commit() {
    rafId = 0;
    width = window.innerWidth;
    height = window.innerHeight;
  }

  // Coalesce rapid resize events into one state update per frame.
  function handleResize() {
    if (rafId) return;
    rafId = requestAnimationFrame(commit);
  }

  function subscribe() {
    if (!browser) return () => {};
    if (consumers === 0) {
      window.addEventListener("resize", handleResize);
      commit();
    }
    consumers++;
    return () => {
      consumers--;
      if (consumers === 0) {
        window.removeEventListener("resize", handleResize);
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = 0;
        }
      }
    };
  }

  return {
    get width() {
      return width;
    },
    get height() {
      return height;
    },
    subscribe,
  };
}

export const viewport = createViewport();
