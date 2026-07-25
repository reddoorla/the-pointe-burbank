// Loads the Google Maps JS API once per page. All callers share one
// module-level promise, so the script tag is injected at most once; the
// injected URL carries a unique callback global that resolves the promise.
// Only the narrow structural surface LocationMap actually uses is typed —
// no @types/google.maps dependency.

export type GLayer = { setMap: (m: unknown) => void };
export type GMapsNS = {
  Map: new (el: HTMLElement, opts: Record<string, unknown>) => unknown;
  KmlLayer: new (opts: Record<string, unknown>) => GLayer;
};

let mapsApi: Promise<GMapsNS> | null = null;

export function loadMapsApi(key: string): Promise<GMapsNS> {
  if (mapsApi) return mapsApi;
  mapsApi = new Promise<GMapsNS>((resolve, reject) => {
    const cbName = `__reddoorMapsInit_${Date.now().toString(36)}`;
    const w = window as unknown as Record<string, unknown>;
    w[cbName] = () => {
      delete w[cbName];
      const google = (window as unknown as { google?: { maps?: GMapsNS } })
        .google;
      if (google?.maps) {
        resolve(google.maps);
      } else {
        mapsApi = null; // allow a retry, same as the onerror path
        reject(new Error("Maps JS API loaded but google.maps is missing"));
      }
    };
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=${cbName}`;
    script.async = true;
    script.onerror = () => {
      delete w[cbName];
      mapsApi = null; // allow a retry after a transient failure
      reject(new Error("Failed to load the Google Maps JS API"));
    };
    document.head.appendChild(script);
  });
  return mapsApi;
}
