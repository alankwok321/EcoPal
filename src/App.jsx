import { useMemo, useState } from 'react';
import './App.css';
import { appId, firebaseReady, missingFirebaseEnv } from './firebase';

function App() {
  const [featureMsg, setFeatureMsg] = useState('');
  const appTitle = useMemo(() => '綠碳星球', []);

  const onTryEvolution = () => {
    setFeatureMsg('AI 進化功能已於生產環境暫時關閉，稍後可改用伺服器端 OpenAI API 重新啟用。');
  };

  if (!firebaseReady) {
    return (
      <div className="container">
        <h1>{appTitle}</h1>
        <div className="card">
          <h2>需要完成 Firebase 設定</h2>
          <p>目前頁面不是壞掉，而是偵測到 Firebase 環境變數尚未填寫。</p>
          <p>缺少：</p>
          <ul>
            {missingFirebaseEnv.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
          <p>請到 Vercel → Project Settings → Environment Variables 補上 VITE_FIREBASE_* 後 redeploy。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>{appTitle}</h1>
      <p>EcoPal repo 已完成 Vercel + Firebase hardened scaffold。</p>
      <p>App ID：{appId}</p>

      <div className="card">
        <h2>目前狀態</h2>
        <ul>
          <li>✅ Vite React 專案已建立</li>
          <li>✅ Firebase 讀取 VITE_* 環境變數</li>
          <li>✅ OpenAI key 僅保留伺服器端（Vercel env）</li>
          <li>⏸ AI 進化功能暫時關閉（可稍後啟用）</li>
        </ul>
      </div>

      <button onClick={onTryEvolution}>嘗試 AI 進化</button>
      {featureMsg ? <p className="notice">{featureMsg}</p> : null}
    </div>
  );
}

export default App;
