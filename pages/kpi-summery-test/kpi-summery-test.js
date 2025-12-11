const ENDPOINT_URL = 'https://uqg1gdotaa.execute-api.ap-northeast-1.amazonaws.com/dev/kpi/summary';

let clickHandler = null;

export function mount() {
  const button = document.getElementById('kpiSummaryFetchButton');
  const statusElement = document.getElementById('kpiSummaryStatus');
  const responseElement = document.getElementById('kpiSummaryResponse');

  if (!button || !statusElement || !responseElement) {
    console.error('[kpi-summary-test] 必要なDOM要素が見つかりませんでした');
    return;
  }

  clickHandler = () => {
    runTestRequest({ statusElement, responseElement });
  };

  button.addEventListener('click', clickHandler);

  runTestRequest({ statusElement, responseElement });
}

export function unmount() {
  const button = document.getElementById('kpiSummaryFetchButton');
  if (button && clickHandler) {
    button.removeEventListener('click', clickHandler);
  }
  clickHandler = null;
}

async function runTestRequest({ statusElement, responseElement }) {
  statusElement.textContent = 'リクエスト送信中...';
  responseElement.textContent = '';

  try {
    const startedAt = new Date();

    const response = await fetch(ENDPOINT_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    const elapsedMs = new Date().getTime() - startedAt.getTime();
    const contentType = response.headers.get('content-type') || '';

    let bodyText = '';

    if (contentType.includes('application/json')) {
      const parsed = await response.json();
      bodyText = JSON.stringify(parsed, null, 2);
    } else {
      bodyText = await response.text();
    }

    statusElement.textContent = `HTTP ${response.status} (${elapsedMs}ms)`;

    const headersObject = {};
    for (const [key, value] of response.headers.entries()) {
      headersObject[key] = value;
    }

    const debugPayload = {
      requestedUrl: ENDPOINT_URL,
      actualResponseUrl: response.url,
      status: response.status,
      ok: response.ok,
      contentType,
      headers: headersObject,
      body: bodyText || '(空のレスポンス)'
    };

    responseElement.textContent = JSON.stringify(debugPayload, null, 2);
  } catch (error) {
    statusElement.textContent = 'エラーが発生しました';
    responseElement.textContent = String(error);
    console.error('[kpi-summary-test] request error', error);
  }
}
