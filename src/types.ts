export interface GameInfo {
    id: string;
    title: string;
    author: string;
    url: string;
    description?: string;
    tags?: string[];
    cover_image?: string; // from scraper
    thumbnailUrl?: string; // from curated list
    isDownloaded: boolean;
    localPath?: string;
    downloadPath?: string;
    entryPoint?: string;
    rating?: string;
    isDefault?: boolean;
    engine?: string; // unity, pico8, other
    width?: number; // game iframe width
    height?: number; // game iframe height
    iframe_url?: string; // direct iframe URL for browser games and PWAs
    bundled_path?: string; // path to bundled game files
} 