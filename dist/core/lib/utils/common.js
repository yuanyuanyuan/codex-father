export function isSemver(version) {
    return /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/.test(version);
}
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}
export function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
}
export function joinPath(...parts) {
    return parts.join('/').replace(/\/+/, '/');
}
