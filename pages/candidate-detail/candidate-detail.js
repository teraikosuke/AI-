/**
 * 候補者詳細ページ
 * 既存のcandidates.jsのロジックを再利用
 */

// candidates.jsから必要な関数をインポート
import { mountDetailPage, unmountDetailPage } from '../candidates/candidates.js?v=20260322_76';

console.log('candidate-detail.js loaded');

// URLから候補者IDを取得（ハッシュベースのルーティング対応）
function getCandidateIdFromUrl() {
    // #/candidate-detail?id=xxx 形式からパラメータを取得
    const hash = window.location.hash;
    const queryIndex = hash.indexOf('?');
    if (queryIndex === -1) return null;

    const queryString = hash.substring(queryIndex + 1);
    const params = new URLSearchParams(queryString);
    return params.get('id') || params.get('candidateId');
}

// 戻るボタン
function handleBack() {
    window.location.hash = '#/candidates';
}

// イベント設定
function setupEventListeners() {
    const backBtn = document.getElementById('cdBackBtn');
    if (backBtn) {
        backBtn.addEventListener('click', handleBack);
    }
}

// マウント
export async function mount() {
    console.log('candidate-detail mounting...');

    const candidateId = getCandidateIdFromUrl();
    if (!candidateId) {
        console.warn('候補者IDが指定されていません');
        handleBack();
        return;
    }

    setupEventListeners();

    // candidates.jsのmountDetailPageを呼び出して既存のロジックを使用
    const success = await mountDetailPage(candidateId);
    if (!success) {
        console.error('候補者詳細の読み込みに失敗しました');
    }

    console.log('candidate-detail mounted');
}

// アンマウント
export function unmount() {
    console.log('candidate-detail unmounting...');

    const backBtn = document.getElementById('cdBackBtn');
    if (backBtn) {
        backBtn.removeEventListener('click', handleBack);
    }

    unmountDetailPage();
}
