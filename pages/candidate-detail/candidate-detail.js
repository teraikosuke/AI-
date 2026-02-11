import { MODULE_VERSIONS } from '../../scripts/module-versions.js';

let candidatesDetailApi = null;

async function loadCandidatesDetailApi() {
    if (candidatesDetailApi) return candidatesDetailApi;
    candidatesDetailApi = await import(`../candidates/candidates.js?v=${MODULE_VERSIONS.candidates}`);
    return candidatesDetailApi;
}

console.log('candidate-detail.js loaded');

function getCandidateIdFromUrl() {
    const hash = window.location.hash;
    const queryIndex = hash.indexOf('?');
    if (queryIndex === -1) return null;

    const queryString = hash.substring(queryIndex + 1);
    const params = new URLSearchParams(queryString);
    return params.get('id') || params.get('candidateId');
}

function handleBack() {
    if (candidatesDetailApi?.confirmCandidateDetailClose && !candidatesDetailApi.confirmCandidateDetailClose()) return;
    window.location.hash = '#/candidates';
}

function setupEventListeners() {
    const backBtn = document.getElementById('cdBackBtn');
    if (backBtn) {
        backBtn.addEventListener('click', handleBack);
    }
}

export async function mount() {
    console.log('candidate-detail mounting...');

    const candidateId = getCandidateIdFromUrl();
    if (!candidateId) {
        console.warn('候補者IDが指定されていません');
        handleBack();
        return;
    }

    setupEventListeners();

    const detailApi = await loadCandidatesDetailApi();
    const success = await detailApi.mountDetailPage(candidateId);
    if (!success) {
        console.error('候補者詳細の読み込みに失敗しました');
    }

    console.log('candidate-detail mounted');
}

export function unmount() {
    console.log('candidate-detail unmounting...');

    const backBtn = document.getElementById('cdBackBtn');
    if (backBtn) {
        backBtn.removeEventListener('click', handleBack);
    }

    if (candidatesDetailApi?.unmountDetailPage) {
        candidatesDetailApi.unmountDetailPage();
    }
}
