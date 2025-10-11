"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import Image from "next/image";
import Script from "next/script";
import { db } from "@/src/lib/firebase";
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from "firebase/firestore";

const totalStamps = 23;
const venues = [
	{ name: "大田区総合体育館", lat: 35.5643207, lon: 139.7278943 },
	{ name: "筑波大学", lat: 36.1025753, lon: 140.1038015 },
	{ name: "日本体育大学世田谷キャンパス", lat: 35.6216533, lon: 139.6491326 },
	{ name: "明治大学和泉キャンパス", lat: 35.6713474, lon: 139.6472704 },
	{ name: "駒沢オリンピック公園総合運動場屋内球技場", lat: 35.6230326, lon: 139.6628527 },
	{ name: "白鷗大学大行寺キャンパス", lat: 36.3143289, lon: 139.7929705 },
	{ name: "白鷗大学本キャンパス", lat: 36.3118327, lon: 139.8073906 },
	{ name: "国立代々木競技場第二体育館", lat: 35.6663460, lon: 139.6986767 },
	{ name: "専修大学生田キャンパス", lat: 35.6106114, lon: 139.5530485 },
	{ name: "立川立飛アリーナ", lat: 35.7149743, lon: 139.4173947 },
	{ name: "東海大学湘南キャンパス", lat: 35.3616667, lon: 139.2718282 },
	{ name: "大東文化大学東松山キャンパス", lat: 36.0012635, lon: 139.3699917 },
	{ name: "青山学院大学記念館", lat: 35.6619354, lon: 139.7106329 },
	{ name: "家", lat: 35.6584102, lon: 139.6084961 },
	{ name: "学連事務所", lat: 35.6555607, lon: 139.6994733 },
];
const maxDistance = 500;

const specialStampNumbers = [3, 7, 12, 22];
const adminPassword = "3557";

const stampDateRestrictions: { [key: number]: { end: string } } = {
	1: { end: "2025-08-30" },
	2: { end: "2025-08-30" },
	3: { end: "2025-08-31" },
	4: { end: "2025-09-03" },
	5: { end: "2025-09-06" },
	6: { end: "2025-09-07" },
	7: { end: "2025-09-10" },
	8: { end: "2025-09-13" },
	9: { end: "2025-09-14" },
	10: { end: "2025-09-27" },
	11: { end: "2025-09-28" },
	12: { end: "2025-10-04" },
	13: { end: "2025-10-05" },
	14: { end: "2025-10-10" },
	15: { end: "2025-10-11" },
	16: { end: "2025-10-12" },
	17: { end: "2025-10-13" },
	18: { end: "2025-10-18" },
	19: { end: "2025-10-19" },
	20: { end: "2025-10-25" },
	21: { end: "2025-10-26" },
	22: { end: "2025-11-01" },
	23: { end: "2025-11-02" },
};

const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
	const R = 6371e3;
	const phi1 = (lat1 * Math.PI) / 180;
	const phi2 = (lat2 * Math.PI) / 180;
	const dphi = ((lat2 - lat1) * Math.PI) / 180;
	const dl = ((lon2 - lon1) * Math.PI) / 180;
	const a = Math.sin(dphi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dl / 2) ** 2;
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
};


// フェス風：中央から弾け飛ぶ演出
const showLogoBurst = () => {
	const container = document.createElement('div');
	container.style.position = 'fixed';
	container.style.inset = '0';
	container.style.overflow = 'hidden';
	container.style.pointerEvents = 'none';
	container.style.zIndex = '2000';

	const logos = Array.from({ length: 12 }, (_, i) => `/team_logos/${i + 1}.png`);

	for (let i = 0; i < 20; i++) {
		const img = document.createElement('img');
		img.src = logos[Math.floor(Math.random() * logos.length)];
		img.style.position = 'absolute';
		img.style.left = '50%';
		img.style.top = '50%';
		img.style.width = Math.random() * 60 + 40 + "px";
		img.style.opacity = "0.95";
		img.style.transition = "transform 1.5s ease-out, opacity 1.5s ease-out";
		img.style.filter = "brightness(1.1) contrast(1.05)";
		
		const angle = Math.random() * 2 * Math.PI;
		const distance = 200 + Math.random() * 200;
		const dx = Math.cos(angle) * distance;
		const dy = Math.sin(angle) * distance;

		requestAnimationFrame(() => {
			img.style.transform = `translate(${dx}px, ${dy}px) rotate(${Math.random()*720-360}deg)`;
			img.style.opacity = "0";
		});

		container.appendChild(img);
	}

	document.body.appendChild(container);
	setTimeout(() => container.remove(), 2000);
};

declare global {
	interface Window {
		liff: any;
		disableDuplicateCheck?: boolean;
	}
}
const liffId = "2007663892-mQOQRy2z";

type StampHistory = { stampNumber: number; venueName: string; date: string; source: string; qrId?: string; timestamp?: Date };
// Firestore へ保存するキーは LINE userId を想定


const stampQRCodes: { [key: string]: number } = {};
for (let i = 1; i <= totalStamps; i++) {
	stampQRCodes[`KCBF_STAMP_${String(i).padStart(3, "0")}`] = i;
}

export default function StampRallyPage() {
	const [stampedNumbers, setStampedNumbers] = useState<number[]>([]);
	const [history, setHistory] = useState<StampHistory[]>([]);
	const [outputMessage, setOutputMessage] = useState("");
	const [staffPrize, setStaffPrize] = useState("");
	const [showStaffConfirm, setShowStaffConfirm] = useState(false);
	const [adminOpen, setAdminOpen] = useState(false);

	const [liffLoading, setLiffLoading] = useState(true);
	const [liffError, setLiffError] = useState("");
	const [profile, setProfile] = useState<any>(null);
	const [liffReady, setLiffReady] = useState(false);

	// 景品確認用
	const [currentPrizeNumber, setCurrentPrizeNumber] = useState<number | null>(null);

	// 履歴の折りたたみ
	const [historyOpen, setHistoryOpen] = useState(false);

	// 受取済み景品のトラッキング
	const [claimedPrizeNumbers, setClaimedPrizeNumbers] = useState<number[]>([]);
	
	
	// ギフト受け取りUI用
	const [slideReady, setSlideReady] = useState(false);
	const [sliding, setSliding] = useState(false);
	const [slidePosition, setSlidePosition] = useState(0);
	const slideBarRef = useRef<HTMLDivElement>(null);
	
	// スライド移動処理
	const handleSlideMove = (e: React.MouseEvent | React.TouchEvent) => {
		if (!sliding || !slideBarRef.current) return;
		const rect = slideBarRef.current.getBoundingClientRect();
		const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
		const newPos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
		setSlidePosition(newPos);
	};

	// スライド完了処理
	const handleSlideEnd = async () => {
		if (slidePosition > 0.8) { // 80%以上スライドしたら完了
			// ✅ 完了処理
			if (currentPrizeNumber != null) {
				setClaimedPrizeNumbers(prev => {
					if (prev.includes(currentPrizeNumber!)) return prev;
					const updated = [...prev, currentPrizeNumber!];
					if (profile?.userId) {
						const ref = doc(db, "stamp_rallies", profile.userId);
						updateDoc(ref, { claimedPrizes: updated }).catch((err) => {
							console.error("Firestore保存エラー:", err);
							setOutputMessage("データの保存に失敗しました。もう一度お試しください。");
						});
					}
					showLogoBurst(); // 🎉 フェス風演出
					return updated;
				});
			}
			setShowStaffConfirm(false);
			setSlideReady(false);
			setSlidePosition(0); // ✅ 完了後にリセット
		} else {
			setSlidePosition(0); // 戻す
		}
		setSliding(false);
	};
	
	// 受取済み状態はFirestoreから管理（ローカルストレージ削除）

	// 日本時間処理の関数化
	const getJapanTime = () => {
		const now = new Date();
		return new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
	};

	const formatJapanDate = (date: Date) => {
		return date.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
	};

	// 特別スタンプの判定を最適化
	const specialStampSet = useMemo(() => new Set(specialStampNumbers), []);

	// モーダル開閉時のリセット処理
	useEffect(() => {
		if (showStaffConfirm) {
			setSlidePosition(0);
			setSlideReady(false);
		}
	}, [showStaffConfirm]);

	useEffect(() => {
		if (!liffReady) return;
		async function initLiff() {
			if (!window.liff) {
				setLiffError("LIFF SDKが読み込まれていません。LINEアプリで開いてください。");
				setLiffLoading(false);
				return;
			}
			try {
				await window.liff.init({ liffId });
				if (!window.liff.isLoggedIn()) {
					// 常にLIFFに登録したエンドポイント配下に戻す
					const params = new URLSearchParams(window.location.search);
					const stamp = params.get("stamp");
					const basePath = "/stamp-rally";
					const redirectUri = window.location.origin + basePath + (stamp ? `?stamp=${encodeURIComponent(stamp)}` : "");
					// ログイン再帰ループ抑止（短時間での多重遷移を抑える）
					try {
						const last = sessionStorage.getItem("liffLoginTriedAt");
						if (last && Date.now() - parseInt(last) < 15000) {
							setLiffError("LINEログインに戻りました。LINEアプリ内で開いているか、LIFFのURL設定をご確認ください。");
							setLiffLoading(false);
							return;
						}
						sessionStorage.setItem("liffLoginTriedAt", String(Date.now()));
					} catch {}
					window.liff.login({ redirectUri });
					return;
				}
				const prof = await window.liff.getProfile();
				setProfile(prof);
				setLiffLoading(false);
			} catch (e: any) {
				setLiffError("LINEログイン必須です。再読込してください。");
				setLiffLoading(false);
				// エラーハンドリング
			}
		}
		initLiff();
	}, [liffReady]);

	// 初期化が長引く場合のフォールバック表示
	useEffect(() => {
		const timer = setTimeout(() => {
			if (liffLoading && !profile && !liffError) {
				setLiffError("LIFFの初期化が長引いています。LINEアプリ内で開いているか、LIFFのEndpoint URLと実際のURLが一致しているか確認してください。");
			}
		}, 15000);
		return () => clearTimeout(timer);
	}, [liffLoading, profile, liffError]);

	function retryLogin() {
		try {
			if (typeof window === "undefined" || !window.liff) return;
			const params = new URLSearchParams(window.location.search);
			const stamp = params.get("stamp");
			const basePath = "/stamp-rally";
			const redirectUri = window.location.origin + basePath + (stamp ? `?stamp=${encodeURIComponent(stamp)}` : "");
			window.liff.login({ redirectUri });
		} catch (e) {
			// エラーハンドリング
		}
	}

	// ローカルストレージは削除（Firestoreのみ使用）

	// Firestoreから履歴読み込み（ログイン後）
	useEffect(() => {
		async function loadFromFirestore() {
			if (!profile?.userId) return;
			try {
				const ref = doc(db, "stamp_rallies", profile.userId);
				const snap = await getDoc(ref);
				
				if (snap.exists()) {
					const data = snap.data() as { 
						history?: StampHistory[]; 
						claimedPrizes?: number[];
					};
					
					// 履歴データの読み込み
					if (data.history && data.history.length > 0) {
						setHistory(data.history);
						setStampedNumbers(data.history.map(h => h.stampNumber));
					} else {
						setHistory([]);
						setStampedNumbers([]);
					}
					
					// 受取済み景品データの読み込み（既存データにない場合は空配列）
					setClaimedPrizeNumbers(data.claimedPrizes || []);
					
					// 🔽 古いデータにclaimedPrizesフィールドを自動追加
					if (!data.claimedPrizes && profile?.userId) {
						await updateDoc(ref, { claimedPrizes: [] });
					}
				} else {
					// Firestoreにドキュメントが存在しない場合
					setHistory([]);
					setStampedNumbers([]);
					setClaimedPrizeNumbers([]);
				}
			} catch (err) {
				// エラーハンドリング
				console.error("Firestore読み込みエラー:", err);
			}
		}
		loadFromFirestore();
	}, [profile?.userId]);
	

	useEffect(() => {
		if (!profile) return;
		const params = new URLSearchParams(window.location.search);
		const stampParam = params.get("stamp");
		if (stampParam) {
			handleQRCode(stampParam, profile);
			params.delete("stamp");
			window.history.replaceState({}, "", window.location.pathname + (params.toString() ? "?" + params.toString() : ""));
		}
	}, [profile]);

	async function handleQRCode(qrValue: string, prof: any) {
		const qrStampNumber = stampQRCodes[qrValue];
		if (!qrStampNumber || qrStampNumber < 1 || qrStampNumber > totalStamps) {
			setOutputMessage("無効なQRコードです");
			return;
		}
		
		// ✅ 最初に1回だけFirestoreから読み込む
		let firestoreHistory: StampHistory[] = [];
		try {
			if (profile?.userId) {
				const ref = doc(db, "stamp_rallies", profile.userId);
				const snap = await getDoc(ref);
				if (snap.exists()) {
					const data = snap.data() as { history?: StampHistory[] };
					firestoreHistory = data.history || [];
				}
			}
		} catch (err) {
			console.error("Firestore読み込みエラー:", err);
			firestoreHistory = history; // エラー時はローカルを使用
		}
		
		// ✅ 重複チェック（取得済みの履歴を使う）
		const alreadyScanned = firestoreHistory.some(h => h.qrId === qrValue);
		if (alreadyScanned) {
			setOutputMessage(`スタンプ${qrStampNumber}は既に獲得済みです`);
			return;
		}
		
		// 日付制限チェック
		const restriction = stampDateRestrictions[qrStampNumber];
		if (restriction) {
			const now = new Date();
			const japanDate = new Intl.DateTimeFormat('ja-JP', {
				timeZone: 'Asia/Tokyo',
				year: 'numeric',
				month: '2-digit',
				day: '2-digit'
			}).format(now);
			const todayStr = japanDate.replace(/\//g, '-');
			if (todayStr > restriction.end) {
				setOutputMessage("日付が過ぎています");
				return;
			}
		}
		
		setOutputMessage("位置情報を取得中...");
		
		try {
			const pos = await getCurrentPosition();
			const { latitude, longitude } = pos.coords;
			
			let closestVenue: { name: string; lat: number; lon: number } | null = null;
			let minDistance = Infinity;
			for (const venue of venues) {
				const d = getDistance(latitude, longitude, venue.lat, venue.lon);
				if (d < minDistance) {
					minDistance = d;
					closestVenue = venue;
				}
			}
			
			if (!closestVenue || minDistance > maxDistance) {
				setOutputMessage(`会場の近くにいません\n最寄り: ${closestVenue?.name}まで約${Math.round(minDistance)}m`);
				return;
			}
			
			if (firestoreHistory.length >= 22) {
				setOutputMessage("全て獲得済みです！");
				return;
			}
			
			// ✅ 既に取得した履歴でスタンプ番号を計算（2回目の読み込み不要）
			const nextStampNumber = firestoreHistory.length + 1;
			const japanTime = getJapanTime();
			const nowStr = formatJapanDate(japanTime);
			
			const newEntry: StampHistory = {
				stampNumber: nextStampNumber,
				venueName: closestVenue.name,
				date: nowStr,
				source: `QR / ${prof.displayName || "ゲスト"}`,
				qrId: qrValue,
				timestamp: japanTime
			};
			
			// UIの更新
			const updatedHistory = [...firestoreHistory, newEntry];
			const updatedStampedNumbers = updatedHistory.map(h => h.stampNumber);
			
			setStampedNumbers(updatedStampedNumbers);
			setHistory(updatedHistory);
			
			// 特別スタンプの演出
			if (specialStampNumbers.includes(nextStampNumber)) {
				showLogoBurst();
			}

			// Firestoreへ追記
			try {
				if (profile?.userId) {
					const ref = doc(db, "stamp_rallies", profile.userId);
					const snap = await getDoc(ref);
					if (snap.exists()) {
						await updateDoc(ref, { history: arrayUnion(newEntry) });
					} else {
						await setDoc(ref, { history: [newEntry], createdAt: japanTime });
					}
				}
			} catch (err) {
				console.error("Firestore保存エラー:", err);
				setOutputMessage("データの保存に失敗しました。もう一度お試しください。");
			}
			
			setOutputMessage(`スタンプ${nextStampNumber}を獲得！\n（会場: ${closestVenue.name}）`);

		} catch (e: any) {
			setOutputMessage(e.message || "位置情報取得エラー");
		}
	}

	function getCurrentPosition(): Promise<GeolocationPosition> {
		return new Promise((resolve, reject) => {
			if (!navigator.geolocation) {
				reject(new Error("この端末は位置情報取得に非対応です"));
			} else {
				navigator.geolocation.getCurrentPosition(
					resolve,
					err => {
						if (err.code === 1) reject(new Error("位置情報の利用が許可されていません。設定で許可してください。"));
						else if (err.code === 2) reject(new Error("現在、位置情報を取得できません。"));
						else if (err.code === 3) reject(new Error("位置情報の取得がタイムアウトしました"));
						else reject(new Error("位置情報取得に失敗しました"));
					},
					{ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
				);
			}
		});
	}

	async function handleAdminAdd() {
		const pw = prompt("パスワードを入力");
		if (pw !== adminPassword) {
			alert("パスワードが違います");
			return;
		}
		if (stampedNumbers.length >= 22) {
			alert("全てのスタンプ獲得済みです");
			return;
		}
		const nextStamp = stampedNumbers.length + 1;

		let venueNameForAdmin = "管理者追加";
		try {
			const manual = prompt("会場名を入力（空欄で現在地から最寄りを自動判定）");
			if (manual && manual.trim().length > 0) {
				const typed = manual.trim();
				const found = venues.find(v => v.name === typed) || venues.find(v => v.name.includes(typed));
				venueNameForAdmin = found ? found.name : typed;
			} else {
				// 自動で最寄り会場を取得
				const pos = await getCurrentPosition();
				const { latitude, longitude } = pos.coords;
				let closest: { name: string; lat: number; lon: number } | null = null;
				let minD = Infinity;
				for (const v of venues) {
					const d = getDistance(latitude, longitude, v.lat, v.lon);
					if (d < minD) { minD = d; closest = v; }
				}
				if (closest) venueNameForAdmin = closest.name;
			}
		} catch {}

		// 日本時間で現在の日時を取得
		const now = new Date();
		const japanTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
		const nowStr = japanTime.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
		
		const adminEntry: StampHistory = { 
			stampNumber: nextStamp, 
			venueName: venueNameForAdmin, 
			date: nowStr, 
			source: "admin",
			timestamp: japanTime  // JSTのDateオブジェクトを保存
		};
		setStampedNumbers([...stampedNumbers, nextStamp]);
		setHistory([...history, adminEntry]);
		try {
			if (profile?.userId) {
				const ref = doc(db, "stamp_rallies", profile.userId);
				const snap = await getDoc(ref);
				if (snap.exists()) {
					await updateDoc(ref, { history: arrayUnion(adminEntry) });
				} else {
					await setDoc(ref, { history: [adminEntry], createdAt: japanTime });
				}
			}
		} catch (err) {
			// エラーハンドリング
		}
		setOutputMessage(`スタンプ${nextStamp}を追加しました（会場: ${venueNameForAdmin}）`);
	}

	async function handleAdminDelete() {
		const pw = prompt("パスワードを入力");
		if (pw !== adminPassword) {
			alert("パスワードが違います");
			return;
		}
		if (stampedNumbers.length === 0) {
			alert("削除できるスタンプがありません");
			return;
		}
		const last = stampedNumbers[stampedNumbers.length - 1];
		const lastHistory = history[history.length - 1];
		
		setStampedNumbers(prev => prev.slice(0, -1));
		setHistory(prev => prev.slice(0, -1));
		
		// Firestoreからも削除
		try {
			if (profile?.userId) {
				const ref = doc(db, "stamp_rallies", profile.userId);
				const snap = await getDoc(ref);
				if (snap.exists()) {
					const data = snap.data() as { history?: StampHistory[] };
					if (data.history) {
						// 最後の履歴を除いた新しい履歴を作成
						const newHistory = data.history.filter(h => 
							!(h.stampNumber === lastHistory.stampNumber && 
							  h.venueName === lastHistory.venueName && 
							  h.date === lastHistory.date)
						);
						await updateDoc(ref, { history: newHistory });
					}
				}
			}
		} catch (err) {
			// エラーハンドリング
		}
		
		setOutputMessage(`スタンプ${last}を削除しました`);
	}

	async function handleAdminReset() {
		const pw = prompt("パスワードを入力");
		if (pw !== adminPassword) {
			alert("パスワードが違います");
			return;
		}
		if (!confirm("本当に全てのスタンプをリセットしますか？")) {
			return;
		}
		setStampedNumbers([]);
		setHistory([]);
		setClaimedPrizeNumbers([]);
		// Firestoreからも削除
		try {
			if (profile?.userId) {
				const ref = doc(db, "stamp_rallies", profile.userId);
				await updateDoc(ref, { 
					history: [], 
					claimedPrizes: [] 
				});
			}
		} catch (err) {
			// エラーハンドリング
		}
		
		setOutputMessage("全てのスタンプをリセットしました");
	}

	async function handleAdminResetDuplicateCheck() {
		const pw = prompt("パスワードを入力");
		if (pw !== adminPassword) {
			alert("パスワードが違います");
			return;
		}
		// 重複チェック用のフラグをリセット
		if (typeof window !== 'undefined') {
			(window as any).duplicateCheckReset = Date.now();
		}
		setOutputMessage("重複チェックをリセットしました。同じQRコードを再度読み取れます。");
	}

	const nextPrizeNumber = specialStampNumbers.find(num => stampedNumbers.length < num);

	// 最も行った会場（履歴ベース）
	const mostVisitedVenue = (() => {
		if (history.length === 0) return null;
		const countMap: Record<string, number> = {};
		for (const h of history) {
			countMap[h.venueName] = (countMap[h.venueName] || 0) + 1;
		}
		let topName: string | null = null;
		let topCount = 0;
		for (const name in countMap) {
			if (countMap[name] > topCount) {
				topCount = countMap[name];
				topName = name;
			}
		}
		return topName ? { name: topName, count: topCount } : null;
	})();

	if (liffError) {
		return (
			<div style={{ color: "red", fontWeight: "bold", textAlign: "center", marginTop: "40px" }}>{liffError}</div>
		);
	}
	if (liffLoading || !profile) {
		return (
			<div style={{ textAlign: "center", marginTop: "40px" }}>
				<Image src="/autumn_logo.png" alt="logo" width={100} height={100} />
				<h2>LINE認証中...</h2>
				<Script src="https://static.line-scdn.net/liff/edge/2/sdk.js" strategy="afterInteractive" onLoad={() => setLiffReady(true)} />
				<div style={{ marginTop: 12 }}>
					<button onClick={retryLogin} style={{ padding: "8px 14px", borderRadius: 6, background: "#00c300", color: "#fff", fontWeight: 700 }}>ログインを再試行</button>
				</div>
				<div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
					URL: {typeof window !== "undefined" ? window.location.href : ""}
				</div>
			</div>
		);
	}

	return (
		<>
			<Script src="https://static.line-scdn.net/liff/edge/2/sdk.js" strategy="afterInteractive" onLoad={() => setLiffReady(true)} />
			<header>
				<Image src="/autumn_logo.png" className="logo" alt="AUTUMN LEAGUE LOGO" width={110} height={110} />
				<div className="main-title">AUTUMN LEAGUE</div>
				<div className="subtitle">スタンプラリー</div>
			</header>
			{/* line-status block removed per request */}

			{/* 獲得履歴の上に進捗まとめと最も行った会場を配置 */}
			<div style={{ maxWidth: 600, margin: "0 auto", padding: "0 12px" }}>
				{/* 日程表表示エリア */}
				{scheduleOpen && (
					<div className="schedule-section">
						<h3 style={{ color: "#a97b2c", marginBottom: "12px", fontSize: "1.1em" }}>📅 試合日程</h3>
						<div className="schedule-grid">
							<div className="schedule-item">
								<span className="schedule-date">8/27-30</span>
								<span className="schedule-venue">大田区総合体育館</span>
							</div>
							<div className="schedule-item">
								<span className="schedule-date">8/31-9/3</span>
								<span className="schedule-venue">筑波大学</span>
							</div>
							<div className="schedule-item">
								<span className="schedule-date">9/6-7</span>
								<span className="schedule-venue">日本体育大学</span>
							</div>
							<div className="schedule-item">
								<span className="schedule-date">9/10-14</span>
								<span className="schedule-venue">明治大学・駒沢オリンピック</span>
							</div>
							<div className="schedule-item">
								<span className="schedule-date">9/27-28</span>
								<span className="schedule-venue">白鷗大学</span>
							</div>
							<div className="schedule-item">
								<span className="schedule-date">10/4-5</span>
								<span className="schedule-venue">国立代々木競技場</span>
							</div>
							<div className="schedule-item">
								<span className="schedule-date">10/11-13</span>
								<span className="schedule-venue">専修大学・立川立飛</span>
							</div>
							<div className="schedule-item">
								<span className="schedule-date">10/18-19</span>
								<span className="schedule-venue">東海大学・大東文化</span>
							</div>
							<div className="schedule-item">
								<span className="schedule-date">10/25-26</span>
								<span className="schedule-venue">青山学院大学</span>
							</div>
							<div className="schedule-item">
								<span className="schedule-date">11/1-2</span>
								<span className="schedule-venue">決勝戦</span>
							</div>
						</div>
					</div>
				)}
				
				{mostVisitedVenue && (
					<div className="most-visited">
						<span>最も行った会場: </span>
						<strong>{mostVisitedVenue.name}</strong>
						<span style={{ marginLeft: 6 }}>× {mostVisitedVenue.count}</span>
					</div>
				)}
				<div className="progress-summary">
					<p className="stamp-count">
						現在のスタンプ: <span className="count-large">{stampedNumbers.length}</span> / 22
					</p>
					{nextPrizeNumber && (
						<p className="next-prize-info">
							次のギフトまであと <span className="count-large">{nextPrizeNumber - stampedNumbers.length}</span> 個
						</p>
					)}
				</div>
				<div className="prize-progress-bar">
					{specialStampNumbers.map(num => {
						const achieved = stampedNumbers.length >= num;
						const claimed = claimedPrizeNumbers.includes(num);
						return (
							<button
								key={num}
								type="button"
								onClick={() => {
									if (!achieved || claimed) return;
									setCurrentPrizeNumber(num);
									setStaffPrize(`${num === 22 ? "❓" : "🎁"} ギフト（${num}個目）`);
									setShowStaffConfirm(true);
								}}
								className={`prize-progress ${achieved ? "prize-done" : ""}`}
								style={{ cursor: achieved && !claimed ? "pointer" : "default" }}
							>
								<span className="prize-num">{num}</span>
								<span className="prize-label">{achieved ? (claimed ? "達成✅" : "🎁 受け取る") : "🎁GET!"}</span>
							</button>
						);
					})}
				</div>
			</div>
			{/* ここからスタンプグリッド */}
			<div className="stamp-container"> 
				{Array.from({ length: 22 }, (_, i) => i + 1).map(num => {
					const isStamped = stampedNumbers.includes(num);
					const isSpecial = specialStampSet.has(num);
					return (
						<div key={num} className={`stamp ${isStamped ? "stamped" : ""} ${isSpecial ? "special-stamp" : ""}`}>
							{isSpecial ? (
								<>
									{num}
									<span className="special-label">
										{num === 22 ? "❓" : "🎁"}
										<br />
										ギフト
									</span>
								</>
							) : (
								num
							)}
						</div>
					);
				})}
				{/* 日程表ボタン - スタンプ22の右側 */}
				<button 
					className="schedule-btn-in-grid" 
					aria-label="スタンプラリー日程を確認"
					onClick={() => window.open('https://www.kcbbf.jp/index/show-pdf/url/aHR0cHM6Ly9kMmEwdjF4N3F2eGw2Yy5jbG91ZGZyb250Lm5ldC9maWxlcy9zcG9ocF9rY2JiZi9nYW1lX2NhdGVnb3J5LzY4OTMxYzEzMjk5ZmQucGRm', '_blank')}
				>
					📅
					<br />
					日程
				</button>
			</div>
			
			{/* 総合進捗バー - スタンプの下に配置 */}
			<div style={{ maxWidth: 420, margin: "20px auto 0", padding: "0 14px" }}>
				<div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, color: "#866522", fontWeight: 700 }}>
					<span>進捗</span>
					<span style={{ marginLeft: "auto" }}>{stampedNumbers.length}/22</span>
				</div>
				<div style={{ height: 10, background: "#f1f3f5", borderRadius: 6, overflow: "hidden", boxShadow: "inset 0 1px 2px #0001" }}>
					<div style={{ width: `${Math.min(100, Math.round((stampedNumbers.length/22)*100))}%`, height: "100%", background: "linear-gradient(90deg,#ffd700,#a97b2c)", transition: "width .3s ease" }} />
				</div>
			</div>
			{/* エラー/通知はモーダル風に */}
			{outputMessage && (
				<div className="toast" onClick={() => setOutputMessage("")} style={{ top: "50%", bottom: "auto", transform: "translateX(-50%) translateY(-50%)" }}> 
					<div className="toast-body" style={{ whiteSpace: "pre-line" }}>{outputMessage}</div>
					<div className="toast-action">タップで閉じる</div>
				</div>
			)}
			

			{showStaffConfirm && (
				<div className="staff-confirm-fullscreen">
					{!slideReady ? (
						<div className="confirm-step1">
							{(() => {
								// 1〜12のロゴを配列で持つ
								const allLogos = Array.from({ length: 12 }, (_, i) => `/team_logos/${i + 1}.png`);

								// 配列をランダムシャッフル（Fisher–Yates法）
								const shuffled = [...allLogos].sort(() => Math.random() - 0.5);

								// 左右に6個ずつ分割
								const leftLogos = shuffled.slice(0, 6);
								const rightLogos = shuffled.slice(6, 12);

								return (
									<div className="logo-layout">
										{/* 左側 */}
										<div className="logo-side left">
											{leftLogos.map((logo, idx) => (
												<Image key={`L${idx}`} src={logo} alt="team logo" width={70} height={70} />
											))}
										</div>

										{/* 中央ロゴ */}
										<div className="logo-center">
											<Image src="/autumn_logo.png" alt="main logo" width={180} height={180} />
											<h2>🎉 {staffPrize} を獲得！</h2>
											<p>スタッフ確認の準備ができたら下のボタンを押してください。</p>
										</div>

										{/* 右側 */}
										<div className="logo-side right">
											{rightLogos.map((logo, idx) => (
												<Image key={`R${idx}`} src={logo} alt="team logo" width={70} height={70} />
											))}
										</div>
									</div>
								);
							})()}

							<button className="go-to-slide" onClick={() => setSlideReady(true)}>
								スタッフに見せる
							</button>
						</div>
					) : (
						<div className="confirm-step2">
							<Image src="/autumn_logo.png" alt="team logo" width={180} height={180} />
							<h3>この画面をスタッフにお見せください</h3>

							<div
								ref={slideBarRef}
								className="slide-bar"
								onMouseDown={() => setSliding(true)}
								onMouseMove={handleSlideMove}
								onMouseUp={handleSlideEnd}
								onMouseLeave={handleSlideEnd}
								onTouchStart={() => setSliding(true)}
								onTouchMove={handleSlideMove}
								onTouchEnd={handleSlideEnd}
							>
								<div 
									className="slide-handle"
									style={{ 
										left: `calc(${slidePosition * 100}% - ${slidePosition * 180}px)`,
										transition: sliding ? 'none' : 'left 0.3s ease'
									}}
								>
									➡ スライドで完了
								</div>
							</div>
						</div>
					)}
				</div>
			)}
			<div className="history-list">
				<button className="history-toggle" onClick={() => setHistoryOpen(o=>!o)}>
					{historyOpen ? "獲得履歴を閉じる" : "獲得履歴を表示"}
				</button>
				{historyOpen && (
					<>
						<div className="history-title">獲得履歴</div>
						{history.length === 0 ? (
							<div>まだスタンプは獲得されていません</div>
						) : (
							history.map((h, i) => (
								<div key={i} className="history-item">
									スタンプ{h.stampNumber}：{h.venueName}（{h.date}） [{h.source}]
								</div>
							))
						)}
					</>
				)}
			</div>
			<div className="admin-controls-wrapper">
				<button className="button admin-toggle-btn" onClick={() => setAdminOpen(!adminOpen)}>
					{adminOpen ? "管理者ツールを閉じる" : "管理者用ツール"}
				</button>
				{adminOpen && (
					<div className="admin-controls">
						<h3 style={{ width: "100%", textAlign: "center", color: "#495057", marginTop: 0, fontSize: "1em", marginBottom: "10px" }}>
							管理者用ツール
						</h3>
						<button className="button admin-btn" onClick={handleAdminAdd}>
							スタンプ追加
						</button>
						<button className="button admin-btn" onClick={handleAdminDelete}>
							スタンプ削除
						</button>
						<button className="button admin-btn" onClick={handleAdminReset} style={{ background: "#dc3545" }}>
							全リセット
						</button>
						<button className="button admin-btn" onClick={handleAdminResetDuplicateCheck} style={{ background: "#fd7e14" }}>
							重複チェックリセット
						</button>
					</div>
				)}
			</div>

			<style jsx global>{`
				body { font-family: "Segoe UI", "Arial", sans-serif; text-align: center; background: #fff; color: #a97b2c; padding-bottom: 30px; }
				header { background: linear-gradient(120deg, #fffbe7 60%, #d2ae5e 100%); border-bottom: 3px solid #a97b2c22; padding-top: 16px; padding-bottom: 8px; margin-bottom: 16px; position: relative; }
				.logo { width: 110px; height: auto; display: block; margin: 0 auto 8px auto; filter: drop-shadow(0 2px 8px #cdbb6c55); }
				.main-title { font-size: 2.1em; font-weight: 900; letter-spacing: .07em; margin: 0 0 6px 0; color: #a97b2c; text-shadow: 1px 2px 10px #fff8, 0 0 6px #ffd700; font-family: 'Impact', 'Arial Black', sans-serif; }
				.subtitle { font-size: 1.28em; font-weight: bold; color: #b88c00; margin-bottom: 0; letter-spacing: .12em; font-family: 'Segoe UI', 'Arial Black', sans-serif; text-shadow: 0 1px 6px #fff8; }
				@media (max-width: 600px) { .logo { width: 80px; } .main-title { font-size: 1.35em; } .subtitle { font-size: 1em; } }
				.progress-summary { margin: 16px 0; font-size: 1.1em; color: #333; }
				.stamp-count, .next-prize-info { margin: 4px 0; }
				.count-large { font-size: 1.4em; font-weight: bold; color: #a97b2c; }
				.prize-progress-bar { display: flex; justify-content: center; gap: 12px; margin: 16px 0; padding: 0 10px; max-width: 400px; margin-left: auto; margin-right: auto; }
				.prize-progress { flex: 1; background: #f8f9fa; border: 2px solid #e9ecef; border-radius: 9px; padding: 8px 6px; color: #adb5bd; font-weight: bold; font-size: 1em; text-align: center; box-shadow: 0 1px 4px #0001; transition: all 0.3s ease; min-height: 60px; }
				.prize-done { background: #fffbe7; border-color: #ffd700; color: #b88c00; transform: scale(1.05); box-shadow: 0 2px 10px #ffd70044; }
				.prize-num { font-size: 1.2em; font-weight: bold; display: block; }
				.prize-label { font-size: 0.55em; display: block; margin-top: 2px; line-height: 0.85; }
				/* デフォルトは 6 列、スマホでは 5-5-5-2 に見える幅へ */
				.stamp-container { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; max-width: 380px; margin: 0 auto 30px; padding: 0 10px; }
				@media (max-width: 420px) {
					.stamp-container { grid-template-columns: repeat(5, 1fr); max-width: 330px; }
					.stamp { width: 56px; height: 56px; }
				}
				.stamp { width: 54px; height: 54px; border-radius: 50%; border: 2px solid #a97b2c; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; background-color: #fff; position: relative; box-shadow: 0 2px 8px #0001; transition: background 0.2s, color 0.2s, border-color 0.2s, box-shadow 0.2s; }
				.stamped { background-image: url('/stamp.png'); background-size: cover; background-position: center; color: white; border: 2.5px solid #4caf50; box-shadow: 0 2px 12px #4caf5077, 0 0 0 3px #ffd70044; animation: pop .36s cubic-bezier(.22,1,.36,1.06); }
				@keyframes pop { 0% { transform: scale(0.2);} 70% {transform: scale(1.25);} 100% {transform: scale(1);} }
				.special-stamp { color: #ffd700 !important; border-color: #ffd700 !important; font-size: 14px !important; font-family: 'Impact', 'Arial Black', sans-serif; background: linear-gradient(145deg, #fffbe7 70%, #ffd700 100%); box-shadow: 0 0 15px #ffd70099, 0 0 6px #fffbe7; animation: shine 2s infinite linear alternate; z-index: 2; }
				.special-stamp.stamped { background-image: url('/stamp.png'); background-size: cover; background-position: center; color: transparent !important; text-shadow: none !important; border: 2.5px solid #4caf50 !important; box-shadow: 0 2px 22px #ffd70077, 0 0 0 4px #ffd70066; animation: pop .36s cubic-bezier(.22,1,.36,1.06), shine 2s infinite linear alternate; position: relative; }
				.special-stamp.stamped .special-label { opacity: 0 !important; pointer-events: none; }
				@keyframes shine { 0% { box-shadow: 0 0 10px #ffd70099; } 100% { box-shadow: 0 0 22px #ffd700, 0 0 8px #fffbe7; } }
				.special-label { display: block; font-size: 0.6em; font-weight: bold; color: #b88c00; margin-top: 2px; text-shadow: 1px 1px 6px #fff, 0 0 2px #ffd700; letter-spacing: 1px; text-align: center; width: 100%; line-height: 1.1; }
				.history-list { max-width: 600px; margin: 20px auto 20px auto; background: #f9f9ee; border-radius: 10px; box-shadow: 0 2px 10px #ffd70022; padding: 18px 12px; }
				.history-title { font-weight: bold; color: #a97b2c; font-size: 1.15em; margin-bottom: 10px; }
				.history-item { font-size: 1.08em; text-align: left; margin: 6px 0; color: #444; border-bottom: 1px solid #eee; padding-bottom: 3px; }
				.history-item:last-child { border-bottom: none; }
				.history-toggle { background: #f8f9fa; border: 1px solid #e9ecef; color: #6c757d; padding: 8px 12px; border-radius: 8px; font-weight: 600; }
				.admin-controls-wrapper { display: flex; flex-direction: column; justify-content: center; align-items: center; margin-top: 30px; gap: 10px; }
				.admin-toggle-btn { background-color: #f8f9fa; color: #6c757d; border: 1px solid #dee2e6; padding: 8px 16px; font-size: 14px; }
				.admin-controls { margin: 0 auto; padding: 15px; background: #f1f3f5; border-radius: 8px; border: 1px solid #dee2e6; max-width: 300px; text-align: center; display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
				.admin-btn { background-color: #6c757d; color: white; padding: 8px 16px; font-size: 14px; border-radius: 5px; }
				.staff-confirm-container { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); margin: 24px auto 0 auto; max-width: 480px; background: #fffbe7; border: 2px solid #ffd700cc; border-radius: 12px; box-shadow: 0 4px 16px #ffd70022; padding: 28px 20px 22px 20px; color: #a97c2c; font-size: 1.22em; font-weight: bold; text-align: center; z-index: 12; }
				.staff-confirm-container .confirm-label { margin-bottom: 14px; font-size: 0.85em; font-weight: bold; color: #b88c00; letter-spacing: 1px; text-shadow: 0 2px 12px #fffbe7; line-height: 1.6; }
				.staff-confirm-container .confirm-label span { white-space: nowrap; }
				.staff-confirm-container button { margin-top: 10px; background: #00c300; color: #fff; font-size: 1.1em; border-radius: 8px; border: none; padding: 10px 28px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 12px #c3e6cb88; }
				/* 日程表 */
				.schedule-section { margin: 20px 0; padding: 16px; background: #fffbe7; border-radius: 10px; border: 1px solid #ffd70044; }
				.schedule-grid { display: grid; gap: 8px; }
				.schedule-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #fff; border-radius: 6px; border-left: 3px solid #ffd700; font-size: 0.9em; }
				.schedule-date { font-weight: bold; color: #a97b2c; min-width: 80px; }
				.schedule-venue { color: #333; }
				.schedule-btn-in-grid { width: 54px; height: 54px; border-radius: 50%; border: 2px solid #a97b2c; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; background-color: #fffbe7; color: #a97b2c; cursor: pointer; box-shadow: 0 2px 8px #0001; transition: all 0.2s; }
				.schedule-btn-in-grid:hover { background-color: #ffd700; color: #fff; transform: scale(1.05); }
				@media (max-width: 480px) {
					.schedule-item { flex-direction: column; align-items: flex-start; gap: 4px; }
					.schedule-date { min-width: auto; }
					.schedule-btn-in-grid { width: 56px; height: 56px; }
				}
				
				/* トースト通知 */
				.toast { position: fixed; left: 50%; transform: translateX(-50%); bottom: 18px; background: #fff; color: #333; border-radius: 10px; box-shadow: 0 10px 30px #0002; z-index: 50; padding: 12px 14px; border: 1px solid #eee; min-width: 260px; max-width: 90%; }
				.toast-body { font-weight: 600; }
				.toast-action { font-size: 12px; color: #666; margin-top: 6px; }
				
				/* 特別スタンプ演出 */
				.special-stamp-celebration { animation: celebration 3s ease-out forwards; }
				.celebration-text { 
					background: linear-gradient(45deg, #ffd700, #ffed4e, #ffd700); 
					color: #b8860b; 
					padding: 20px 30px; 
					border-radius: 15px; 
					font-size: 1.3em; 
					font-weight: bold; 
					text-align: center; 
					box-shadow: 0 0 30px #ffd700, 0 0 60px #ffd700; 
					border: 3px solid #ffd700;
					text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
				}
				@keyframes celebration {
					0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0; }
					20% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
					40% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
					80% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
					100% { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
				}
				
				/* 紙吹雪エフェクト */
				.confetti {
					position: fixed;
					top: 0;
					left: 0;
					width: 100%;
					height: 100%;
					pointer-events: none;
					z-index: 1000;
				}
				.confetti-piece {
					position: absolute;
					width: 8px;
					height: 8px;
					animation: confetti-fall 2s linear forwards;
				}
				@keyframes confetti-fall {
					0% {
						transform: translateY(-100vh) rotate(0deg);
						opacity: 1;
					}
					100% {
						transform: translateY(100vh) rotate(360deg);
						opacity: 0;
					}
				}
				
				/* === ロゴ紙吹雪 === */
				.logo-confetti-piece {
					position: absolute;
					top: -15vh;
					animation: logo-fall 8s ease-in-out forwards;
					transform: rotate(0deg);
					opacity: 0.95;
					z-index: 999;
					pointer-events: none; /* ✅ タップ無効化 */
				}
				@keyframes logo-fall {
					0% {
						transform: translate(0, -20vh) rotate(0deg);
						opacity: 1;
					}
					25% {
						transform: translate(5vw, 25vh) rotate(180deg);
					}
					50% {
						transform: translate(-5vw, 55vh) rotate(360deg);
					}
					75% {
						transform: translate(8vw, 85vh) rotate(540deg);
					}
					100% {
						transform: translate(-8vw, 120vh) rotate(720deg);
						opacity: 0;
					}
				}

				/* === スライド受け取りUI === */
				.staff-confirm-fullscreen {
					position: fixed;
					inset: 0;
					background: #fffbe7;
					z-index: 2000;
					display: flex;
					flex-direction: column;
					align-items: center;
					justify-content: center;
					text-align: center;
					padding: 20px;
				}
				.confirm-step1, .confirm-step2 {
					display: flex;
					flex-direction: column;
					align-items: center;
					gap: 16px;
				}
				
				/* === ランダムロゴレイアウト === */
				.logo-layout {
					display: grid;
					grid-template-columns: repeat(2, 1fr);
					gap: 16px 12px;
					justify-items: center;
					align-items: center;
					width: 100%;
				}
				.logo-side {
					display: contents; /* 子要素をgrid内に直接配置する扱いに */
				}
				.logo-center {
					display: flex;
					flex-direction: column;
					align-items: center;
					text-align: center;
					gap: 10px;
					grid-column: span 2; /* 中央ブロックを2列分使う */
				}
				.logo-center h2 {
					margin-top: 10px;
					font-size: 1.3em;
					font-weight: bold;
					color: #7a5b00;
				}
				.logo-center p {
					font-size: 0.9em;
					color: #555;
				}
				/* スマホ対応 */
				@media (max-width: 600px) {
					.logo-layout {
						grid-template-columns: repeat(3, 1fr);
						gap: 10px;
					}
					.logo-center {
						grid-column: span 3;
					}
				}
				.go-to-slide {
					background: #ffd700;
					border: none;
					color: #fff;
					font-size: 1.1em;
					padding: 12px 30px;
					border-radius: 30px;
					box-shadow: 0 3px 10px #ffd70055;
					cursor: pointer;
				}
				.slide-bar {
					width: 90%;
					height: 60px;
					background: #f0e6b0;
					border-radius: 50px;
					margin-top: 30px;
					position: relative;
					overflow: hidden;
				}
				.slide-handle {
					width: 180px;
					height: 60px;
					background: #ffd700;
					color: #fff;
					font-weight: bold;
					display: flex;
					align-items: center;
					justify-content: center;
					border-radius: 50px;
					cursor: grab;
					position: absolute;
					left: 0;
					/* transition は JSX 側で動的に制御 */
				}
			`}</style>
		</>
	);
}

