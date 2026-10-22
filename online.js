'use strict';
function updateNetworkStatus(){
  const online=navigator.onLine;
  $('#networkStatus').textContent=online?'オンライン版':'通信なし';
  $('#networkStatus').title=online?'ブラウザーの接続状態です。サーバーへの到達を保証する表示ではありません。':'読み込み済み素材は再生できます。再読み込みには接続が必要です。';
}
window.addEventListener('online',updateNetworkStatus);
window.addEventListener('offline',updateNetworkStatus);
updateNetworkStatus();
// Persistent storage is a browser request, never a guarantee.
$('#save').addEventListener('click',()=>{if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});});
