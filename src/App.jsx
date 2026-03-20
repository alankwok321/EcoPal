import React, { useState, useEffect, useRef } from 'react';
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  collection,
  onSnapshot,
  doc,
  serverTimestamp,
  setDoc,
  getDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  Leaf,
  Settings,
  Bell,
  Heart,
  Zap,
  Utensils,
  LifeBuoy,
  Sparkles,
  PawPrint,
  ShoppingCart,
  Users,
  Bus,
  Footprints,
  Lightbulb,
  Recycle,
  Receipt,
  Shirt,
  UtensilsCrossed,
  Snowflake,
  ShoppingBag,
  QrCode,
  Coffee,
  TreePine,
  Zap as ZapIcon,
  CheckCircle,
  Camera,
  Image as ImageIcon,
  Flame,
  Coins,
  MessageSquare,
  Trophy,
  Medal,
} from 'lucide-react';
import { appId, auth, db, firebaseReady, missingFirebaseEnv } from './firebase';

// --- Data Constants ---
const ACTS = [
  { n: '綠色出行', v: 0.8, c: 40, i: Bus, needPic: true },
  { n: '徒步通勤', v: 0.5, c: 30, i: Footprints, needPic: false },
  { n: '環保餐具', v: 0.1, c: 15, i: Utensils, needPic: true },
  { n: '隨手關燈', v: 0.05, c: 5, i: Lightbulb, needPic: false },
  { n: '垃圾分類', v: 0.1, c: 10, i: Recycle, needPic: true },
  { n: '無紙發票', v: 0.02, c: 5, i: Receipt, needPic: false },
  { n: '舊物重用', v: 1.5, c: 100, i: Shirt, needPic: true },
  { n: '低碳蔬食', v: 0.7, c: 50, i: UtensilsCrossed, needPic: true },
  { n: '空調調至26度', v: 0.2, c: 20, i: Snowflake, needPic: false },
  { n: '自備膠袋', v: 0.1, c: 10, i: ShoppingBag, needPic: true },
];

const SHOP_ITEMS = [
  { n: '電子乘車代金券', p: 200, i: QrCode, col: 'text-blue-400', bg: 'bg-[#2A4B3A]' },
  { n: '環保竹製隨行杯', p: 500, i: Coffee, col: 'text-orange-400', bg: 'bg-[#2A4B3A]' },
  { n: '沙漠植樹認養', p: 3000, i: TreePine, col: 'text-green-400', bg: 'bg-[#2A4B3A]' },
  { n: '家庭節能折抵券', p: 800, i: ZapIcon, col: 'text-yellow-400', bg: 'bg-[#2A4B3A]' },
  { n: '再生材料帆布袋', p: 300, i: ShoppingBag, col: 'text-amber-500', bg: 'bg-[#2A4B3A]' },
  { n: '智慧LED感應燈', p: 150, i: Lightbulb, col: 'text-yellow-300', bg: 'bg-[#2A4B3A]' },
];

const FOOD_ITEMS = [
  { n: '有機蘋果', cost: 10, energy: 15, exp: 1.0, icon: '🍎' },
  { n: '本地胡蘿蔔', cost: 20, energy: 25, exp: 2.0, icon: '🥕' },
  { n: '低碳燕麥', cost: 35, energy: 40, exp: 4.0, icon: '🌾' },
  { n: '植物肉排', cost: 60, energy: 70, exp: 7.5, icon: '🥩' },
];

const BACKGROUND_THEMES = [
  {
    id: 0,
    name: '翠綠平原',
    bgClass: 'from-[#1C3626] via-[#2A4D3A] to-[#6BBF8C]',
    imgUrl:
      'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 1,
    name: '星空原野',
    bgClass: 'from-[#0B1021] via-[#162238] to-[#2C4167]',
    imgUrl:
      'https://images.unsplash.com/photo-1519681393784-d120267933ba?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 2,
    name: '夕陽沙丘',
    bgClass: 'from-[#4A2511] via-[#8C4A28] to-[#E58C44]',
    imgUrl:
      'https://images.unsplash.com/photo-1509316785289-025f5b846b35?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
  },
];

const LOCAL_STATE_KEY = 'ecoPet_local_state_v1';

const removeBackgroundByFloodFill = (base64Url) =>
  new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxSize = 512;
      let w = img.width;
      let h = img.height;
      if (w > maxSize || h > maxSize) {
        const ratio = Math.min(maxSize / w, maxSize / h);
        w = Math.floor(w * ratio);
        h = Math.floor(h * ratio);
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      const { data } = imageData;
      const bgR = data[0];
      const bgG = data[1];
      const bgB = data[2];
      const tolerance = 45;
      const isBg = (i) =>
        Math.abs(data[i] - bgR) < tolerance &&
        Math.abs(data[i + 1] - bgG) < tolerance &&
        Math.abs(data[i + 2] - bgB) < tolerance &&
        data[i + 3] > 0;
      const stack = [
        [0, 0],
        [w - 1, 0],
        [0, h - 1],
        [w - 1, h - 1],
      ];
      const visited = new Uint8Array(w * h);

      while (stack.length > 0) {
        const [x, y] = stack.pop();
        const idx = y * w + x;
        if (x < 0 || x >= w || y < 0 || y >= h || visited[idx]) continue;
        visited[idx] = 1;
        const pIdx = idx * 4;
        if (isBg(pIdx)) {
          data[pIdx + 3] = 0;
          stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = base64Url;
  });

const fetchWithRetry = async (url, options, retries = 4, delay = 800) => {
  for (let i = 0; i < retries; i += 1) {
    try {
      const res = await fetch(url, options);
      const text = await res.text();
      if (!res.ok) throw new Error(text || `HTTP error! status: ${res.status}`);
      return text ? JSON.parse(text) : {};
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, delay));
      delay *= 2;
    }
  }
  return {};
};

const compressImageDataUrl = (dataUrl, maxSize = 1024, quality = 0.75) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (w > maxSize || h > maxSize) {
        const ratio = Math.min(maxSize / w, maxSize / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });

export default function App() {
  const usingFirebase = firebaseReady;
  const [showSplash, setShowSplash] = useState(true);
  const [idx, setIdx] = useState(0);
  const [carb, setCarb] = useState(0.0);
  const [coin, setCoin] = useState(500);
  const [doneToday, setDoneToday] = useState({});
  const [log, setLog] = useState(['系統：歡迎來到綠碳星球！']);

  const [petName, setPetName] = useState('小樹籽');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');

  const level = Math.floor(carb / 10) + 1;
  const currentExp = carb % 10;
  const expToNextLevel = 10;

  const [petImage, setPetImage] = useState(null);
  const [petImageLevel, setPetImageLevel] = useState(1);
  const [isEvolving, setIsEvolving] = useState(false);
  const [evolutionHistory, setEvolutionHistory] = useState([{ level: 1, imageUrl: null }]);
  const [bgIdx, setBgIdx] = useState(0);

  const nextEvolutionLevel = petImageLevel < 5 ? 5 : Math.floor(petImageLevel / 5) * 5 + 5;
  const canEvolve = level >= nextEvolutionLevel;

  const [health, setHealth] = useState(80);
  const [energy, setEnergy] = useState(90);

  const [user, setUser] = useState(() =>
    usingFirebase ? null : { uid: 'local', isAnonymous: true }
  );
  const [isAuthReady, setIsAuthReady] = useState(() => !usingFirebase);
  const [isLoaded, setIsLoaded] = useState(false);

  // UI狀態：是否強制顯示登入畫面
  const [forceShowLogin, setForceShowLogin] = useState(() => {
    if (!usingFirebase) return false;
    try {
      return localStorage.getItem('ecoPet_hasPassedLogin') !== 'true';
    } catch (e) {
      return true;
    }
  });

  const [posts, setPosts] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [communityTab, setCommunityTab] = useState('feed');

  const [toast, setToast] = useState(null);
  const [cameraTask, setCameraTask] = useState(null);
  const [ticketItem, setTicketItem] = useState(null);
  const [isFeedMenuOpen, setIsFeedMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [userName, setUserName] = useState(() => {
    try {
      return localStorage.getItem('ecoPetUserName') || '';
    } catch (e) {
      return '';
    }
  });

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const getDisplayUserName = () => {
    if (userName.trim()) return userName.trim();
    if (user && user.uid) return `綠星人_${user.uid.substring(0, 4)}`;
    return '匿名環保者';
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  // 1. Firebase Auth 初始化
  useEffect(() => {
    if (!usingFirebase || !auth) return undefined;

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Auth init error:', error);
      }
    };

    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, [usingFirebase]);

  // 2. 讀取雲端/本地進度
  useEffect(() => {
    if (!isAuthReady || !user) return;

    const loadLocal = () => {
      try {
        const raw = localStorage.getItem(LOCAL_STATE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
      } catch (e) {
        return null;
      }
    };

    const applyData = (data) => {
      setCarb(data?.carb ?? 0.0);
      setCoin(data?.coin ?? 500);
      setPetName(data?.petName || '小樹籽');
      setUserName(data?.userName || '');
      setPetImage(data?.petImage || null);
      setPetImageLevel(data?.petImageLevel || 1);
      setEvolutionHistory(data?.evolutionHistory || [{ level: 1, imageUrl: null }]);
      setHealth(data?.health ?? 80);
      setEnergy(data?.energy ?? 90);
      setBgIdx(data?.bgIdx ?? 0);
      if (data?.lastPlayDate === new Date().toDateString()) {
        setDoneToday(data?.doneToday || {});
      } else {
        setDoneToday({});
      }
    };

    const loadGame = async () => {
      try {
        if (!usingFirebase || !db) {
          const local = loadLocal();
          applyData(local);
          return;
        }
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'game_state', 'main');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          applyData(docSnap.data());
        } else {
          applyData(null);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Load failed:', e);
      } finally {
        setIsLoaded(true);
      }
    };

    loadGame();
  }, [isAuthReady, user, usingFirebase]);

  // 3. 背景自動存檔
  useEffect(() => {
    if (!isAuthReady || !user || !isLoaded) return;

    const saveLocal = (payload) => {
      try {
        localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(payload));
      } catch (e) {
        // ignore
      }
    };

    const saveGame = async () => {
      const payload = {
        carb,
        coin,
        petName,
        userName,
        petImage,
        petImageLevel,
        evolutionHistory,
        health,
        energy,
        doneToday,
        bgIdx,
        lastPlayDate: new Date().toDateString(),
      };

      if (!usingFirebase || !db || user?.isAnonymous) {
        saveLocal(payload);
        return;
      }

      try {
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'game_state', 'main');
        await setDoc(
          docRef,
          {
            ...payload,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Save failed:', e);
      }
    };

    const timeoutId = setTimeout(saveGame, 1500);
    return () => clearTimeout(timeoutId);
  }, [
    isAuthReady,
    user,
    isLoaded,
    carb,
    coin,
    petName,
    userName,
    petImage,
    petImageLevel,
    evolutionHistory,
    health,
    energy,
    doneToday,
    bgIdx,
    usingFirebase,
  ]);

  // 4. 同步全球動態
  useEffect(() => {
    if (!isAuthReady || !user || !usingFirebase || !db) return undefined;
    const postsRef = collection(db, 'artifacts', appId, 'public', 'data', 'communityPosts');
    const unsubscribe = onSnapshot(
      postsRef,
      (snapshot) => {
        const fetchedPosts = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        fetchedPosts.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        setPosts(fetchedPosts);
      },
      (error) => console.error('Firestore error:', error)
    );
    return () => unsubscribe();
  }, [isAuthReady, user, usingFirebase]);

  // 5. 同步排行榜（匿名可讀、不可寫）
  useEffect(() => {
    if (!isAuthReady || !user || !usingFirebase || !db) return undefined;
    const lbRef = collection(db, 'artifacts', appId, 'public', 'data', 'leaderboard');
    const unsubscribe = onSnapshot(
      lbRef,
      (snapshot) => {
        const fetchedLb = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        fetchedLb.sort((a, b) => b.level - a.level);
        setLeaderboard(fetchedLb);
      },
      (error) => console.error('Leaderboard fetch error:', error)
    );
    return () => unsubscribe();
  }, [isAuthReady, user, usingFirebase]);

  // 6. 更新自身排行榜進度（僅非匿名帳號）
  useEffect(() => {
    if (!isAuthReady || !user || !isLoaded || !usingFirebase || !db || user.isAnonymous) return;
    const syncMyLevel = async () => {
      try {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'leaderboard', user.uid);
        const colors = ['bg-blue-600', 'bg-pink-600', 'bg-red-600', 'bg-purple-600', 'bg-teal-600'];
        const userColor = colors[user.uid.charCodeAt(0) % colors.length];

        await setDoc(
          docRef,
          {
            userId: user.uid,
            userName: getDisplayUserName(),
            petName: petName,
            level: level,
            coin: coin,
            userColor: userColor,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (e) {
        console.error('Failed to sync level to leaderboard:', e);
      }
    };
    syncMyLevel();
  }, [isAuthReady, user, isLoaded, level, petName, userName, coin, usingFirebase]);

  // --- 混合 Auth Handlers (相容兩種設定) ---
  const handleEmailLogin = async () => {
    setLoginError('');
    if (usingFirebase && auth) {
      try {
        await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
        showToast('登入成功！');
      } catch (error) {
        setLoginError('登入失敗，帳號或密碼錯誤。');
      }
    } else {
      const mockE = localStorage.getItem('ecoPet_mock_email');
      const mockP = localStorage.getItem('ecoPet_mock_pwd');
      if (loginEmail === mockE && loginPassword === mockP && loginEmail !== '') {
        try {
          localStorage.setItem('ecoPet_hasPassedLogin', 'true');
        } catch (e) {
          // ignore
        }
        setForceShowLogin(false);
        showToast('登入成功！');
      } else {
        setLoginError('登入失敗，帳號或密碼錯誤。');
      }
    }
  };

  const handleEmailSignUp = async () => {
    if (loginPassword.length < 6) return setLoginError('密碼需至少 6 個字元');
    setLoginError('');
    if (usingFirebase && auth) {
      try {
        await createUserWithEmailAndPassword(auth, loginEmail, loginPassword);
        showToast('註冊成功！');
      } catch (error) {
        setLoginError(
          error.code === 'auth/email-already-in-use' ? '信箱已被註冊，請直接登入' : '註冊失敗，請確認格式。'
        );
      }
    } else {
      try {
        localStorage.setItem('ecoPet_mock_email', loginEmail);
        localStorage.setItem('ecoPet_mock_pwd', loginPassword);
        localStorage.setItem('ecoPet_hasPassedLogin', 'true');
      } catch (e) {
        // ignore
      }
      setForceShowLogin(false);
      showToast('註冊成功！');
    }
  };

  const handleGuestLogin = async () => {
    setLoginError('');
    if (usingFirebase && auth) {
      try {
        await signInAnonymously(auth);
        showToast('以訪客身分開始遊玩！');
      } catch (error) {
        setLoginError('訪客登入失敗');
      }
    } else {
      try {
        localStorage.setItem('ecoPet_hasPassedLogin', 'true');
      } catch (e) {
        // ignore
      }
      setForceShowLogin(false);
      showToast('以訪客身分開始遊玩！');
    }
  };

  const handleLogout = async () => {
    if (usingFirebase && auth) {
      try {
        await signOut(auth);
      } catch (e) {
        // ignore
      }
    } else {
      try {
        localStorage.setItem('ecoPet_hasPassedLogin', 'false');
      } catch (e) {
        // ignore
      }
      setForceShowLogin(true);
    }
    setIsSettingsOpen(false);
    showToast('已登出');
  };

  const completeAct = (actIdx) => {
    const act = ACTS[actIdx];
    const newCarb = parseFloat((carb + act.v).toFixed(2));
    const oldLevel = Math.floor(carb / 10) + 1;
    const newLevel = Math.floor(newCarb / 10) + 1;

    setCarb(newCarb);
    setCoin((prev) => prev + act.c);
    setDoneToday((prev) => ({ ...prev, [act.n]: true }));
    setLog((prev) => [`完成 [${act.n}]，獲取 ${act.v} 經驗值`, ...prev]);

    if (newLevel > oldLevel) {
      showToast(`🎉 恭喜！${petName} 升到了等級 ${newLevel}！`);
    } else {
      showToast(`成功獲得 ${act.c} 碳幣與經驗值！`);
    }
  };

  const handleAct = (actIdx) => {
    const act = ACTS[actIdx];
    if (doneToday[act.n]) return showToast('這項任務今天已經做過囉！');
    if (act.needPic) setCameraTask(actIdx);
    else completeAct(actIdx);
  };

  const handleBuy = (itemIdx) => {
    const item = SHOP_ITEMS[itemIdx];
    if (coin >= item.p) {
      setCoin((prev) => prev - item.p);
      setTicketItem(item.n);
    } else {
      showToast('碳幣不足！');
    }
  };

  const handleShareAchievement = async () => {
    if (!usingFirebase) return showToast('社群功能需要 Firebase 設定');
    if (!isAuthReady || !user) return showToast('請稍候，正在連線至社群...');
    const msg =
      log[0] && log[0].includes('完成')
        ? log[0].substring(3)
        : '今日環保達標！剛完成了一項綠色行動！';
    const colors = ['bg-blue-600', 'bg-pink-600', 'bg-red-600', 'bg-purple-600', 'bg-teal-600'];
    const userColor = colors[user.uid.charCodeAt(0) % colors.length];

    try {
      const postRef = doc(db, 'artifacts', appId, 'public', 'data', 'communityPosts', user.uid);
      await setDoc(postRef, {
        userId: user.uid,
        userName: getDisplayUserName(),
        userColor: userColor,
        text: msg,
        sparks: 0,
        sparkedBy: [],
        createdAt: serverTimestamp(),
      });
      showToast('已分享至全球動態！');
    } catch (e) {
      console.error(e);
      showToast('分享失敗，請稍後再試。');
    }
  };

  const handleSpark = async (post) => {
    if (!usingFirebase) return showToast('社群功能需要 Firebase 設定');
    if (!isAuthReady || !user) return;
    if (post.sparkedBy && post.sparkedBy.includes(user.uid)) {
      return showToast('你已經給過火花了！');
    }
    try {
      const postRef = doc(db, 'artifacts', appId, 'public', 'data', 'communityPosts', post.id);
      await updateDoc(postRef, {
        sparks: (post.sparks || 0) + 1,
        sparkedBy: [...(post.sparkedBy || []), user.uid],
      });
      showToast('點燃火花 🔥');
    } catch (e) {
      console.error('Spark error:', e);
      showToast('已點燃火花 (僅本地效果)');
    }
  };

  const evolvePet = async (targetLevel) => {
    setIsEvolving(true);
    showToast('✨ AI 正在施展魔法生成新形態，請稍候...');
    try {
      let stageDesc = '';
      if (targetLevel < 5) stageDesc = 'tiny cute seed';
      else if (targetLevel < 10) stageDesc = 'cute tiny plant sprout';
      else if (targetLevel < 15) stageDesc = 'cute young sapling tree';
      else if (targetLevel < 20) stageDesc = 'cute vibrant small tree';
      else if (targetLevel < 25) stageDesc = 'cute lush mature tree';
      else stageDesc = 'massive majestic cute ancient tree';

      const prompt = `A ${stageDesc} character with a kawaii face, small black dot eyes, and pink blush on cheeks. Color palette must be: warm tan, rust red, and bright green. Strict flat 2D vector illustration style, simple solid colors, no gradients, no 3D rendering, cute indie game asset style, isolated character only, pure transparent background (alpha channel), completely blank background without any color or scenery, no white background. Level ${targetLevel} evolution.`;

      const data = await fetchWithRetry('/api/ai-evolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (data && data.imageBase64) {
        const rawImageUrl = `data:image/png;base64,${data.imageBase64}`;
        const transparentImageUrl = await removeBackgroundByFloodFill(rawImageUrl);

        setPetImage(transparentImageUrl);
        setPetImageLevel(targetLevel);

        setEvolutionHistory((prev) => {
          const filtered = prev.filter((h) => h.level !== targetLevel);
          return [...filtered, { level: targetLevel, imageUrl: transparentImageUrl }].sort(
            (a, b) => a.level - b.level
          );
        });

        showToast(`✨ 進化成功！${petName} 獲得了新形態！`);
      } else {
        throw new Error('No prediction returned');
      }
    } catch (e) {
      console.error('Evolution error:', e);
      showToast('AI 進化尚未啟用（請設定伺服器端金鑰）');
    } finally {
      setIsEvolving(false);
    }
  };

  const handleFeed = (food) => {
    if (coin < food.cost) return showToast('碳幣不足！多解任務賺取碳幣吧');
    setCoin((prev) => prev - food.cost);
    setEnergy(Math.min(100, energy + food.energy));

    const newCarb = parseFloat((carb + food.exp).toFixed(2));
    const oldLevel = Math.floor(carb / 10) + 1;
    const newLevel = Math.floor(newCarb / 10) + 1;

    setCarb(newCarb);
    setIsFeedMenuOpen(false);

    if (newLevel > oldLevel) showToast(`🎉 恭喜！${petName} 升到了等級 ${newLevel}！`);
    else showToast(`你餵食了${food.n}！花費 ${food.cost} 幣 (+${food.exp} 經驗值)`);
  };

  const interactPet = (type) => {
    let expGain = 0;
    let msg = '';
    if (type === 'play') {
      if (energy < 20) return showToast(`能量不足！${petName}累了，請先餵食恢復能量。`);
      setEnergy(Math.max(0, energy - 20));
      setHealth(Math.min(100, health + 10));
      expGain = 2.0;
      msg = `${petName}玩得很開心！消耗 20 能量 (+2.0 經驗值)`;
    }
    if (type === 'clean') {
      setHealth(Math.min(100, health + 20));
      expGain = 1.5;
      msg = `幫${petName}梳洗，變得香噴噴了！恢復健康 (+1.5 經驗值)`;
    }

    const newCarb = parseFloat((carb + expGain).toFixed(2));
    const oldLevel = Math.floor(carb / 10) + 1;
    const newLevel = Math.floor(newCarb / 10) + 1;

    setCarb(newCarb);
    if (newLevel > oldLevel) showToast(`🎉 恭喜！${petName} 升到了等級 ${newLevel}！`);
    else showToast(msg);
  };

  // --- Global Styles ---
  const GlobalStyle = () => (
    <style
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: `
 .pb-safe { padding-bottom: max(env(safe-area-inset-bottom), 16px); }
 @keyframes slide-right { 0% { transform: translateX(0%); } 100% { transform: translateX(100%); } }
 @keyframes slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
 .animate-slide-up { animation: slide-up 0.8s ease-out forwards; }
 @keyframes zoom-in { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
 .animate-zoom-in { animation: zoom-in 0.2s forwards; }
 @keyframes fade-in-down { 
 0% { opacity: 0; transform: translate(-50%, -20px); } 10% { opacity: 1; transform: translate(-50%, 0); }
 90% { opacity: 1; transform: translate(-50%, 0); } 100% { opacity: 0; transform: translate(-50%, -20px); }
 }
 .animate-fade-in-down { animation: fade-in-down 2.5s forwards; }
 .animate-spin-slow { animation: spin 8s linear infinite; }
 @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
 .animate-bounce-slow { animation: bounce 3s ease-in-out infinite; }
 @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
 @keyframes float-cloud { 0% { transform: translateX(-150px); } 100% { transform: translateX(500px); } }
 `,
      }}
    />
  );

  // --- Views ---
  if (showSplash) {
    return (
      <div className="max-w-md mx-auto h-screen bg-[#1C3626] flex flex-col items-center justify-center relative shadow-2xl overflow-hidden bg-gradient-to-b from-[#2A4D3A] to-[#1C3626] font-sans">
        <div className="w-32 h-32 bg-[#A1D09A]/10 rounded-full flex items-center justify-center animate-pulse mb-6 shadow-[0_0_50px_rgba(161,208,154,0.2)] border border-[#365D43]">
          <Leaf size={60} className="text-[#A1D09A] animate-bounce-slow" fill="currentColor" />
        </div>
        <h1 className="text-3xl font-bold text-white tracking-widest mb-3 flex items-center gap-2 animate-slide-up">
          綠碳星球 <Sparkles size={24} className="text-[#E5A744] animate-spin-slow" />
        </h1>
        <p className="text-[#A1D09A] text-sm font-medium tracking-wider animate-pulse opacity-80">正在啟動綠色星球...</p>
        <div className="absolute top-[-10%] left-[-20%] w-64 h-64 bg-white opacity-5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-5%] right-[-10%] w-48 h-48 bg-[#A1D09A] opacity-10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10">
          <div className="w-12 h-1.5 bg-[#2A4B3A] rounded-full overflow-hidden">
            <div className="h-full bg-[#A1D09A] w-1/2 animate-[slide-right_1s_ease-in-out_infinite_alternate] rounded-full" />
          </div>
        </div>
        <GlobalStyle />
      </div>
    );
  }

  if (!isAuthReady) {
    return (
      <div className="max-w-md mx-auto h-screen bg-[#1C3626] flex flex-col items-center justify-center font-sans">
        <div className="w-12 h-12 border-4 border-[#A1D09A] border-t-transparent rounded-full animate-spin" />
        <GlobalStyle />
      </div>
    );
  }

  const needsLogin = usingFirebase ? !user : forceShowLogin;

  if (needsLogin) {
    return (
      <div className="max-w-md mx-auto h-screen bg-[#1C3626] flex flex-col items-center justify-center relative shadow-2xl px-8 font-sans overflow-hidden">
        <div className="absolute top-[-10%] left-[-20%] w-64 h-64 bg-white opacity-5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-5%] right-[-10%] w-48 h-48 bg-[#A1D09A] opacity-10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-24 h-24 bg-[#A1D09A]/10 rounded-full flex items-center justify-center mb-6 border border-[#365D43] shadow-lg z-10">
          <Leaf size={40} className="text-[#A1D09A]" fill="currentColor" />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-widest mb-2 flex items-center gap-2 z-10 animate-slide-up">
          登入綠碳星球
        </h1>
        {!usingFirebase && (
          <p className="text-xs text-[#567E63] mb-6">本地模式：未設定 Firebase，社群功能將暫停</p>
        )}

        <div className="w-full bg-[#162C1E] p-6 rounded-2xl border border-[#365D43] shadow-inner z-10 animate-zoom-in">
          <input
            type="email"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            placeholder="信箱 (Email)"
            className="w-full bg-[#1C3626] text-white border border-[#2A4B3A] rounded-xl px-4 py-3 outline-none focus:border-[#A1D09A] transition-colors mb-3 text-sm"
          />
          <input
            type="password"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            placeholder="密碼 (Password)"
            className="w-full bg-[#1C3626] text-white border border-[#2A4B3A] rounded-xl px-4 py-3 outline-none focus:border-[#A1D09A] transition-colors mb-2 text-sm"
          />
          {loginError && <p className="text-red-400 text-xs mb-3 text-center">{loginError}</p>}

          <div className="flex gap-3 mt-4">
            <button
              onClick={handleEmailLogin}
              className="flex-1 bg-[#2A4B3A] text-white py-3 rounded-xl text-sm font-bold active:scale-95 transition-transform border border-[#365D43] hover:bg-[#365D43]"
            >
              登入
            </button>
            <button
              onClick={handleEmailSignUp}
              className="flex-1 bg-[#529940] text-white py-3 rounded-xl text-sm font-bold active:scale-95 transition-transform shadow-md"
            >
              註冊
            </button>
          </div>
        </div>

        <div className="relative w-full mt-8 mb-4 flex items-center justify-center z-10">
          <div className="absolute w-full h-px bg-[#365D43]" />
          <span className="bg-[#1C3626] px-4 text-[#567E63] text-xs font-bold relative z-10">或者</span>
        </div>

        <button
          onClick={handleGuestLogin}
          className="w-full bg-transparent text-[#A1D09A] py-3 rounded-xl text-sm font-bold active:scale-95 transition-transform border border-[#A1D09A] hover:bg-[#A1D09A]/10 z-10 shadow-lg"
        >
          訪客遊玩(免登入)
        </button>

        {toast && (
          <div className="absolute top-[40px] bg-[#529940] text-white px-6 py-3 rounded-full z-50 text-sm font-bold border-2 border-[#A1D09A] animate-fade-in-down whitespace-nowrap">
            {toast}
          </div>
        )}
        <GlobalStyle />
      </div>
    );
  }

  const renderHeader = (title, subtitle) => (
    <div className="bg-[#1C3626] text-white px-5 pt-8 pb-3 flex justify-between items-center shadow-md border-b border-[#2A4B3A] shrink-0">
      <div className="flex flex-col items-start">
        <h1 className="text-xl font-bold tracking-wide text-[#A1D09A]">{title}</h1>
        <p className="text-gray-400 text-xs mt-1">{subtitle}</p>
      </div>
      <div className="flex items-center gap-1.5 bg-[#2A4B3A] px-2.5 py-1 rounded-full border border-[#365D43] shadow-inner">
        <Coins size={14} className="text-[#E5A744]" />
        <span className="text-white font-bold text-sm">{coin}</span>
      </div>
    </div>
  );

  const getPetSizeClasses = (lvl) => {
    if (lvl < 5) return 'h-[35%] max-h-[140px]';
    if (lvl < 10) return 'h-[45%] max-h-[180px]';
    if (lvl < 15) return 'h-[50%] max-h-[200px]';
    if (lvl < 20) return 'h-[55%] max-h-[220px]';
    if (lvl < 25) return 'h-[60%] max-h-[250px] origin-center';
    return 'h-[65%] max-h-[270px] origin-center';
  };

  const DefaultSeedSVG = () => (
    <svg viewBox="0 0 200 200" className={`w-auto ${getPetSizeClasses(1)} drop-shadow-2xl z-10 animate-bounce-slow transition-all duration-1000`}>
      <circle cx="100" cy="110" r="45" fill="#A1D09A" opacity="0.2" filter="blur(10px)" />
      <path d="M 100 150 C 70 150, 70 90, 100 70 C 130 90, 130 150, 100 150 Z" fill="#E8B478" />
      <path d="M 100 150 C 85 150, 85 100, 100 70 C 115 100, 115 150, 100 150 Z" fill="#C0502D" opacity="0.4" />
      <circle cx="85" cy="120" r="6" fill="#1A3A2A" />
      <circle cx="87" cy="118" r="2" fill="#FFF" />
      <circle cx="115" cy="120" r="6" fill="#1A3A2A" />
      <circle cx="117" cy="118" r="2" fill="#FFF" />
      <path d="M 95 130 Q 100 135 105 130" stroke="#1A3A2A" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="75" cy="125" r="5" fill="#E56E8E" opacity="0.6" />
      <circle cx="125" cy="125" r="5" fill="#E56E8E" opacity="0.6" />
      <path d="M 100 70 Q 90 50 110 40" fill="none" stroke="#69B34C" strokeWidth="4" strokeLinecap="round" />
      <path d="M 110 40 Q 120 40 120 30 Q 110 30 110 40" fill="#529940" />
      <circle cx="60" cy="80" r="3" fill="#FFF" />
      <circle cx="140" cy="100" r="4" fill="#FFF" />
      <circle cx="100" cy="30" r="2" fill="#FFF" />
    </svg>
  );

  const renderBackgroundLayers = () => {
    const theme = BACKGROUND_THEMES[bgIdx] || BACKGROUND_THEMES[0];

    return (
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <img src={theme.imgUrl} alt={theme.name} className="absolute inset-0 w-full h-full object-cover opacity-80 mix-blend-overlay" />
        {bgIdx === 0 && (
          <>
            <div className="absolute top-16 right-10 w-32 h-32 bg-[#E5A744]/30 rounded-full blur-2xl" />
            <div
              className="absolute top-20 left-[-50px] w-32 h-8 bg-white/20 rounded-full blur-sm"
              style={{ animation: 'float-cloud 30s linear infinite' }}
            />
            <div
              className="absolute top-32 left-[-100px] w-48 h-10 bg-white/10 rounded-full blur-md"
              style={{ animation: 'float-cloud 45s linear infinite 10s' }}
            />
          </>
        )}
        {bgIdx === 1 && (
          <>
            <div className="absolute top-10 left-1/4 w-1 h-1 bg-white rounded-full animate-pulse" />
            <div
              className="absolute top-24 left-1/2 w-1.5 h-1.5 bg-white rounded-full animate-pulse"
              style={{ animationDelay: '1s' }}
            />
            <div
              className="absolute top-16 right-1/4 w-1 h-1 bg-white rounded-full animate-pulse"
              style={{ animationDelay: '0.5s' }}
            />
            <div
              className="absolute top-32 right-12 w-1.5 h-1.5 bg-white rounded-full animate-pulse"
              style={{ animationDelay: '1.5s' }}
            />
          </>
        )}
        {bgIdx === 2 && (
          <>
            <div className="absolute top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#FFD700]/20 rounded-full blur-2xl" />
            <div
              className="absolute top-16 left-[-50px] w-32 h-6 bg-[#FFBEB2]/30 rounded-full blur-sm"
              style={{ animation: 'float-cloud 40s linear infinite' }}
            />
          </>
        )}
        <div className="absolute bottom-0 w-full h-[50%] bg-gradient-to-t from-[#1C3626] to-transparent" />
      </div>
    );
  };

  const renderPetHome = () => (
    <div className="flex flex-col h-full overflow-hidden pb-24 bg-[#1C3626]">
      <div
        className={`relative w-full h-[65%] shrink-0 rounded-b-[40px] overflow-hidden bg-gradient-to-b ${BACKGROUND_THEMES[bgIdx].bgClass} flex flex-col shadow-2xl z-10 border-b-[4px] border-[#122418] transition-colors duration-1000`}
      >
        {renderBackgroundLayers()}

        <div className="relative flex justify-center items-start pt-8 pb-2 z-20 w-full min-h-[80px]">
          <div className="absolute left-4 top-8 flex items-center gap-1.5 pt-1">
            <Leaf size={20} className="text-[#A1D09A]" fill="currentColor" />
            <span className="font-bold text-sm text-white hidden sm:block">綠碳星球</span>
          </div>
          <div className="flex flex-col items-center">
            {isEditingName ? (
              <input
                autoFocus
                className="text-[#1C3626] text-center font-bold text-sm rounded px-1 w-20 outline-none border-2 border-[#A1D09A]"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onBlur={() => {
                  setPetName(tempName.trim() || petName);
                  setIsEditingName(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setPetName(tempName.trim() || petName);
                    setIsEditingName(false);
                  }
                }}
              />
            ) : (
              <div
                className="flex items-center gap-1 cursor-pointer active:opacity-70"
                onClick={() => {
                  setTempName(petName);
                  setIsEditingName(true);
                }}
              >
                <span className="font-bold text-lg drop-shadow-md text-white tracking-wide">{petName}</span>
              </div>
            )}
            <div className="flex flex-col items-center mt-1">
              <span className="text-[11px] text-[#A1D09A] font-bold tracking-wide leading-none drop-shadow-md">
                等級 {level}
              </span>
              <div className="w-20 bg-[#162C1E]/60 h-1.5 rounded-full overflow-hidden mt-1.5 backdrop-blur-sm border border-[#365D43]/50">
                <div
                  className="bg-[#A1D09A] h-full transition-all duration-500 shadow-[0_0_5px_#A1D09A]"
                  style={{ width: `${(currentExp / expToNextLevel) * 100}%` }}
                />
              </div>
            </div>
          </div>
          <div className="absolute right-4 top-8 flex items-center gap-2 text-[#99B79F] pt-1">
            <div className="flex items-center gap-1 bg-[#162C1E]/60 backdrop-blur-sm px-2 py-0.5 rounded-full border border-[#365D43]/50 shadow-inner">
              <Coins size={12} className="text-[#E5A744]" />
              <span className="text-white font-bold text-xs">{coin}</span>
            </div>
            <Settings size={18} className="cursor-pointer active:text-white drop-shadow-md ml-1" onClick={() => setIsSettingsOpen(true)} />
            <Bell size={18} className="cursor-pointer active:text-white drop-shadow-md" />
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center items-center w-full relative z-10">
          {isEvolving ? (
            <div className="w-32 h-32 flex flex-col items-center justify-center z-10 rounded-full bg-[#A1D09A]/20 animate-pulse border-4 border-[#A1D09A] shadow-[0_0_40px_rgba(161,208,154,0.6)]">
              <Sparkles className="w-10 h-10 text-[#E5A744] animate-spin-slow mb-1" />
              <p className="text-white font-bold text-xs">AI 進化中...</p>
            </div>
          ) : petImage ? (
            <img
              src={petImage}
              className={`w-auto ${getPetSizeClasses(petImageLevel)} object-contain drop-shadow-[0_0_30px_rgba(161,208,154,0.5)] z-10 animate-bounce-slow transition-all duration-1000`}
              alt="進化寵物"
            />
          ) : (
            <DefaultSeedSVG />
          )}
          {!isEvolving && canEvolve && (
            <button
              onClick={() => evolvePet(nextEvolutionLevel)}
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30 bg-gradient-to-r from-[#E5A744] to-[#E56E8E] text-white font-bold py-2.5 px-5 rounded-full shadow-[0_0_20px_rgba(229,167,68,0.8)] animate-pulse flex items-center gap-2 border-2 border-white transition-transform active:scale-95 whitespace-nowrap text-sm"
            >
              <Sparkles size={18} /> 啟動 AI 進化 (等級 {nextEvolutionLevel})
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-evenly px-5 py-2 z-20">
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-center mr-4">
            <div className="w-12 h-12 bg-[#2A4B3A] rounded-full flex items-center justify-center border-2 border-[#529940] shadow-md relative overflow-hidden">
              <span className="text-2xl drop-shadow-md">{health < 40 ? '😢' : energy < 40 ? '😴' : '❤️'}</span>
            </div>
            <span className="text-gray-300 text-[10px] mt-1 font-bold">心情</span>
          </div>

          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <Heart size={16} className="text-[#E56E8E]" fill="currentColor" />
              <div className="h-2.5 w-full bg-[#1A3A2A] rounded-full overflow-hidden border border-[#2A4B3A] shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-[#E56E8E] to-[#FF8FA3] rounded-full transition-all duration-500"
                  style={{ width: `${health}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Zap size={16} className="text-[#E5A744]" fill="currentColor" />
              <div className="h-2.5 w-full bg-[#1A3A2A] rounded-full overflow-hidden border border-[#2A4B3A] shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-[#E5A744] to-[#FFC857] rounded-full transition-all duration-500"
                  style={{ width: `${energy}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-around mt-2">
          {[
            { n: '餵食', c: 'bg-gradient-to-b from-[#E5A744] to-[#D49333]', i: Utensils, a: 'feed' },
            { n: '遊玩', c: 'bg-gradient-to-b from-[#48A5E4] to-[#368AC4]', i: LifeBuoy, a: 'play' },
            { n: '清潔', c: 'bg-gradient-to-b from-[#E56E8E] to-[#D45677]', i: Sparkles, a: 'clean' },
          ].map((btn, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <button
                onClick={() => (btn.a === 'feed' ? setIsFeedMenuOpen(true) : interactPet(btn.a))}
                className={`w-[56px] h-[56px] rounded-full ${btn.c} flex items-center justify-center shadow-[0_4px_10px_rgba(0,0,0,0.3)] border-2 border-[#2A4B3A] active:scale-90 active:shadow-inner transition-all`}
              >
                <btn.i size={24} className="text-white drop-shadow-md" />
              </button>
              <span className="text-white text-xs font-bold tracking-wider">{btn.n}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderActions = () => (
    <div className="flex flex-col h-full overflow-hidden pb-24 bg-[#1C3626]">
      {renderHeader('環保紀錄', '執行任務來獲得經驗值')}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {ACTS.map((act, i) => {
          const isDone = doneToday[act.n];
          const ActIcon = act.i;
          return (
            <div
              key={i}
              className={`flex items-center justify-between p-4 mb-3 rounded-2xl shadow-sm border ${
                isDone ? 'bg-[#162C1E] border-[#162C1E]' : 'bg-[#274632] border-[#365D43]'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${isDone ? 'bg-[#1C3626]' : 'bg-[#365D43] shadow-inner'}`}>
                  <ActIcon className={isDone ? 'text-gray-500' : 'text-[#A1D09A]'} size={24} />
                </div>
                <div>
                  <h3 className={`font-bold text-sm ${isDone ? 'text-gray-400' : 'text-white'}`}>{act.n}</h3>
                  <p className="text-[10px] text-gray-400 mt-0.5">{act.needPic ? '需拍照 AI 識別' : '今日限領一次'}</p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span
                      className={`flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isDone ? 'bg-[#1C3626] text-gray-600' : 'bg-[#1C3626] text-[#E5A744] border border-[#365D43]'
                      }`}
                    >
                      <Coins size={10} /> +{act.c} 幣
                    </span>
                    <span
                      className={`flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isDone ? 'bg-[#1C3626] text-gray-600' : 'bg-[#1C3626] text-[#A1D09A] border border-[#365D43]'
                      }`}
                    >
                      <Leaf size={10} /> +{act.v} EXP
                    </span>
                  </div>
                </div>
              </div>
              {isDone ? (
                <CheckCircle className="text-[#529940]" size={28} />
              ) : (
                <button
                  onClick={() => handleAct(i)}
                  className="bg-[#529940] text-white px-5 py-2 rounded-full text-sm font-bold active:scale-95 transition-transform shrink-0 shadow-md"
                >
                  打卡
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderShop = () => (
    <div className="flex flex-col h-full overflow-hidden pb-24 bg-[#1C3626]">
      {renderHeader('綠色商店', '兌換專屬環保獎勵')}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-4">
          {SHOP_ITEMS.map((item, i) => {
            const ItemIcon = item.i;
            return (
              <div key={i} className="bg-[#274632] rounded-2xl shadow-sm p-5 flex flex-col items-center border border-[#365D43]">
                <div className={`p-4 rounded-full ${item.bg} mb-3 shadow-inner`}>
                  <ItemIcon className={`w-10 h-10 ${item.col}`} />
                </div>
                <h3 className="font-bold text-white text-sm text-center h-10 line-clamp-2 leading-tight">{item.n}</h3>
                <p className="text-[#A1D09A] font-bold mt-1 mb-4">{item.p} 幣</p>
                <button
                  onClick={() => handleBuy(i)}
                  className="w-full bg-[#529940] text-white py-2 rounded-full text-sm font-bold active:bg-[#437D34] active:scale-95 transition-all"
                >
                  兌換
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const MiniSeedSVG = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-md">
      <circle cx="100" cy="110" r="45" fill="#A1D09A" opacity="0.2" filter="blur(10px)" />
      <path d="M 100 150 C 70 150, 70 90, 100 70 C 130 90, 130 150, 100 150 Z" fill="#E8B478" />
      <path d="M 100 150 C 85 150, 85 100, 100 70 C 115 100, 115 150, 100 150 Z" fill="#C0502D" opacity="0.4" />
      <circle cx="85" cy="120" r="6" fill="#1A3A2A" />
      <circle cx="87" cy="118" r="2" fill="#FFF" />
      <circle cx="115" cy="120" r="6" fill="#1A3A2A" />
      <circle cx="117" cy="118" r="2" fill="#FFF" />
      <path d="M 95 130 Q 100 135 105 130" stroke="#1A3A2A" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="75" cy="125" r="5" fill="#E56E8E" opacity="0.6" />
      <circle cx="125" cy="125" r="5" fill="#E56E8E" opacity="0.6" />
      <path d="M 100 70 Q 90 50 110 40" fill="none" stroke="#69B34C" strokeWidth="4" strokeLinecap="round" />
      <path d="M 110 40 Q 120 40 120 30 Q 110 30 110 40" fill="#529940" />
      <circle cx="60" cy="80" r="3" fill="#FFF" />
      <circle cx="140" cy="100" r="4" fill="#FFF" />
      <circle cx="100" cy="30" r="2" fill="#FFF" />
    </svg>
  );

  const renderAchievements = () => {
    const milestones = [1, 5, 10, 15, 20, 25];
    return (
      <div className="flex flex-col h-full overflow-hidden pb-24 bg-[#1C3626]">
        {renderHeader('進化回憶錄', '回顧寵物的成長歷程與收集圖鑑')}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-4">
            {milestones.map((ms) => {
              const historyItem = evolutionHistory.find((h) => h.level === ms);
              const isUnlocked = !!historyItem;
              return (
                <div
                  key={ms}
                  className={`flex flex-col items-center p-4 rounded-3xl border transition-all ${
                    isUnlocked ? 'bg-[#274632] border-[#A1D09A] shadow-lg' : 'bg-[#162C1E] border-transparent opacity-50'
                  }`}
                >
                  <div className="w-24 h-24 flex items-center justify-center mb-3 bg-[#1C3626] rounded-2xl border border-[#365D43] overflow-hidden relative group">
                    {isUnlocked ? (
                      historyItem.imageUrl ? (
                        <img
                          src={historyItem.imageUrl}
                          alt={`Lv.${ms} 形態`}
                          className="max-w-[85%] max-h-[85%] object-contain drop-shadow-md"
                        />
                      ) : (
                        <div className="w-[85%] h-[85%]">
                          <MiniSeedSVG />
                        </div>
                      )
                    ) : (
                      <span className="text-gray-600 font-bold text-4xl">?</span>
                    )}
                  </div>
                  <span className={`text-sm font-bold ${isUnlocked ? 'text-[#A1D09A]' : 'text-gray-500'}`}>
                    {isUnlocked ? `Lv.${ms} 形態` : `Lv.${ms} 未解鎖`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderCommunityFeed = () => (
    <div className="flex flex-col h-full overflow-hidden pb-24 bg-[#1C3626]">
      {renderHeader('環保社群', '互相鼓勵，爭取更高排行！')}
      {!usingFirebase && (
        <div className="mx-4 mt-3 mb-1 text-xs text-[#567E63] bg-[#162C1E] border border-[#365D43] p-3 rounded-xl">
          目前為本地模式（未設定 Firebase）。社群與排行榜暫停。
        </div>
      )}
      <div className="flex bg-[#162C1E] p-2 m-4 rounded-xl border border-[#365D43] shrink-0">
        <button
          onClick={() => setCommunityTab('feed')}
          className={`flex-1 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors ${
            communityTab === 'feed' ? 'bg-[#2A4B3A] text-[#A1D09A] shadow-md' : 'text-gray-400 hover:text-white'
          }`}
        >
          <MessageSquare size={16} /> 最新動態
        </button>
        <button
          onClick={() => setCommunityTab('leaderboard')}
          className={`flex-1 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors ${
            communityTab === 'leaderboard' ? 'bg-[#2A4B3A] text-[#A1D09A] shadow-md' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Trophy size={16} /> 等級排行
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {communityTab === 'feed' ? (
          <>
            <div className="px-4 pb-3">
              <button
                onClick={handleShareAchievement}
                className="w-full bg-[#E5A744] text-white font-bold py-3 rounded-full shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
              >
                <Flame size={20} /> 分享我剛完成的成就！
              </button>
            </div>
            {posts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-[#567E63]">
                <Leaf className="w-12 h-12 mb-2 opacity-20" />
                <p>目前還沒有動態，成為第一個分享的人吧！</p>
              </div>
            ) : (
              posts.map((post, i) => {
                const isSparkedByMe = post.sparkedBy && user && post.sparkedBy.includes(user.uid);
                return (
                  <div key={post.id}>
                    <div className="flex items-start p-4 bg-[#274632] hover:bg-[#365D43] transition-colors">
                      <div
                        className={`w-12 h-12 rounded-full ${post.userColor || 'bg-gray-600'} text-white flex items-center justify-center font-bold text-xl mr-4 border-2 border-[#1C3626] shrink-0`}
                      >
                        {post.userName ? post.userName[0] : '?'}
                      </div>
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-baseline gap-2">
                          <h3 className="font-bold text-white text-sm">{post.userName || '匿名環保者'}</h3>
                          <span className="text-xs text-[#567E63]">
                            {post.createdAt
                              ? new Date(post.createdAt.toMillis()).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '剛剛'}
                          </span>
                        </div>
                        <p className="text-[#A1D09A] text-sm mt-1 leading-relaxed bg-[#162C1E] p-3 rounded-xl border border-[#365D43] inline-block shadow-inner">
                          {post.text}
                        </p>
                      </div>
                      <div className="flex flex-col items-center ml-2 shrink-0">
                        <button
                          onClick={() => handleSpark(post)}
                          className={`p-2 rounded-full active:scale-90 transition-transform ${
                            isSparkedByMe ? 'bg-[#365D43]' : 'bg-[#1C3626]'
                          }`}
                        >
                          <Flame
                            className={isSparkedByMe ? 'text-[#E5A744]' : 'text-[#567E63]'}
                            size={22}
                            fill={isSparkedByMe ? 'currentColor' : 'none'}
                          />
                        </button>
                        <span className={`text-xs font-bold mt-1 ${isSparkedByMe ? 'text-[#E5A744]' : 'text-[#567E63]'}`}>
                          {post.sparks || 0}
                        </span>
                      </div>
                    </div>
                    {i < posts.length - 1 && <div className="h-px bg-[#1C3626]" />}
                  </div>
                );
              })
            )}
          </>
        ) : (
          <div className="px-4 pb-4">
            {leaderboard.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-[#567E63]">
                <Medal className="w-12 h-12 mb-2 opacity-20" />
                <p>載入排行榜中...</p>
              </div>
            ) : (
              leaderboard.map((lbUser, i) => {
                const rank = i + 1;
                let rankDisplay = <span className="text-[#567E63] font-bold text-xl">{rank}</span>;
                if (rank === 1) rankDisplay = <span className="text-3xl drop-shadow-md">🥇</span>;
                if (rank === 2) rankDisplay = <span className="text-3xl drop-shadow-md">🥈</span>;
                if (rank === 3) rankDisplay = <span className="text-3xl drop-shadow-md">🥉</span>;
                const isMe = user && lbUser.id === user.uid;

                return (
                  <div
                    key={lbUser.id}
                    className={`flex items-center p-3 mb-3 rounded-2xl border transition-all ${
                      isMe ? 'bg-[#365D43] border-[#A1D09A]' : 'bg-[#274632] border-[#365D43]'
                    }`}
                  >
                    <div className="w-12 flex justify-center mr-2 shrink-0">{rankDisplay}</div>
                    <div
                      className={`w-12 h-12 rounded-full ${lbUser.userColor || 'bg-gray-600'} text-white flex items-center justify-center font-bold text-xl mr-4 border-2 border-[#1C3626] shrink-0`}
                    >
                      {lbUser.userName ? lbUser.userName[0] : '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold text-sm truncate">{lbUser.userName}</span>
                        {isMe && <span className="bg-[#529940] text-white text-[10px] px-2 py-0.5 rounded-full">我</span>}
                      </div>
                      <div className="text-[#A1D09A] text-xs truncate mt-0.5">寵物：{lbUser.petName || '未知'}</div>
                    </div>
                    <div className="flex flex-col items-center justify-center bg-[#1C3626] px-3 py-1.5 rounded-xl border border-[#365D43] shadow-inner ml-2 shrink-0 min-w-[64px]">
                      <div className="flex items-baseline gap-1">
                        <span className="text-[10px] text-gray-400 font-medium">Lv.</span>
                        <span className="text-[#E5A744] font-bold text-lg leading-none">{lbUser.level || 1}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-1 bg-[#2A4B3A] px-1.5 py-0.5 rounded-full border border-[#365D43]/50 w-full justify-center">
                        <Coins size={10} className="text-[#E5A744]" />
                        <span className="text-white font-bold text-[10px]">{lbUser.coin !== undefined ? lbUser.coin : 2000}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );

  // --- Modals ---
  const CameraReviewModal = () => {
    if (cameraTask === null) return null;
    const [status, setStatus] = useState('idle');
    const [aiResult, setAiResult] = useState(null);
    const fileInputRef = useRef(null);
    const act = ACTS[cameraTask];

    const handleImageUpload = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setStatus('analyzing');
      const reader = new FileReader();
      reader.onloadend = async () => {
        await verifyWithGemini(reader.result, file.type, act.n);
      };
      reader.readAsDataURL(file);
    };

    const verifyWithGemini = async (base64Data, mimeType, taskName) => {
      const compressed = await compressImageDataUrl(base64Data, 1024, 0.72);
      const payload = {
        mimeType: 'image/jpeg',
        data: compressed.split(',')[1],
        taskName,
      };
      try {
        const data = await fetchWithRetry('/api/ai-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setAiResult(data);
      } catch (e) {
        setAiResult({ verified: false, reason: '辨識服務異常或未設定金鑰。' });
      } finally {
        setStatus('result');
      }
    };

    return (
      <div className="fixed inset-0 bg-black/80 z-50 flex flex-col justify-end">
        <div className="bg-[#1C3626] rounded-t-3xl p-6 h-[75vh] flex flex-col animate-slide-up relative border-t-2 border-[#365D43]">
          <button className="absolute top-4 right-6 text-gray-400" onClick={() => setCameraTask(null)}>
            ✕
          </button>
          <h2 className="text-xl font-bold text-center mb-6 text-white">AI 視覺審核 - {act.n}</h2>
          <div className="flex-1 bg-[#162C1E] rounded-2xl flex flex-col items-center justify-center mb-6 overflow-hidden relative">
            {status === 'idle' && (
              <div className="text-center p-6">
                <Camera className="text-[#365D43] w-24 h-24 mb-4 mx-auto" />
                <p className="text-gray-400 text-sm">請拍攝照片證明環保行為。</p>
              </div>
            )}
            {status === 'analyzing' && (
              <div className="z-10 text-center">
                <div className="w-12 h-12 border-4 border-[#A1D09A] border-t-transparent rounded-full animate-spin mb-4 mx-auto" />
                <p className="text-[#A1D09A] font-medium">辨識中...</p>
              </div>
            )}
            {status === 'result' && (
              <div className="z-10 p-6 text-center">
                <CheckCircle
                  className={aiResult?.verified ? 'text-[#529940] w-24 h-24 mb-4 mx-auto' : 'text-red-500 w-24 h-24 mb-4 mx-auto'}
                />
                <h3 className="text-xl font-bold text-white mb-2">{aiResult?.verified ? '審核通過！' : '審核未通過'}</h3>
                <p className="text-white text-sm bg-black/50 p-3 rounded-lg">{aiResult?.reason}</p>
              </div>
            )}
          </div>
          {status === 'idle' && (
            <>
              <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />
              <button onClick={() => fileInputRef.current?.click()} className="w-full bg-[#529940] text-white font-bold py-4 rounded-full">
                拍攝照片並上傳
              </button>
            </>
          )}
          {status === 'result' && (
            <button
              onClick={
                aiResult?.verified
                  ? () => {
                      completeAct(cameraTask);
                      setCameraTask(null);
                    }
                  : () => setStatus('idle')
              }
              className="w-full bg-[#529940] text-white font-bold py-4 rounded-full"
            >
              {aiResult?.verified ? '領取獎勵' : '重新拍攝'}
            </button>
          )}
        </div>
      </div>
    );
  };

  const TicketModal = () =>
    ticketItem && (
      <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
        <div className="bg-[#1C3626] rounded-2xl w-full max-w-sm border border-[#365D43] overflow-hidden animate-zoom-in">
          <div className="bg-[#2A4B3A] p-4 text-white flex items-center gap-3 border-b border-[#365D43]">
            <CheckCircle className="text-[#A1D09A]" size={24} /> <h2>兌換成功</h2>
          </div>
          <div className="p-6 flex flex-col items-center text-center">
            <p className="text-gray-400 text-sm">虛擬憑證</p>
            <h3 className="font-bold text-xl text-white mt-1">{ticketItem}</h3>
            <div className="bg-white p-4 rounded-xl my-6 inline-block">
              <QrCode className="w-40 h-40 text-black" />
            </div>
            <button onClick={() => setTicketItem(null)} className="w-full bg-[#365D43] text-white font-bold py-3 rounded-full">
              關閉
            </button>
          </div>
        </div>
      </div>
    );

  const FeedModal = () =>
    isFeedMenuOpen && (
      <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
        <div className="bg-[#1C3626] rounded-3xl w-full max-w-sm border border-[#365D43] overflow-hidden animate-zoom-in">
          <div className="bg-[#2A4B3A] p-4 text-white flex justify-between items-center border-b border-[#365D43]">
            <h2>餵食低碳食物</h2>
            <button onClick={() => setIsFeedMenuOpen(false)}>✕</button>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            {FOOD_ITEMS.map((food, i) => (
              <button
                key={i}
                onClick={() => handleFeed(food)}
                className="bg-[#162C1E] p-4 rounded-2xl border border-[#365D43] flex flex-col items-center hover:bg-[#2A4B3A] active:scale-95 transition-all"
              >
                <span className="text-4xl mb-2">{food.icon}</span>
                <span className="text-white font-bold text-sm">{food.n}</span>
                <div className="flex items-center gap-1 text-[#E5A744] text-xs font-bold mt-1 bg-[#2A4B3A] px-2 py-0.5 rounded-full">
                  <Coins size={12} /> {food.cost}
                </div>
                <div className="flex gap-2 mt-3 text-[10px] text-gray-400">
                  <span className="flex items-center gap-1">
                    <Zap size={10} className="text-[#E5A744]" /> +{food.energy}
                  </span>
                  <span className="flex items-center gap-1">
                    <Leaf size={10} className="text-[#A1D09A]" /> +{food.exp}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );

  const SettingsModal = () => {
    if (!isSettingsOpen) return null;
    const [tempUserName, setTempUserName] = useState(userName);
    const [tempBgIdx, setTempBgIdx] = useState(bgIdx);

    return (
      <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
        <div className="bg-[#1C3626] rounded-3xl w-full max-w-sm border border-[#365D43] overflow-hidden animate-zoom-in flex flex-col max-h-[85vh]">
          <div className="bg-[#2A4B3A] p-4 text-white flex justify-between items-center border-b border-[#365D43] shrink-0">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Settings size={20} className="text-[#A1D09A]" /> 設定
            </h2>
            <button onClick={() => setIsSettingsOpen(false)} className="text-gray-400 active:text-white p-1">
              ✕
            </button>
          </div>
          <div className="p-6 overflow-y-auto">
            <div className="mb-6">
              <label className="block text-white text-sm font-bold mb-2">場景主題</label>
              <div className="flex gap-2">
                {BACKGROUND_THEMES.map((bg) => (
                  <button
                    key={bg.id}
                    onClick={() => setTempBgIdx(bg.id)}
                    className={`flex-1 py-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                      tempBgIdx === bg.id ? 'border-[#A1D09A] bg-[#2A4B3A]' : 'border-[#365D43] bg-[#162C1E]'
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-full shadow-inner border border-[#162C1E] bg-cover bg-center"
                      style={{ backgroundImage: `url(${bg.imgUrl})` }}
                    />
                    <span className={`text-xs font-bold ${tempBgIdx === bg.id ? 'text-white' : 'text-gray-400'}`}>{bg.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-white text-sm font-bold mb-2">帳號管理</label>
              <div className="bg-[#162C1E] border border-[#365D43] rounded-xl p-4 flex justify-between items-center shadow-inner">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">目前狀態</p>
                  <p className="text-[#A1D09A] text-sm font-bold truncate max-w-[150px]">
                    {user && !user.isAnonymous ? user.email : '訪客遊玩中'}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="bg-red-500/20 text-red-400 px-4 py-2 rounded-lg text-xs font-bold active:scale-95 transition-transform border border-red-500/30"
                >
                  登出
                </button>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-white text-sm font-bold mb-2">玩家名稱</label>
              <input
                type="text"
                value={tempUserName}
                onChange={(e) => setTempUserName(e.target.value)}
                placeholder={user ? `綠星人_${user.uid.substring(0, 4)}` : '請輸入名稱'}
                className="w-full bg-[#162C1E] text-white border border-[#365D43] rounded-xl px-4 py-3 outline-none focus:border-[#A1D09A] transition-colors text-sm"
                maxLength={15}
              />
            </div>

            <button
              onClick={() => {
                setUserName(tempUserName);
                setBgIdx(tempBgIdx);
                try {
                  localStorage.setItem('ecoPetUserName', tempUserName.trim());
                } catch (e) {
                  // ignore
                }
                setIsSettingsOpen(false);
                showToast('設定已儲存！');
              }}
              className="w-full bg-[#529940] text-white font-bold py-3 rounded-full active:scale-95 transition-transform shadow-lg shrink-0 mt-4"
            >
              儲存設定
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-md mx-auto h-screen bg-[#1C3626] relative shadow-2xl flex flex-col font-sans overflow-hidden">
      {!firebaseReady && missingFirebaseEnv.length > 0 && (
        <div className="absolute top-2 left-2 right-2 z-50 text-[10px] text-[#567E63] bg-[#162C1E] border border-[#365D43] p-2 rounded-xl">
          Firebase 未設定：{missingFirebaseEnv.join(', ')}（已切換為本地模式）
        </div>
      )}
      <div className="flex-1 overflow-hidden relative">
        {idx === 0 && renderPetHome()}
        {idx === 1 && renderActions()}
        {idx === 2 && renderShop()}
        {idx === 3 && renderAchievements()}
        {idx === 4 && renderCommunityFeed()}
      </div>
      <div className="absolute bottom-0 w-full bg-[#162C1E] flex justify-around items-center pb-safe pt-2 px-1 z-40 border-t border-[#2A4B3A]">
        {[
          { label: '我的寵物', icon: PawPrint },
          { label: '環保紀錄', icon: Leaf },
          { label: '商店', icon: ShoppingCart },
          { label: '回憶', icon: ImageIcon },
          { label: '社群', icon: Users },
        ].map((item, i) => {
          const IconObj = item.icon;
          return (
            <button key={i} onClick={() => setIdx(i)} className="flex flex-col items-center py-2 px-2 w-[72px]">
              <IconObj
                className={`w-[26px] h-[26px] mb-1 transition-colors ${idx === i ? 'text-[#A1D09A]' : 'text-[#567E63]'}`}
                strokeWidth={idx === i ? 2.5 : 2}
              />
              <span className={`text-[10px] font-bold ${idx === i ? 'text-[#A1D09A]' : 'text-[#567E63]'}`}>{item.label}</span>
            </button>
          );
        })}
      </div>
      <SettingsModal />
      <CameraReviewModal />
      <TicketModal />
      <FeedModal />
      {toast && (
        <div className="absolute top-[80px] left-1/2 -translate-x-1/2 bg-[#529940] text-white px-6 py-3 rounded-full z-50 text-sm font-bold border-2 border-[#A1D09A] animate-fade-in-down whitespace-nowrap">
          {toast}
        </div>
      )}
      <GlobalStyle />
    </div>
  );
}
