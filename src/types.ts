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
} 