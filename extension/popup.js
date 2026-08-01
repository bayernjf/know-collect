const appInput = document.getElementById('appurl');
const status = document.getElementById('status');

chrome.storage.local.get('appUrl', (res) => {
  if (res.appUrl) appInput.value = res.appUrl;
});

appInput.addEventListener('change', () => {
  chrome.storage.local.set({ appUrl: appInput.value });
});

document.getElementById('collect').addEventListener('click', async () => {
  const appUrl = appInput.value.replace(/\/+$/, '');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) {
    status.textContent = '无法获取当前页面地址';
    return;
  }
  const target = `${appUrl}/?add=${encodeURIComponent(tab.url)}`;
  chrome.tabs.create({ url: target });
  window.close();
});

document.getElementById('open').addEventListener('click', () => {
  const appUrl = appInput.value.replace(/\/+$/, '');
  chrome.tabs.create({ url: appUrl });
  window.close();
});
