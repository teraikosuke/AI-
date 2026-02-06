const ENDPOINT_URL = `${window.API_BASE_URL || 'https://uqg1gdotaa.execute-api.ap-northeast-1.amazonaws.com/dev'}/kpi/summary`;

// 必要に応じて日付やユーザーIDを変更
const DEFAULT_QUERY = {
  from: '2025-12-01',
  to: '2025-12-31',
  userId: '2', // Lambda側デフォルトに合わせた
};

let clickHandler = null;

export function mount() {
  const button = document.getElementById('kpiSummaryFetchButton');
  const statusElement = document.getElementById('kpiSummaryStatus');
  const responseElement = document.getElementById('kpiSummaryResponse');
  const endpointElement = document.querySelector('.kpi-api-test-endpoint-value');
  const simpleView = document.getElementById('kpiSummarySimpleView');

  if (!button || !statusElement || !responseElement) {
    console.error('[kpi-summary-test] 必要なDOM要素が見つかりませんでした');
    return;
  }
  if (endpointElement) {
    endpointElement.textContent = `${ENDPOINT_URL}?${new URLSearchParams(DEFAULT_QUERY)}`;
  }

  clickHandler = () => runTestRequest({ statusElement, responseElement, simpleView });
  button.addEventListener('click', clickHandler);

  // 初期表示で一度実行
  runTestRequest({ statusElement, responseElement, simpleView });
}

export function unmount() {
  const button = document.getElementById('kpiSummaryFetchButton');
  if (button && clickHandler) button.removeEventListener('click', clickHandler);
  clickHandler = null;
}

async function runTestRequest({ statusElement, responseElement, simpleView }) {
  statusElement.textContent = 'リクエスト送信中...';
  responseElement.textContent = '';
  if (simpleView) simpleView.textContent = '---';

  const requestUrl = `${ENDPOINT_URL}?${new URLSearchParams(DEFAULT_QUERY)}`;

  try {
    const startedAt = Date.now();
    const response = await fetch(requestUrl, { method: 'GET', headers: { Accept: 'application/json' } });
    const elapsedMs = Date.now() - startedAt;
    const contentType = response.headers.get('content-type') || '';

    let parsed = null;
    let bodyText = '';
    if (contentType.includes('application/json')) {
      parsed = await response.json();
      bodyText = JSON.stringify(parsed, null, 2);
    } else {
      bodyText = await response.text();
    }

    const headersObject = {};
    for (const [key, value] of response.headers.entries()) headersObject[key] = value;

    statusElement.textContent = `HTTP ${response.status} (${elapsedMs}ms)`;
    responseElement.textContent = JSON.stringify(
      {
        requestedUrl: requestUrl,
        actualResponseUrl: response.url,
        status: response.status,
        ok: response.ok,
        contentType,
        headers: headersObject,
        body: bodyText || '(空のレスポンス)',
      },
      null,
      2
    );

    if (simpleView && parsed && parsed.counts) {
      const c = parsed.counts;
      simpleView.textContent =
        `推薦:${c.recommended} / 面談設定:${c.firstInterviewSet} / 面談実施:${c.firstInterviewDone} / ` +
        `内定:${c.offer} / 承諾:${c.offerAccept} / 入社:${c.joined}`;
    }
  } catch (error) {
    statusElement.textContent = 'エラーが発生しました';
    responseElement.textContent = String(error);
    if (simpleView) simpleView.textContent = 'エラー';
    console.error('[kpi-summary-test] request error', error);
  }
}
