// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { onAuthStateChanged, signInAnonymously, signOut } from "firebase/auth";
import { auth, db } from "./firebase";
import { onValue, push, ref, remove, update } from "firebase/database";

const BG = "#fefce8";
const GREEN = "#f4b321";
const NAVY = "#92400e";
const BORDER = "#fde68a";
const LIGHT_TEXT = "#b2875f";
const SOFT_BG = "#fff8dc";

const NAME_KEY = "mulgeum_daisy_name_v5";
const ADMIN_KEY = "mulgeum_daisy_admin_code_v5";
const REPORTS_PATH = "mulgeum_daisy_reports_v5";

const DEFAULT_CENTER: [number, number] = [35.327, 129.007];
const ADMIN_NAME = "admin";
const ADMIN_CODE = "1234";

const AREAS = ["물금읍", "증산리", "가촌리", "범어리", "기타"];

const CATEGORIES = [
  { id: "cup", label: "일회용 컵", icon: "🥤", color: "#f4b321" },
  { id: "smoke", label: "담배꽁초", icon: "🚬", color: "#78350f" },
  { id: "plastic", label: "플라스틱", icon: "🧴", color: "#3b82f6" },
  { id: "vinyl", label: "비닐", icon: "🛍️", color: "#06b6d4" },
  { id: "bulky", label: "대형 폐기물", icon: "📦", color: "#4b5563" },
  { id: "etc", label: "기타 쓰레기", icon: "❓", color: "#9ca3af" },
];

function getCategory(categoryId: string) {
  return CATEGORIES.find((c) => c.id === categoryId) || CATEGORIES[CATEGORIES.length - 1];
}

function makeMarkerIcon(categoryId: string) {
  const cat = getCategory(categoryId);
  return L.divIcon({
    className: "trash-map-marker",
    html:
      '<div style="' +
      "width:32px;height:32px;border-radius:10px;" +
      "background:" + cat.color + ";" +
      "color:white;display:flex;align-items:center;justify-content:center;" +
      "font-size:16px;border:3px solid white;transform:rotate(45deg);" +
      "box-shadow:0 6px 14px rgba(0,0,0,0.18);" +
      '">' +
      '<div style="transform:rotate(-45deg)">' + cat.icon + "</div></div>",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

function makePickerIcon() {
  return L.divIcon({
    className: "trash-map-picker",
    html:
      '<div style="' +
      "width:20px;height:20px;border-radius:50%;background:#ef4444;" +
      "border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.25);" +
      '"></div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function makeCurrentLocationIcon() {
  return L.divIcon({
    className: "current-location-marker",
    html:
      '<div style="position:relative;width:22px;height:22px;display:flex;align-items:center;justify-content:center;">' +
      '<div style="position:absolute;width:22px;height:22px;border-radius:50%;background:rgba(59,130,246,0.22);animation:pulseLocation 2s ease-out infinite;"></div>' +
      '<div style="width:12px;height:12px;border-radius:50%;background:#2563eb;border:3px solid white;box-shadow:0 3px 10px rgba(37,99,235,0.35);z-index:2;"></div>' +
      "</div>",
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -10],
  });
}

function MapSizeFixer() {
  const map = useMap();
  useEffect(() => {
    const refresh = () => {
      try {
        map.invalidateSize(true);
      } catch {}
    };
    const timers = [100, 500, 1000, 1800].map((t) => setTimeout(refresh, t));
    window.addEventListener("resize", refresh);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("resize", refresh);
    };
  }, [map]);
  return null;
}

function RecenterMap({
  targetLocation,
  zoom = 17,
}: {
  targetLocation: { lat: number; lng: number } | null;
  zoom?: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (!targetLocation) return;
    map.flyTo([targetLocation.lat, targetLocation.lng], zoom, {
      animate: true,
      duration: 0.8,
    });
  }, [targetLocation, zoom, map]);
  return null;
}

function InitialMapFollow({
  currentLocation,
  activeTab,
}: {
  currentLocation: { lat: number; lng: number } | null;
  activeTab: string;
}) {
  const map = useMap();
  const hasMovedRef = useRef(false);

  useEffect(() => {
    if (!currentLocation || activeTab !== "map" || hasMovedRef.current) return;
    map.setView([currentLocation.lat, currentLocation.lng], 16, { animate: true });
    hasMovedRef.current = true;
  }, [currentLocation, activeTab, map]);

  return null;
}

function ClickLocationPicker({
  selectedLocation,
  onChange,
}: {
  selectedLocation: { lat: number; lng: number } | null;
  onChange: (loc: { lat: number; lng: number }) => void;
}) {
  useMapEvents({
    click(e) {
      onChange({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });

  if (!selectedLocation) return null;

  return (
    <Marker position={[selectedLocation.lat, selectedLocation.lng]} icon={makePickerIcon()}>
      <Popup>선택한 위치</Popup>
    </Marker>
  );
}

function CurrentLocationMarker({
  currentLocation,
}: {
  currentLocation: { lat: number; lng: number } | null;
}) {
  if (!currentLocation) return null;

  return (
    <Marker position={[currentLocation.lat, currentLocation.lng]} icon={makeCurrentLocationIcon()}>
      <Popup>현재 위치</Popup>
    </Marker>
  );
}

function DaisyLogo({
  size = 84,
  animated = false,
}: {
  size?: number;
  animated?: boolean;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          overflow: "visible",
          transformOrigin: "60px 92px",
          animation: animated ? "daisySway 3.2s ease-in-out infinite" : "none",
        }}
      >
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <ellipse
            key={angle}
            cx="60"
            cy="34"
            rx="12"
            ry="18"
            fill="white"
            stroke="#e5b233"
            strokeWidth="3"
            transform={`rotate(${angle} 60 60)`}
          />
        ))}
        <circle cx="60" cy="60" r="14.5" fill="#f4b321" stroke="#c98909" strokeWidth="3" />
        <circle cx="55" cy="55" r="4" fill="#ffd86b" opacity="0.9" />
        <path d="M60 80 C60 90, 60 100, 60 110" stroke="#8b6b3f" strokeWidth="4" strokeLinecap="round" />
        <path
          d="M60 98 C70 92, 78 84, 80 76 C70 78, 62 86, 60 98 Z"
          fill="#a8b86a"
          stroke="#8b6b3f"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function DaisyHeaderFlower() {
  return <DaisyLogo size={28} />;
}

function DaisyWordMark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <DaisyHeaderFlower />
      <div style={{ fontSize: 20, fontWeight: 900, color: NAVY, letterSpacing: "-0.02em" }}>
        물금동아
      </div>
    </div>
  );
}

function DaisyCharFlower({ char }: { char: string }) {
  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        width: 30,
        height: 30,
        alignItems: "center",
        justifyContent: "center",
        verticalAlign: "middle",
        margin: "0 1px",
        flexShrink: 0,
      }}
    >
      <svg viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <ellipse
            key={angle}
            cx="50"
            cy="24"
            rx="12"
            ry="22"
            fill="white"
            stroke="#e5b233"
            strokeWidth="3"
            transform={`rotate(${angle} 50 50)`}
          />
        ))}
        <circle cx="50" cy="50" r="15" fill="#f4b321" stroke="#c98909" strokeWidth="2" />
      </svg>
      <span
        style={{
          position: "relative",
          zIndex: 1,
          fontSize: 13,
          fontWeight: 900,
          color: "#5c3a18",
          lineHeight: 1,
        }}
      >
        {char}
      </span>
    </span>
  );
}

function DaisyMeaningLine() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexWrap: "wrap",
        gap: 2,
        textAlign: "center",
        color: NAVY,
        fontWeight: 800,
        lineHeight: 1.5,
      }}
    >
      <DaisyCharFlower char="데" />
      <span style={styles.meaningText}>이터를</span>
      <DaisyCharFlower char="이" />
      <span style={styles.meaningText}>용한</span>
      <DaisyCharFlower char="지" />
      <span style={styles.meaningText}>역 쓰레기 해결</span>
    </div>
  );
}

function ProjectBadge() {
  return <div style={styles.projectBadge}>Mulgeum Daisy Project</div>;
}

function MapNavIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 21C16 16.7 18 13.5 18 10.5C18 6.9 15.3 4 12 4C8.7 4 6 6.9 6 10.5C6 13.5 8 16.7 12 21Z"
        stroke={active ? GREEN : "#c7cbd3"}
        strokeWidth="2.2"
      />
      <circle cx="12" cy="10" r="2.4" fill={active ? GREEN : "#c7cbd3"} />
    </svg>
  );
}

function ListNavIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="6" cy="7" r="1.5" fill={active ? GREEN : "#c7cbd3"} />
      <circle cx="6" cy="12" r="1.5" fill={active ? GREEN : "#c7cbd3"} />
      <circle cx="6" cy="17" r="1.5" fill={active ? GREEN : "#c7cbd3"} />
      <path
        d="M10 7H18M10 12H18M10 17H18"
        stroke={active ? GREEN : "#c7cbd3"}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function StatsNavIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 19V11M10 19V6M15 19V13M20 19V9"
        stroke={active ? GREEN : "#c7cbd3"}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M3 19H22"
        stroke={active ? GREEN : "#c7cbd3"}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ActivityNavIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 4L14.6 9.3L20.5 10.2L16.2 14.3L17.2 20.1L12 17.3L6.8 20.1L7.8 14.3L3.5 10.2L9.4 9.3L12 4Z"
        stroke={active ? GREEN : "#c7cbd3"}
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill={active ? "rgba(244,179,33,0.14)" : "none"}
      />
    </svg>
  );
}

function Header({
  nickname,
  isAdmin,
  onLogout,
}: {
  nickname: string;
  isAdmin: boolean;
  onLogout: () => void;
}) {
  return (
    <header style={styles.headerBar}>
      <DaisyWordMark />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {isAdmin ? <div style={styles.adminPill}>관리자</div> : <div style={styles.userPill}>{nickname}</div>}
        <button onClick={onLogout} style={styles.logoutButton} aria-label="로그아웃">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M10 7L15 12L10 17"
              stroke="#c1b7ab"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M15 12H4" stroke="#c1b7ab" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </header>
  );
}

function BottomNav({
  activeTab,
  setActiveTab,
}: {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}) {
  const items = [
    { key: "map", label: "지도", icon: <MapNavIcon active={activeTab === "map"} /> },
    { key: "list", label: "피드", icon: <ListNavIcon active={activeTab === "list"} /> },
    { key: "stats", label: "통계", icon: <StatsNavIcon active={activeTab === "stats"} /> },
    { key: "activity", label: "활동", icon: <ActivityNavIcon active={activeTab === "activity"} /> },
  ];

  return (
    <nav style={styles.bottomNav}>
      {items.map((item) => (
        <button key={item.key} onClick={() => setActiveTab(item.key)} style={styles.navItemButton}>
          {item.icon}
          <span style={{ ...styles.navLabel, color: activeTab === item.key ? GREEN : "#c7cbd3" }}>
            {item.label}
          </span>
        </button>
      ))}
    </nav>
  );
}

async function compressImage(file: File, maxWidth = 1280, maxHeight = 1280, quality = 0.82): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });

  let { width, height } = img;
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
  width = Math.round(width * ratio);
  height = Math.round(height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;

  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

function getStartOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function getStartOfWeek() {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() + mondayOffset);
  start.setHours(0, 0, 0, 0);
  return start.getTime();
}

function getBadgeByCount(count: number) {
  if (count >= 20) return { title: "데이지 마스터", emoji: "🏆", desc: "꾸준히 우리 동네를 지키는 최고 기록자" };
  if (count >= 10) return { title: "환경 지킴이", emoji: "🌼", desc: "지속적으로 기록을 남기는 실천가" };
  if (count >= 5) return { title: "그린 버디", emoji: "🍀", desc: "환경 기록 습관이 자리잡은 활동가" };
  if (count >= 1) return { title: "데이지 새싹", emoji: "🌱", desc: "첫 실천을 시작한 멋진 참여자" };
  return { title: "참여 준비중", emoji: "✨", desc: "첫 기록을 남기면 배지가 시작돼요" };
}

function buildRanking(reports: any[]) {
  const userMap: Record<string, { name: string; count: number; solved: number }> = {};

  reports.forEach((report) => {
    const key = report.uid || report.userName || "unknown";
    if (!userMap[key]) {
      userMap[key] = { name: report.userName || "이름 없음", count: 0, solved: 0 };
    }
    userMap[key].count += 1;
    if (report.status === "solved") userMap[key].solved += 1;
  });

  return Object.values(userMap)
    .map((item) => ({ ...item, badge: getBadgeByCount(item.count) }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.solved - a.solved;
    });
}

function buildHeatmapData(reports: any[]) {
  const grid = new Map<string, { lat: number; lng: number; count: number }>();
  const precision = 0.0016;

  reports.forEach((report) => {
    if (!report.location) return;
    const lat = report.location.lat;
    const lng = report.location.lng;
    const latKey = Math.round(lat / precision) * precision;
    const lngKey = Math.round(lng / precision) * precision;
    const key = `${latKey.toFixed(4)}_${lngKey.toFixed(4)}`;

    if (!grid.has(key)) {
      grid.set(key, { lat: latKey, lng: lngKey, count: 0 });
    }

    grid.get(key)!.count += 1;
  });

  return Array.from(grid.values());
}

function getHeatColor(count: number, maxCount: number) {
  const ratio = maxCount <= 1 ? 0.35 : count / maxCount;
  if (ratio >= 0.8) return "#dc2626";
  if (ratio >= 0.55) return "#f97316";
  if (ratio >= 0.3) return "#facc15";
  return "#fde68a";
}

function HeatmapLayer({ reports }: { reports: any[] }) {
  const data = useMemo(() => buildHeatmapData(reports), [reports]);
  const maxCount = useMemo(() => Math.max(...data.map((d) => d.count), 1), [data]);

  return (
    <>
      {data.map((item, index) => {
        const color = getHeatColor(item.count, maxCount);
        const ratio = item.count / maxCount;
        const outerRadius = 120 + ratio * 220;
        const innerRadius = 48 + ratio * 90;

        return (
          <div key={`${item.lat}-${item.lng}-${index}`}>
            <Circle
              center={[item.lat, item.lng]}
              radius={outerRadius}
              pathOptions={{
                color,
                weight: 0,
                fillColor: color,
                fillOpacity: 0.14 + ratio * 0.18,
                className: "heatmap-pulse-outer",
              }}
            />
            <Circle
              center={[item.lat, item.lng]}
              radius={innerRadius}
              pathOptions={{
                color,
                weight: 0,
                fillColor: color,
                fillOpacity: 0.26 + ratio * 0.24,
                className: "heatmap-pulse-inner",
              }}
            >
              <Popup>
                <div style={{ minWidth: 140 }}>
                  <strong>집중 구역</strong>
                  <div style={{ marginTop: 6 }}>기록 수: {item.count}</div>
                </div>
              </Popup>
            </Circle>
          </div>
        );
      })}
    </>
  );
}

export default function TrashMap() {
  const [nickname, setNickname] = useState("");
  const [nicknameInput, setNicknameInput] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [savedAdminCode, setSavedAdminCode] = useState(localStorage.getItem(ADMIN_KEY) || "");
  const [user, setUser] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("map");
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [message, setMessage] = useState("");
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [miniMapTarget, setMiniMapTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [heatmapOn, setHeatmapOn] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [formData, setFormData] = useState({
    category: "cup",
    area: AREAS[0],
    description: "",
    image: "",
    location: null as { lat: number; lng: number } | null,
  });

  useEffect(() => {
    setNickname(localStorage.getItem(NAME_KEY) || "");
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        try {
          const result = await signInAnonymously(auth);
          setUser(result.user);
        } catch (error: any) {
          console.error("익명 로그인 실패:", error);
          setMessage(`로그인 실패: ${error.code || "unknown-error"}`);
        }
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const reportsRef = ref(db, REPORTS_PATH);
    const unsub = onValue(
      reportsRef,
      (snapshot) => {
        const data = snapshot.val();
        if (!data) {
          setReports([]);
          return;
        }
        const items = Object.entries(data).map(([id, value]: any) => ({ id, ...value }));
        items.sort((a: any, b: any) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
        setReports(items);
      },
      (error) => {
        console.error(error);
        setMessage("실시간 데이터 연결에 실패했습니다.");
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setCurrentLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 2200);
    return () => clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (showAddSheet && currentLocation) {
      setFormData((prev) => ({ ...prev, location: currentLocation }));
      setMiniMapTarget(currentLocation);
    }
  }, [showAddSheet, currentLocation]);

  const isAdmin = nickname.trim().toLowerCase() === ADMIN_NAME && savedAdminCode === ADMIN_CODE;

  const stats = useMemo(() => {
    const solved = reports.filter((r) => r.status === "solved").length;
    const pending = reports.length - solved;
    const categoryCounts = CATEGORIES.map((category) => ({
      ...category,
      count: reports.filter((r) => r.category === category.id).length,
    }));
    return { total: reports.length, solved, pending, categoryCounts };
  }, [reports]);

  const activityData = useMemo(() => {
    const startOfToday = getStartOfToday();
    const startOfWeek = getStartOfWeek();
    const todayCount = reports.filter((r) => (r.createdAtMs || 0) >= startOfToday).length;
    const weekCount = reports.filter((r) => (r.createdAtMs || 0) >= startOfWeek).length;
    const myReports = reports.filter((r) => user && r.uid === user.uid);
    const myCount = myReports.length;
    const mySolved = myReports.filter((r) => r.status === "solved").length;
    const badge = getBadgeByCount(myCount);
    const ranking = buildRanking(reports);
    const totalUsers = ranking.length;
    const myRank = ranking.findIndex((item) => item.name === nickname) + 1;
    return {
      todayCount,
      weekCount,
      myCount,
      mySolved,
      badge,
      ranking,
      totalUsers,
      myRank: myRank || 0,
    };
  }, [reports, user, nickname]);

  const resetForm = () => {
    setEditingReportId(null);
    setMiniMapTarget(null);
    setFormData({
      category: "cup",
      area: AREAS[0],
      description: "",
      image: "",
      location: null,
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeSelectedImage = () => {
    setFormData((prev) => ({ ...prev, image: "" }));
    if (fileInputRef.current) fileInputRef.current.value = "";
    setMessage("사진이 삭제되었습니다.");
  };

  const handleJoin = (e: any) => {
    e.preventDefault();
    const value = nicknameInput.trim();
    if (!value) {
      setMessage("학번-이름을 입력해 주세요.");
      return;
    }
    if (value.toLowerCase() === ADMIN_NAME && adminCode !== ADMIN_CODE) {
      setMessage("관리자 코드가 올바르지 않습니다.");
      return;
    }
    localStorage.setItem(NAME_KEY, value);
    localStorage.setItem(ADMIN_KEY, adminCode);
    setNickname(value);
    setSavedAdminCode(adminCode);
    setMessage("입장 완료");
  };

  const handleLogout = async () => {
    localStorage.removeItem(NAME_KEY);
    localStorage.removeItem(ADMIN_KEY);
    setNickname("");
    setNicknameInput("");
    setAdminCode("");
    setSavedAdminCode("");
    setShowAddSheet(false);
    resetForm();
    try {
      await signOut(auth);
    } catch {}
    setMessage("로그아웃 되었습니다.");
  };

  const handleStartEdit = (report: any) => {
    const isOwner = !!user && report.uid === user.uid;
    if (!isAdmin && !isOwner) {
      setMessage("수정 권한이 없습니다.");
      return;
    }
    setEditingReportId(report.id);
    setMiniMapTarget(report.location || null);
    setFormData({
      category: report.category || "cup",
      area: report.area || AREAS[0],
      description: report.description || "",
      image: report.image || "",
      location: report.location || null,
    });
    setShowAddSheet(true);
  };

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMessage("이 브라우저에서는 위치 기능을 지원하지 않습니다.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCurrentLocation(next);
        setMiniMapTarget(next);
        setFormData((prev) => ({ ...prev, location: next }));
        setMessage("현재 위치를 불러왔습니다.");
      },
      () => setMessage("위치 권한을 허용해 주세요."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleImageChange = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("이미지 파일만 올릴 수 있습니다.");
      return;
    }
    try {
      const compressed = await compressImage(file);
      setFormData((prev) => ({ ...prev, image: compressed }));
      setMessage("사진이 첨부되었습니다.");
    } catch {
      setMessage("사진 처리에 실패했습니다.");
    }
  };

  const handleSave = async () => {
    if (!nickname) {
      setMessage("학번-이름이 필요합니다.");
      return;
    }
    if (!user) {
      setMessage("로그인 연결 중입니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    if (!formData.location) {
      setMessage("작은 지도에서 위치를 한 번 눌러 주세요.");
      return;
    }

    const payload = {
      category: formData.category,
      area: formData.area,
      description: formData.description.trim() || "내용 없음",
      image: formData.image || "",
      location: formData.location,
    };

    if (editingReportId) {
      const target = reports.find((r) => r.id === editingReportId);
      if (!target) {
        setMessage("수정할 기록을 찾을 수 없습니다.");
        return;
      }

      const isOwner = !!user && target.uid === user.uid;
      if (!isAdmin && !isOwner) {
        setMessage("수정 권한이 없습니다.");
        return;
      }

      try {
        await update(ref(db, `${REPORTS_PATH}/${editingReportId}`), {
          ...payload,
          updatedAtMs: Date.now(),
        });
        resetForm();
        setShowAddSheet(false);
        setMessage("수정이 완료되었습니다.");
      } catch {
        setMessage("수정에 실패했습니다.");
      }
      return;
    }

    const reportData = {
      uid: user.uid,
      userName: nickname,
      ...payload,
      status: "pending",
      createdAtMs: Date.now(),
    };

    try {
      await push(ref(db, REPORTS_PATH), reportData);
      resetForm();
      setShowAddSheet(false);
      setActiveTab("map");
      setMessage("업로드 완료");
    } catch {
      if (formData.image) {
        try {
          await push(ref(db, REPORTS_PATH), { ...reportData, image: "" });
          resetForm();
          setShowAddSheet(false);
          setActiveTab("map");
          setMessage("사진 없이 업로드 완료");
          return;
        } catch {}
      }
      setMessage("저장에 실패했습니다.");
    }
  };

  const handleDelete = async (id: string) => {
    const ok = window.confirm("이 기록을 삭제할까요?");
    if (!ok) return;
    try {
      await remove(ref(db, `${REPORTS_PATH}/${id}`));
      setMessage("삭제되었습니다.");
    } catch {
      setMessage("삭제 권한이 없습니다.");
    }
  };

  const handleToggleStatus = async (report: any) => {
    const nextStatus = report.status === "pending" ? "solved" : "pending";
    try {
      await update(ref(db, `${REPORTS_PATH}/${report.id}`), { status: nextStatus });
      setMessage(nextStatus === "solved" ? "해결됨으로 변경되었습니다." : "진행중으로 변경되었습니다.");
    } catch {
      setMessage("상태 변경에 실패했습니다.");
    }
  };

  const handleClearAll = async () => {
    const ok = window.confirm("전체 데이터를 삭제할까요?");
    if (!ok) return;
    try {
      await remove(ref(db, REPORTS_PATH));
      setMessage("전체 데이터가 초기화되었습니다.");
    } catch {
      setMessage("관리자 권한이 필요합니다.");
    }
  };

  if (!nickname) {
    return (
      <div style={styles.joinScreen}>
        <style>{globalCss}</style>
        {message ? <div style={styles.toast}>{message}</div> : null}
        <div style={styles.joinWrap}>
          <ProjectBadge />
          <div style={styles.heroBrand}>
            <DaisyLogo size={76} animated />
            <div style={styles.heroTitleBlock}>
              <div style={styles.joinTitle}>물금동아</div>
              <div style={styles.projectSubTitle}>데이지 프로젝트</div>
            </div>
          </div>
          <div style={{ marginTop: 10, marginBottom: 10 }}>
            <DaisyMeaningLine />
          </div>
          <div style={styles.joinGuide}>실시간 지도에 합류해 우리 동네를 함께 기록해요</div>
          <div style={styles.joinCard}>
            <div style={styles.joinCardTitle}>반가워요 활동가님!</div>
            <div style={styles.joinCardSub}>학번과 이름을 입력해 주세요.</div>
            <form onSubmit={handleJoin}>
              <input
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                placeholder="예: 30101-홍길동"
                style={styles.joinInput}
              />
              <input
                type="password"
                value={adminCode}
                onChange={(e) => setAdminCode(e.target.value)}
                placeholder="관리자 코드 (관리자만 입력)"
                style={styles.joinInput}
              />
              <button type="submit" style={styles.joinButton}>
                프로젝트 합류하기 ›
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.appShell}>
      <style>{globalCss}</style>
      {message ? <div style={styles.toast}>{message}</div> : null}
      <Header nickname={nickname} isAdmin={isAdmin} onLogout={handleLogout} />

      <main style={styles.mainArea}>
        {activeTab === "map" && (
          <div style={styles.mapPage}>
            <div style={styles.fullMapWrap}>
              <MapContainer key={`main-map-${activeTab}`} center={DEFAULT_CENTER} zoom={14} style={styles.mapContainer} preferCanvas={true}>
                <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapSizeFixer />
                <CurrentLocationMarker currentLocation={currentLocation} />
                <InitialMapFollow currentLocation={currentLocation} activeTab={activeTab} />
                {heatmapOn ? <HeatmapLayer reports={reports} /> : null}
                {reports.map((report) => (
                  <Marker key={report.id} position={[report.location.lat, report.location.lng]} icon={makeMarkerIcon(report.category)}>
                    <Popup>
                      <div style={{ minWidth: 160 }}>
                        <div><strong>{getCategory(report.category).icon} {getCategory(report.category).label}</strong></div>
                        <div style={{ marginTop: 6, fontSize: 13 }}>지역: {report.area}</div>
                        <div style={{ fontSize: 13 }}>작성자: {report.userName}</div>
                        <div style={{ fontSize: 13 }}>상태: {report.status === "solved" ? "해결됨" : "진행중"}</div>
                        <div style={{ marginTop: 6, fontSize: 13 }}>{report.description}</div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>

              <button
                style={{
                  ...styles.heatmapToggle,
                  ...(heatmapOn ? styles.heatmapToggleOn : styles.heatmapToggleOff),
                }}
                onClick={() => setHeatmapOn((prev) => !prev)}
              >
                {heatmapOn ? "🔴 히트맵 ON" : "🟡 히트맵 OFF"}
              </button>

              <button
                style={styles.recordFab}
                onClick={() => {
                  resetForm();
                  setShowAddSheet(true);
                }}
              >
                기록하기 +
              </button>
            </div>
          </div>
        )}

        {activeTab === "list" && (
          <div style={styles.pageWrap}>
            <div style={styles.pageHeading}>TEAM ARCHIVE</div>
            {reports.length === 0 ? (
              <div style={styles.emptyFeed}>아직 활동 기록이 없습니다.</div>
            ) : (
              reports.map((report) => {
                const cat = getCategory(report.category);
                const isOwner = !!user && report.uid === user.uid;
                const canDelete = isAdmin || isOwner;
                const canEdit = isAdmin || isOwner;
                const statusButtonStyle = report.status === "solved" ? styles.statusSolved : styles.statusPending;
                const statusLabel = report.status === "solved" ? "해결됨 ✓" : "진행중";

                return (
                  <div key={report.id} style={styles.feedCard}>
                    <div style={styles.feedCardTop}>
                      <div style={styles.areaBadge}>{cat.icon} {report.area}</div>
                      <button onClick={() => handleToggleStatus(report)} style={statusButtonStyle}>
                        {statusLabel}
                      </button>
                    </div>
                    {report.image ? <img src={report.image} alt="record" style={styles.feedImage} /> : null}
                    <div style={styles.feedText}>{report.description || "내용 없음"}</div>
                    <div style={styles.feedFooter}>
                      <div style={styles.feedUser}>👤 {report.userName}</div>
                      {canEdit || canDelete ? (
                        <div style={styles.feedActions}>
                          {canEdit ? <button onClick={() => handleStartEdit(report)} style={styles.editButton}>수정</button> : null}
                          {canDelete ? <button onClick={() => handleDelete(report.id)} style={styles.deleteButton}>삭제</button> : null}
                        </div>
                      ) : (
                        <div style={{ color: "#d8cfc5", fontSize: 11, fontWeight: 800 }}>읽기 전용</div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === "stats" && (
          <div style={styles.pageWrap}>
            <div style={styles.pageHeading}>ACTIVITY STATS</div>
            <div style={styles.totalBox}>
              <div style={styles.totalNumber}>{stats.total}</div>
              <div style={styles.totalLabel}>TOTAL TRASH FOUND</div>
            </div>
            <div style={styles.statRow}>
              <div style={styles.smallStatBox}>
                <div style={styles.smallStatTitle}>SOLVED</div>
                <div style={{ ...styles.smallStatNumber, color: GREEN }}>{stats.solved}</div>
              </div>
              <div style={styles.smallStatBox}>
                <div style={styles.smallStatTitle}>REMAINING</div>
                <div style={{ ...styles.smallStatNumber, color: NAVY }}>{stats.pending}</div>
              </div>
            </div>
            <div style={styles.categoryStatsWrap}>
              <div style={styles.categoryStatsTitle}>쓰레기 종류별 통계</div>
              <div style={styles.categoryStatsGrid}>
                {stats.categoryCounts.map((item) => (
                  <div key={item.id} style={styles.categoryStatCard}>
                    <div style={{ ...styles.categoryStatIcon, background: item.color }}>{item.icon}</div>
                    <div style={styles.categoryStatLabel}>{item.label}</div>
                    <div style={styles.categoryStatCount}>{item.count}</div>
                  </div>
                ))}
              </div>
            </div>
            {isAdmin && (
              <div style={styles.adminCard}>
                <div style={styles.adminTitle}>⚠ ADMIN TOOLS</div>
                <div style={styles.adminDesc}>
                  모든 사용자의 피드를 삭제할 수 있으며, 전체 초기화도 가능합니다.
                  <br />
                  삭제된 데이터는 복구할 수 없습니다.
                </div>
                <button onClick={handleClearAll} style={styles.adminButton}>데이터 전체 초기화</button>
              </div>
            )}
          </div>
        )}

        {activeTab === "activity" && (
          <div style={styles.pageWrap}>
            <div style={styles.pageHeading}>MY ACTIVITY</div>
            <div style={styles.badgeHero}>
              <div style={styles.badgeEmoji}>{activityData.badge.emoji}</div>
              <div>
                <div style={styles.badgeTitle}>{activityData.badge.title}</div>
                <div style={styles.badgeDesc}>{activityData.badge.desc}</div>
              </div>
            </div>
            <div style={styles.statRow}>
              <div style={styles.smallStatBox}>
                <div style={styles.smallStatTitle}>MY RECORDS</div>
                <div style={{ ...styles.smallStatNumber, color: GREEN }}>{activityData.myCount}</div>
              </div>
              <div style={styles.smallStatBox}>
                <div style={styles.smallStatTitle}>MY SOLVED</div>
                <div style={{ ...styles.smallStatNumber, color: NAVY }}>{activityData.mySolved}</div>
              </div>
            </div>
            <div style={styles.statRow}>
              <div style={styles.smallStatBox}>
                <div style={styles.smallStatTitle}>TODAY</div>
                <div style={{ ...styles.smallStatNumber, color: GREEN }}>{activityData.todayCount}</div>
              </div>
              <div style={styles.smallStatBox}>
                <div style={styles.smallStatTitle}>THIS WEEK</div>
                <div style={{ ...styles.smallStatNumber, color: NAVY }}>{activityData.weekCount}</div>
              </div>
            </div>
            <div style={styles.statRow}>
              <div style={styles.smallStatBox}>
                <div style={styles.smallStatTitle}>ALL USERS</div>
                <div style={{ ...styles.smallStatNumber, color: GREEN }}>{activityData.totalUsers}</div>
              </div>
              <div style={styles.smallStatBox}>
                <div style={styles.smallStatTitle}>MY RANK</div>
                <div style={{ ...styles.smallStatNumber, color: NAVY }}>
                  {activityData.myRank ? `${activityData.myRank}위` : "-"}
                </div>
              </div>
            </div>
            <div style={styles.rankingWrap}>
              <div style={styles.rankingTitle}>전체 사용자 기록 랭킹</div>
              {activityData.ranking.length === 0 ? (
                <div style={styles.rankingEmpty}>아직 랭킹 데이터가 없습니다.</div>
              ) : (
                activityData.ranking.slice(0, 10).map((item, index) => (
                  <div key={`${item.name}-${index}`} style={styles.rankingItem}>
                    <div style={styles.rankingLeft}>
                      <div style={styles.rankingIndex}>{index + 1}</div>
                      <div>
                        <div style={styles.rankingName}>{item.name}</div>
                        <div style={styles.rankingBadge}>{item.badge.emoji} {item.badge.title}</div>
                      </div>
                    </div>
                    <div style={styles.rankingRight}>
                      <div style={styles.rankingCount}>{item.count}</div>
                      <div style={styles.rankingLabel}>기록</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

      {showAddSheet && (
        <div style={styles.sheetBackdrop}>
          <div style={styles.addSheet}>
            <div style={styles.sheetHeader}>
              <div style={styles.sheetTitle}>{editingReportId ? "RECORD EDIT" : "NEW RECORD"}</div>
              <button
                onClick={() => {
                  resetForm();
                  setShowAddSheet(false);
                }}
                style={styles.closeButton}
              >
                ✕
              </button>
            </div>

            <div style={styles.miniMapWrap}>
              <MapContainer center={DEFAULT_CENTER} zoom={14} style={{ width: "100%", height: "100%" }}>
                <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapSizeFixer />
                <ClickLocationPicker
                  selectedLocation={formData.location}
                  onChange={(loc) => {
                    setFormData((prev) => ({ ...prev, location: loc }));
                    setMiniMapTarget(loc);
                  }}
                />
                <CurrentLocationMarker currentLocation={currentLocation} />
                <RecenterMap targetLocation={miniMapTarget} zoom={17} />
              </MapContainer>
            </div>

            <div style={styles.helpCopy}>작은 지도에서 위치를 한 번 눌러 주세요.</div>

            <div style={styles.topActionGrid}>
              <button type="button" onClick={handleCurrentLocation} style={styles.actionCardDark}>
                <div style={{ fontSize: 20 }}>📍</div>
                <div style={styles.actionCardLabelWhite}>내 위치 잡기</div>
              </button>

              <button type="button" onClick={() => fileInputRef.current?.click()} style={styles.actionCardLightButton}>
                {formData.image ? (
                  <div style={styles.previewWrap}>
                    <img src={formData.image} alt="preview" style={styles.uploadPreview} />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeSelectedImage();
                      }}
                      style={styles.removeImageButton}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 20, color: GREEN }}>📷</div>
                    <div style={styles.actionCardLabelGreen}>사진 업로드</div>
                  </>
                )}
              </button>

              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} style={{ display: "none" }} />
            </div>

            <select
              value={formData.area}
              onChange={(e) => setFormData((prev) => ({ ...prev, area: e.target.value }))}
              style={styles.selectBox}
            >
              {AREAS.map((area) => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>

            <div style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, category: cat.id }))}
                  style={{
                    ...styles.categoryCard,
                    borderColor: formData.category === cat.id ? GREEN : "#edf2ee",
                    boxShadow:
                      formData.category === cat.id
                        ? "inset 0 0 0 1px rgba(244,179,33,0.25)"
                        : "0 8px 18px rgba(0,0,0,0.04)",
                  }}
                >
                  <span style={{ fontSize: 20 }}>{cat.icon}</span>
                  <span style={styles.categoryCardText}>{cat.label}</span>
                </button>
              ))}
            </div>

            <textarea
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="상황을 간단히 입력해 주세요."
              style={styles.textAreaBox}
            />

            <button
              onClick={handleSave}
              style={{
                ...styles.uploadButton,
                opacity: user ? 1 : 0.5,
                cursor: user ? "pointer" : "not-allowed",
              }}
              disabled={!user}
            >
              {user ? (editingReportId ? "수정 내용 저장" : "지도에 업로드") : "로그인 연결 중..."}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const globalCss = `
  html, body, #root {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    font-family: Arial, sans-serif;
    background: ${BG};
  }

  * {
    box-sizing: border-box;
  }

  button, input, textarea, select {
    font: inherit;
  }

  .leaflet-container {
    width: 100%;
    height: 100%;
    background: #fefce8;
    overflow: hidden;
  }

  .leaflet-container img,
  .leaflet-container .leaflet-tile,
  .leaflet-container .leaflet-marker-icon,
  .leaflet-container .leaflet-marker-shadow {
    max-width: none !important;
    width: auto !important;
    height: auto !important;
  }

  .leaflet-pane,
  .leaflet-tile,
  .leaflet-marker-icon,
  .leaflet-marker-shadow {
    will-change: transform;
  }

  .trash-map-marker,
  .trash-map-picker,
  .current-location-marker {
    background: transparent !important;
    border: none !important;
  }

  .heatmap-pulse-outer {
    animation: heatOuterPulse 2.8s ease-in-out infinite;
    transform-origin: center;
  }

  .heatmap-pulse-inner {
    animation: heatInnerPulse 2s ease-in-out infinite;
    transform-origin: center;
  }

  @keyframes heatOuterPulse {
    0% { opacity: 0.72; }
    50% { opacity: 1; }
    100% { opacity: 0.72; }
  }

  @keyframes heatInnerPulse {
    0% { opacity: 0.78; }
    50% { opacity: 1; }
    100% { opacity: 0.78; }
  }

  @keyframes daisySway {
    0% { transform: rotate(0deg) translateY(0px); }
    25% { transform: rotate(-3deg) translateY(0px); }
    50% { transform: rotate(2.5deg) translateY(-1px); }
    75% { transform: rotate(-2deg) translateY(0px); }
    100% { transform: rotate(0deg) translateY(0px); }
  }

  @keyframes pulseLocation {
    0% { transform: scale(0.7); opacity: 0.7; }
    100% { transform: scale(2.2); opacity: 0; }
  }
`;

const styles: any = {
  appShell: {
    width: "100%",
    height: "100vh",
    background: BG,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  joinScreen: {
    width: "100%",
    height: "100vh",
    background: "radial-gradient(circle at top center, rgba(244,179,33,0.10), transparent 32%), #fefce8",
    overflowY: "auto",
  },
  joinWrap: {
    minHeight: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "30px 16px 42px",
  },
  projectBadge: {
    padding: "10px 22px",
    borderRadius: 999,
    background: "#fff6de",
    color: "#b2875f",
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 22,
    boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
  },
  heroBrand: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  heroTitleBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
  },
  joinTitle: {
    fontSize: 34,
    fontWeight: 900,
    color: NAVY,
    letterSpacing: "-0.04em",
    lineHeight: 1.05,
    marginBottom: 4,
  },
  projectSubTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "#b2875f",
  },
  meaningText: {
    fontSize: 16,
    fontWeight: 800,
    color: NAVY,
  },
  joinGuide: {
    textAlign: "center",
    color: LIGHT_TEXT,
    lineHeight: 1.6,
    fontSize: 15,
    fontWeight: 700,
    marginTop: 10,
    marginBottom: 22,
  },
  joinCard: {
    width: "100%",
    maxWidth: 640,
    background: "white",
    borderRadius: 36,
    marginTop: 6,
    padding: "28px 22px 22px",
    boxShadow: "0 18px 36px rgba(0,0,0,0.08)",
    border: `1px solid ${BORDER}`,
  },
  joinCardTitle: {
    textAlign: "center",
    color: NAVY,
    fontWeight: 900,
    fontSize: 28,
    letterSpacing: "-0.04em",
    marginBottom: 8,
  },
  joinCardSub: {
    textAlign: "center",
    color: LIGHT_TEXT,
    lineHeight: 1.5,
    fontSize: 15,
    fontWeight: 700,
    marginBottom: 18,
  },
  joinInput: {
    width: "100%",
    background: BG,
    border: `2px solid ${BORDER}`,
    borderRadius: 22,
    padding: "18px 14px",
    fontSize: 18,
    fontWeight: 800,
    color: "#6b7280",
    outline: "none",
    textAlign: "center",
    marginBottom: 14,
  },
  joinButton: {
    width: "100%",
    border: "none",
    borderRadius: 24,
    padding: "20px 18px",
    background: GREEN,
    color: "white",
    fontWeight: 900,
    fontSize: 22,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    boxShadow: "0 12px 24px rgba(244,179,33,0.22)",
    cursor: "pointer",
  },
  headerBar: {
    height: 72,
    background: "white",
    borderBottom: `1px solid ${BORDER}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 12px",
    flexShrink: 0,
  },
  adminPill: {
    minWidth: 88,
    height: 40,
    borderRadius: 999,
    border: `1px solid ${BORDER}`,
    color: NAVY,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: SOFT_BG,
    fontSize: 14,
    padding: "0 14px",
  },
  userPill: {
    minWidth: 88,
    height: 40,
    borderRadius: 999,
    border: `1px solid ${BORDER}`,
    color: NAVY,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: SOFT_BG,
    padding: "0 12px",
    fontSize: 13,
    maxWidth: 150,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  logoutButton: {
    width: 30,
    height: 30,
    border: "none",
    background: "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  mainArea: {
    flex: 1,
    minHeight: 0,
    position: "relative",
    overflow: "hidden",
    paddingBottom: 84,
  },
  mapPage: {
    position: "relative",
    width: "100%",
    height: "100%",
    minHeight: 0,
  },
  fullMapWrap: {
    width: "100%",
    height: "100%",
    position: "relative",
  },
  mapContainer: {
    width: "100%",
    height: "100%",
    minHeight: "100%",
  },
  heatmapToggle: {
    position: "absolute",
    left: 16,
    bottom: 28,
    border: "none",
    borderRadius: 999,
    padding: "10px 16px",
    fontWeight: 900,
    fontSize: 13,
    boxShadow: "0 10px 22px rgba(0,0,0,0.10)",
    cursor: "pointer",
    zIndex: 600,
  },
  heatmapToggleOff: {
    background: "#fff7cc",
    color: NAVY,
  },
  heatmapToggleOn: {
    background: "#f97316",
    color: "white",
  },
  recordFab: {
    position: "absolute",
    right: 16,
    bottom: 28,
    border: "none",
    background: NAVY,
    color: "white",
    fontSize: 17,
    fontWeight: 900,
    padding: "18px 28px",
    borderRadius: 999,
    boxShadow: "0 14px 28px rgba(146,64,14,0.22)",
    cursor: "pointer",
    zIndex: 500,
  },
  pageWrap: {
    width: "100%",
    height: "100%",
    overflowY: "auto",
    padding: "20px 16px 108px",
    background: BG,
  },
  pageHeading: {
    color: NAVY,
    fontWeight: 900,
    fontSize: 28,
    letterSpacing: "-0.03em",
    marginBottom: 20,
  },
  emptyFeed: {
    color: "#d6b37c",
    textAlign: "center",
    marginTop: 150,
    fontWeight: 900,
    fontSize: 22,
  },
  feedCard: {
    background: "white",
    borderRadius: 28,
    padding: 18,
    marginBottom: 14,
    border: `1px solid ${BORDER}`,
    boxShadow: "0 8px 18px rgba(0,0,0,0.05)",
  },
  feedCardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  areaBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontSize: 11,
    fontWeight: 900,
    color: NAVY,
    padding: "7px 10px",
    background: SOFT_BG,
    borderRadius: 999,
    border: `1px solid ${BORDER}`,
  },
  statusSolved: {
    border: "none",
    background: GREEN,
    color: "white",
    fontWeight: 900,
    fontSize: 10,
    padding: "7px 10px",
    borderRadius: 999,
    cursor: "pointer",
  },
  statusPending: {
    border: "none",
    background: "#f8f4ea",
    color: "#bcaea0",
    fontWeight: 900,
    fontSize: 10,
    padding: "7px 10px",
    borderRadius: 999,
    cursor: "pointer",
  },
  feedImage: {
    width: "100%",
    height: 170,
    objectFit: "cover",
    borderRadius: 20,
    marginBottom: 12,
    border: "1px solid #f7ebd4",
  },
  feedText: {
    color: "#5f4a34",
    fontSize: 15,
    lineHeight: 1.55,
    fontWeight: 700,
    marginBottom: 14,
    padding: "0 2px",
  },
  feedFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderTop: "1px solid #f8efdf",
    paddingTop: 12,
  },
  feedUser: {
    color: "#a88d6e",
    fontWeight: 800,
    fontSize: 12,
  },
  feedActions: {
    display: "flex",
    gap: 8,
  },
  editButton: {
    border: "none",
    background: "#fff8ea",
    color: NAVY,
    fontWeight: 900,
    fontSize: 13,
    borderRadius: 12,
    padding: "8px 12px",
    cursor: "pointer",
  },
  deleteButton: {
    border: "none",
    background: "transparent",
    color: "#ef9a9a",
    fontWeight: 900,
    fontSize: 13,
    cursor: "pointer",
  },
  badgeHero: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    background: "linear-gradient(135deg, #fffdf5 0%, #fff7dd 100%)",
    border: `1px solid ${BORDER}`,
    borderRadius: 26,
    padding: "18px 16px",
    boxShadow: "0 10px 24px rgba(0,0,0,0.05)",
    marginBottom: 14,
  },
  badgeEmoji: {
    width: 54,
    height: 54,
    borderRadius: 18,
    background: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 26,
    boxShadow: "0 8px 18px rgba(0,0,0,0.05)",
    flexShrink: 0,
  },
  badgeTitle: {
    color: NAVY,
    fontSize: 18,
    fontWeight: 900,
  },
  badgeDesc: {
    marginTop: 6,
    color: LIGHT_TEXT,
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.5,
  },
  totalBox: {
    background: NAVY,
    borderRadius: 40,
    padding: "34px 16px 24px",
    textAlign: "center",
    boxShadow: "0 14px 28px rgba(146,64,14,0.18)",
    marginBottom: 18,
  },
  totalNumber: {
    color: "white",
    fontWeight: 900,
    fontSize: 72,
    lineHeight: 1,
    marginBottom: 8,
  },
  totalLabel: {
    color: GREEN,
    fontWeight: 900,
    letterSpacing: "0.12em",
    fontSize: 13,
  },
  statRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
    marginBottom: 20,
  },
  smallStatBox: {
    background: "white",
    borderRadius: 26,
    padding: "24px 14px",
    textAlign: "center",
    boxShadow: "0 8px 18px rgba(0,0,0,0.05)",
  },
  smallStatTitle: {
    color: "#bda790",
    fontSize: 12,
    fontWeight: 900,
    marginBottom: 14,
  },
  smallStatNumber: {
    fontSize: 42,
    fontWeight: 900,
    lineHeight: 1,
  },
  categoryStatsWrap: {
    background: "white",
    borderRadius: 28,
    padding: "20px 16px",
    boxShadow: "0 8px 18px rgba(0,0,0,0.05)",
    marginBottom: 20,
  },
  categoryStatsTitle: {
    color: NAVY,
    fontWeight: 900,
    fontSize: 18,
    marginBottom: 14,
  },
  categoryStatsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 10,
  },
  categoryStatCard: {
    background: "#fffdf6",
    border: `1px solid ${BORDER}`,
    borderRadius: 20,
    padding: "14px 12px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    minHeight: 118,
    justifyContent: "center",
  },
  categoryStatIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    marginBottom: 10,
    boxShadow: "0 8px 16px rgba(0,0,0,0.10)",
  },
  categoryStatLabel: {
    color: NAVY,
    fontSize: 12,
    fontWeight: 800,
    marginBottom: 6,
    lineHeight: 1.35,
    minHeight: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  categoryStatCount: {
    color: GREEN,
    fontSize: 24,
    fontWeight: 900,
    lineHeight: 1,
  },
  rankingWrap: {
    marginTop: 16,
    background: "white",
    borderRadius: 28,
    padding: 16,
    border: `1px solid ${BORDER}`,
    boxShadow: "0 8px 18px rgba(0,0,0,0.05)",
  },
  rankingTitle: {
    color: NAVY,
    fontSize: 18,
    fontWeight: 900,
    marginBottom: 12,
  },
  rankingEmpty: {
    color: LIGHT_TEXT,
    fontSize: 14,
    fontWeight: 700,
    textAlign: "center",
    padding: "18px 0",
  },
  rankingItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "14px 8px",
    borderBottom: "1px solid #f7ebd4",
  },
  rankingLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },
  rankingIndex: {
    width: 32,
    height: 32,
    borderRadius: 12,
    background: "#fff8ea",
    color: NAVY,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    fontSize: 14,
    flexShrink: 0,
  },
  rankingName: {
    color: NAVY,
    fontSize: 15,
    fontWeight: 900,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: 180,
  },
  rankingBadge: {
    marginTop: 4,
    color: LIGHT_TEXT,
    fontSize: 12,
    fontWeight: 800,
  },
  rankingRight: {
    textAlign: "right",
    flexShrink: 0,
  },
  rankingCount: {
    color: NAVY,
    fontSize: 22,
    fontWeight: 900,
    lineHeight: 1,
  },
  rankingLabel: {
    marginTop: 4,
    color: LIGHT_TEXT,
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.04em",
  },
  adminCard: {
    background: "#fffdf8",
    borderRadius: 32,
    border: "2px dashed #f3dddd",
    padding: "30px 18px 22px",
    textAlign: "center",
    boxShadow: "0 8px 18px rgba(0,0,0,0.03)",
  },
  adminTitle: {
    color: "#f08a8a",
    fontWeight: 900,
    fontSize: 24,
    marginBottom: 12,
  },
  adminDesc: {
    color: "#b99b7f",
    fontWeight: 800,
    lineHeight: 1.45,
    fontSize: 13,
    marginBottom: 18,
  },
  adminButton: {
    width: "100%",
    border: "none",
    background: "#ea8f8f",
    color: "white",
    fontWeight: 900,
    fontSize: 18,
    borderRadius: 22,
    padding: "18px 16px",
    cursor: "pointer",
  },
  bottomNav: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    height: 82,
    background: "white",
    borderTop: `1px solid ${BORDER}`,
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr 1fr",
    alignItems: "center",
    flexShrink: 0,
    paddingBottom: 4,
    zIndex: 40,
  },
  navItemButton: {
    border: "none",
    background: "transparent",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    cursor: "pointer",
  },
  navLabel: {
    fontSize: 12,
    fontWeight: 900,
  },
  sheetBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(69,26,3,0.18)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    zIndex: 4000,
  },
  addSheet: {
    position: "relative",
    width: "100%",
    maxWidth: 800,
    maxHeight: "88vh",
    overflowY: "auto",
    background: BG,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: "18px 14px 22px",
    boxShadow: "0 -14px 36px rgba(0,0,0,0.16)",
    zIndex: 4001,
  },
  sheetHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sheetTitle: {
    color: NAVY,
    fontWeight: 900,
    fontSize: 20,
    letterSpacing: "-0.03em",
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    border: "1px solid #f8efdf",
    background: "white",
    fontSize: 18,
    cursor: "pointer",
  },
  miniMapWrap: {
    height: 190,
    overflow: "hidden",
    borderRadius: 20,
    marginBottom: 8,
    boxShadow: "0 8px 18px rgba(0,0,0,0.06)",
  },
  helpCopy: {
    color: "#a88d6e",
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 12,
    textAlign: "center",
  },
  topActionGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginBottom: 12,
  },
  actionCardDark: {
    height: 84,
    border: "none",
    borderRadius: 22,
    background: NAVY,
    color: "white",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    boxShadow: "0 8px 18px rgba(146,64,14,0.18)",
    cursor: "pointer",
  },
  actionCardLabelWhite: {
    fontSize: 11,
    fontWeight: 900,
    color: "white",
  },
  actionCardLightButton: {
    height: 84,
    borderRadius: 22,
    background: "white",
    border: `2px dashed ${BORDER}`,
    color: GREEN,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    boxShadow: "0 8px 16px rgba(0,0,0,0.04)",
    cursor: "pointer",
    overflow: "hidden",
    position: "relative",
  },
  actionCardLabelGreen: {
    fontSize: 11,
    fontWeight: 900,
    color: GREEN,
  },
  previewWrap: {
    position: "relative",
    width: "100%",
    height: "100%",
  },
  uploadPreview: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  removeImageButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: "50%",
    border: "none",
    background: "rgba(0,0,0,0.72)",
    color: "white",
    fontWeight: 900,
    fontSize: 14,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 10px rgba(0,0,0,0.18)",
  },
  selectBox: {
    width: "100%",
    border: "2px solid #f5e8ca",
    background: "white",
    borderRadius: 18,
    padding: "14px 14px",
    fontSize: 15,
    fontWeight: 800,
    color: NAVY,
    marginBottom: 12,
    outline: "none",
  },
  categoryGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 10,
    marginBottom: 12,
  },
  categoryCard: {
    border: "2px solid #edf2ee",
    background: "white",
    borderRadius: 20,
    minHeight: 96,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "12px 10px",
    cursor: "pointer",
  },
  categoryCardText: {
    color: NAVY,
    fontSize: 12,
    fontWeight: 900,
    textAlign: "center",
    lineHeight: 1.35,
  },
  textAreaBox: {
    width: "100%",
    minHeight: 120,
    borderRadius: 24,
    border: "2px solid #f6ead3",
    background: "white",
    padding: "16px 14px",
    fontSize: 15,
    color: NAVY,
    resize: "none",
    outline: "none",
    marginBottom: 14,
  },
  uploadButton: {
    width: "100%",
    border: "none",
    background: GREEN,
    color: "white",
    fontWeight: 900,
    fontSize: 18,
    borderRadius: 24,
    padding: "20px 16px",
    cursor: "pointer",
    boxShadow: "0 14px 24px rgba(244,179,33,0.20)",
  },
  toast: {
    position: "fixed",
    top: 14,
    left: "50%",
    transform: "translateX(-50%)",
    background: NAVY,
    color: "white",
    padding: "10px 18px",
    borderRadius: 14,
    zIndex: 5000,
    boxShadow: "0 12px 24px rgba(0,0,0,0.18)",
    fontWeight: 800,
    fontSize: 14,
    whiteSpace: "nowrap",
    maxWidth: "90vw",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
};
