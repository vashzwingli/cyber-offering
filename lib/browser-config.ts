declare const __APP_BASE__: string;
declare const __MATCH_API_BASE__: string;
const base = typeof __APP_BASE__ === "string" ? __APP_BASE__ : "/";
const apiBase = typeof __MATCH_API_BASE__ === "string" ? __MATCH_API_BASE__ : "";
export function assetUrl(path: string) { return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`; }
export function matchApiUrl() { return `${apiBase.replace(/\/$/, "")}/api/match`; }
