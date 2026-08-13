window.NEWS_DB = [];
window.NEWS_LOADING = true;
window.NEWS_ERROR = '';

const API_HOST = window.location.hostname === '127.0.0.1' ? 'http://localhost:3000' : '';

async function parseJsonSafe(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`ตอบกลับไม่ใช่ JSON: ${error.message}`);
  }
}

async function fetchNewsData() {
  window.NEWS_LOADING = true;
  window.NEWS_ERROR = '';
  window.dispatchEvent(new CustomEvent('newsLoading', { detail: { message: 'กำลังโหลดข่าว...' } }));

  try {
    const response = await fetch(`${API_HOST}/api/news`);
    if (!response.ok) throw new Error('ไม่สามารถเชื่อมต่อ API ได้');

    window.NEWS_DB = await parseJsonSafe(response) || [];
    window.NEWS_LOADING = false;
    window.NEWS_ERROR = '';
    console.log('✅ โหลดข่าวจาก MySQL สำเร็จ:', window.NEWS_DB);
    window.dispatchEvent(new CustomEvent('newsLoaded'));
  } catch (error) {
    window.NEWS_LOADING = false;
    window.NEWS_ERROR = error.message || 'ไม่สามารถโหลดข่าวได้';
    console.error('❌ ดึงข้อมูลข่าวล้มเหลว:', error);
    window.dispatchEvent(new CustomEvent('newsError', { detail: { message: window.NEWS_ERROR } }));
  }
}

fetchNewsData();
