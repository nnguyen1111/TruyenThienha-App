// App TruyenThienHa - tích hợp VIP, minh bạch điểm và tiền, đọc truyện, đóng góp điểm, đổi quà, nạp PayPal, thuê bao tháng

import React, { useState, useEffect } from "react";
import { collection, query, where, orderBy, getDocs, doc, getDoc, addDoc, serverTimestamp, increment, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

export default function App() {
  const [notifications, setNotifications] = useState([]);
  const [showNoti, setShowNoti] = useState(false);
  const [currentChapter, setCurrentChapter] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [flags, setFlags] = useState([]);
  const [newFlag, setNewFlag] = useState({ type: "typo", message: "" });
  const [user, setUser] = useState({ uid: "demoUser" });
  const [truyenList, setTruyenList] = useState([]);
  const [points, setPoints] = useState(0);
  const [unlockedChapters, setUnlockedChapters] = useState([]);
  const [showShop, setShowShop] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [vipExpiry, setVipExpiry] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      const snap = await getDoc(doc(db, "users", user.uid));
      const data = snap.exists() ? snap.data() : {};
      setPoints(data.points || 0);
      setUnlockedChapters(data.unlockedChapters || []);
      setVipExpiry(data.vipExpiry?.toDate?.() || null);
      const q = query(collection(db, "notifications"), where("userId", "==", user?.uid || ""), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      setNotifications(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      const tq = query(collection(db, "transactions"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
      const tsnap = await getDocs(tq);
      setTransactions(tsnap.docs.map(doc => doc.data()));
    };
    if (user?.uid) loadData();

    const loadHomepage = async () => {
      const q = query(collection(db, "stories"), orderBy("updatedAt", "desc"));
      const querySnapshot = await getDocs(q);
      setTruyenList(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    loadHomepage();
  }, [user]);

  const logTransaction = async (action, amount) => {
    await addDoc(collection(db, "transactions"), {
      userId: user.uid,
      action,
      amount,
      createdAt: serverTimestamp(),
    });
  };

  const rewardPoints = async (amount, reason = "") => {
    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, { points: increment(amount) });
    setPoints(p => p + amount);
    await logTransaction(reason || "Thưởng điểm", amount);
  };

  const buyPointsWithPaypal = () => {
    alert("🛒 Mua Thiên Điểm bằng PayPal (giả lập demo)");
    rewardPoints(100, "Nạp PayPal");
  };

  const buyVipSubscription = async (days) => {
    const now = new Date();
    const newExpiry = new Date(Math.max(now.getTime(), vipExpiry?.getTime() || 0) + days * 24 * 60 * 60 * 1000);
    await updateDoc(doc(db, "users", user.uid), {
      vipExpiry: newExpiry
    });
    setVipExpiry(newExpiry);
    await logTransaction(`Mua gói VIP ${days} ngày`, 0);
    alert(`✅ Đã mua gói VIP đến ${newExpiry.toLocaleDateString()}`);
  };

  const openShop = () => setShowShop(!showShop);

  const redeemItem = (item) => {
    if (points < item.cost) return alert("Không đủ điểm");
    rewardPoints(-item.cost, `Đổi quà: ${item.name}`);
    alert(`🎁 Bạn đã đổi: ${item.name}`);
  };

  const loadChapter = async (chapterId) => {
    const docRef = doc(db, "chapters", chapterId);
    const snap = await getDoc(docRef);
    const chapter = { id: chapterId, ...snap.data() };
    setCurrentChapter(chapter);

    const now = new Date();
    const isVip = chapter.isVip;
    const isUnlocked = unlockedChapters.includes(chapterId);
    const hasVip = vipExpiry && vipExpiry > now;

    if (isVip && !isUnlocked && !hasVip) {
      const confirm = window.confirm("🔒 Đây là chương VIP. Dùng 10 điểm để mở khóa?");
      if (confirm && points >= 10) {
        await updateDoc(doc(db, "users", user.uid), {
          points: increment(-10),
          unlockedChapters: [...unlockedChapters, chapterId],
        });
        setPoints(p => p - 10);
        setUnlockedChapters([...unlockedChapters, chapterId]);
        await logTransaction("Mở chương VIP", -10);
        alert("✅ Đã mở khóa chương VIP");
      } else if (points < 10) {
        alert("❌ Không đủ điểm. Hãy nạp thêm hoặc đóng góp tích cực để nhận điểm!");
        setCurrentChapter(null);
      }
    }
  };

  const submitComment = async () => {
    if (!newComment || !currentChapter) return;
    await addDoc(collection(db, "comments"), {
      chapterId: currentChapter.id,
      userId: user.uid,
      content: newComment,
      createdAt: serverTimestamp(),
    });
    setNewComment("");
    alert("💬 Đã gửi bình luận");
    if (newComment.length >= 200) await rewardPoints(10, "Review dài");
  };

  const submitFlag = async () => {
    if (!newFlag.message || !currentChapter) return;
    await addDoc(collection(db, "flags"), {
      chapterId: currentChapter.id,
      userId: user.uid,
      message: newFlag.message,
      type: newFlag.type,
      createdAt: serverTimestamp(),
      status: "open"
    });
    setNewFlag({ type: "typo", message: "" });
    alert("🚩 Đã gửi flag cho chương truyện");
    if (newFlag.type === "typo") await rewardPoints(5, "Báo lỗi chính tả");
  };

  const basicTranslate = (raw, dict) => {
    let text = raw;
    for (const [key, val] of Object.entries(dict || {})) {
      const regex = new RegExp(key, 'g');
      text = text.replace(regex, val);
    }
    return text;
  };

  const shopItems = [
    { name: "Huy hiệu Fan Cống Hiến", cost: 50 },
    { name: "Avatar đặc biệt", cost: 30 },
    { name: "10 xu donate tác giả", cost: 100 },
  ];

  return (
    <div className="p-4">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">📚 Truyenthienha</h1>
        <nav className="space-x-4">
          <button className="text-sm hover:underline" onClick={() => setCurrentChapter(null)}>Trang chủ</button>
          <button className="text-sm hover:underline" onClick={() => setShowNoti(!showNoti)}>🔔 Thông báo ({notifications.length})</button>
          <span className="text-sm text-yellow-400 font-semibold">🌟 Thiên Điểm: {points}</span>
          {vipExpiry && new Date() < vipExpiry && <span className="text-sm text-green-400 font-semibold">💎 VIP đến: {vipExpiry.toLocaleDateString()}</span>}
          <button className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded" onClick={buyPointsWithPaypal}>Nạp điểm</button>
          <button className="text-sm bg-green-700 hover:bg-green-800 text-white px-2 py-1 rounded" onClick={openShop}>🎁 Quà & Gói VIP</button>
        </nav>
      </header>

      {showShop && (
        <div className="mb-6 bg-gray-800 p-4 rounded">
          <h2 className="text-lg font-bold mb-2">🎁 Đổi điểm hoặc mua gói VIP</h2>
          <h3 className="font-semibold mb-1">Đổi điểm lấy quà</h3>
          <ul className="space-y-2 mb-4">
            {shopItems.map((item, i) => (
              <li key={i} className="flex justify-between items-center">
                <span>{item.name} – {item.cost} điểm</span>
                <button className="bg-yellow-500 hover:bg-yellow-600 px-2 py-1 rounded text-sm" onClick={() => redeemItem(item)}>Đổi</button>
              </li>
            ))}
          </ul>
          <h3 className="font-semibold mb-1">💎 Mua gói VIP</h3>
          <div className="flex gap-2 mb-2">
            <button className="bg-purple-600 hover:bg-purple-700 px-2 py-1 rounded" onClick={() => buyVipSubscription(7)}>Gói Tuần</button>
            <button className="bg-purple-700 hover:bg-purple-800 px-2 py-1 rounded" onClick={() => buyVipSubscription(30)}>Gói Tháng</button>
            <button className="bg-purple-800 hover:bg-purple-900 px-2 py-1 rounded" onClick={() => buyVipSubscription(365)}>Gói Năm</button>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-1">📜 Lịch sử giao dịch</h3>
            <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
              {transactions.map((t, i) => (
                <li key={i}>• {t.action} ({t.amount > 0 ? "+" : ""}{t.amount} điểm)</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ... giữ nguyên các phần còn lại */}
    </div>
  );
}
