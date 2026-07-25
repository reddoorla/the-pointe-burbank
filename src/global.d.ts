interface VimeoPlayer {
  on(event: string, callback: () => void): void;
  ready(): Promise<void>;
  setQuality(quality: string): Promise<string>;
  destroy(): Promise<void>;
}

interface Window {
  Vimeo?: { Player: new (el: HTMLIFrameElement) => VimeoPlayer };
}
