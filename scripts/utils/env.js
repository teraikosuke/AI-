/**
 * 環境判定ユーティリティ
 * 本番/開発環境を判定する共通関数
 */

/**
 * ローカルホストかどうかを判定
 * @param {string} [host] - ホスト名（省略時は現在のホスト）
 * @returns {boolean}
 */
export function isLocalhost(host = window.location?.hostname) {
    return host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '::1' ||
        host === '';
}

/**
 * 本番環境かどうかを判定
 * @returns {boolean}
 */
export function isProduction() {
    if (typeof window === 'undefined') return false;
    const host = window.location?.hostname || '';

    // 本番環境のドメインパターン
    const prodPatterns = [
        'pages.dev',
        'agent-key',
        'amplifyapp.com',
        'cloudfront.net'
    ];

    // 本番ドメインにマッチするか、ローカルホストでない場合は本番
    return prodPatterns.some(pattern => host.includes(pattern)) ||
        (!isLocalhost(host) && host !== '');
}

/**
 * 開発環境かどうかを判定
 * @returns {boolean}
 */
export function isDevelopment() {
    return !isProduction();
}
