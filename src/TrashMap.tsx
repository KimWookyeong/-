// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from "react";
import {
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
const GREEN = "#fbbf24";
const NAVY = "#92400e";
const BORDER = "#fde68a";
const LIGHT_TEXT = "#b2875f";

const NAME_KEY = "mulgeum_daisy_name_v1";
const ADMIN_KEY = "mulgeum_daisy_admin_code_v1";
const REPORTS_PATH = "mulgeum_daisy_reports";

const DEFAULT_CENTER: [number, number] = [35.327, 129.007];
const ADMIN_NAME = "admin";
const ADMIN_CODE = "1234";

const AREAS = ["물금읍", "증산리", "가촌리", "범어리", "기타 구역"];

const CATEGORIES = [
  { id: "cup", label: "일회용 컵", icon: "🥤", color: "#fbbf24" },
  { id: "smoke", label: "담배꽁초", icon: "🚬", color: "#78350f" },
  { id: "plastic", label: "플라스틱/비닐", icon: "🛍️", color: "#3b82f6" },
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
    html: `
      <div style="
        width:32px;
        height:32px;
        border-radius:10px;
        background:${cat.color};
        color:white;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:16px;
        border:3px solid white;
        transform:rotate(45deg);
        box-shadow:0 6px 14px rgba(0,0,0,0.18);
      ">
        <div style="transform:rotate(-45deg)">${cat.icon}</div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

function makePickerIcon() {
  return L.divIcon({
    className: "trash-map-picker",
    html: `
      <div style="
        width:20px;
        height:20px;
        border-radius:50%;
        background:#ef4444;
        border:3px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,0.25);
      "></div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function MapSizeFixer() {
  const map = useMap();

  useEffect(() => {
    const run = () => map.invalidateSize();

    const t1 = setTimeout(run, 100);
    const t2 = setTimeout(run, 400);
    const t3 = setTimeout(run, 900);
    const t4 = setTimeout(run, 1500);

    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      window.removeEventListener("resize", onResize);
    };
  }, [map]);

  return null;
}

function DaisyLetter({ letter }: { letter: string }) {
  return (
    <div
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        margin: "0 1px",
        verticalAlign: "middle",
        flexShrink: 0,
      }}
    >
      <svg viewBox="0 0 100 100" style={{ position: "absolute", width: "100%", height: "100%" }}>
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <ellipse
            key={angle}
            cx="50"
            cy="25"
            rx="14"
            ry="28"
            fill="white"
            stroke="#fbbf24"
            strokeWidth="3"
            transform={`rotate(${angle} 50 50)`}
          />
        ))}
        <circle cx="50" cy="50" r="20" fill="#fbbf24" stroke="#d97706" strokeWidth="2" />
      </svg>
      <span
        style={{
          position: "relative",
          zIndex: 1,
          fontWeight: 900,
          fontSize: 13,
          color: "#451a03",
          marginTop: 1,
        }}
      >
        {letter}
      </span>
    </div>
  );
}

function DaisyLogo({ size = 64 }: { size?: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "4px 0 6px" }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 20,
          background: "#fbbf24",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 8px 20px rgba(246,191,31,0.20)",
          transform: "rotate(-4deg)",
          flexShrink: 0,
        }}
      >
        <svg
          width={size * 0.44}
          height={size * 0.44}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ transform: "rotate(4deg)" }}
        >
          <path
            d="M32 22C29 16 22 13 18 16C14 19 15 27 21 31C16 31 11 35 11 40C11 45 16 48 22 46C23 52 27 56 32 56C37 56 41 52 42 46C48 48 53 45 53 40C53 35 48 31 43 31C49 27 50 19 46 16C42 13 35 16 32 22Z"
            fill="white"
          />
          <circle cx="32" cy="34" r="4.5" fill="#fbbf24" />
          <path d="M31.5 40C30 44 27 47 24 49" stroke="white" strokeWidth="3" strokeLinecap="round" />
          <path d="M31.5 42C35 43 38 46 40 49" stroke="white" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

function DaisyHeaderLogo() {
  return (
    <div
      style={{
        width: 34,
        height: 34,
        borderRadius: 12,
        background: GREEN,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 6px 16px rgba(246,191,31,0.20)",
        transform: "rotate(-4deg)",
        flexShrink: 0,
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ transform: "rotate(4deg)" }}
      >
        <path
          d="M32 22C29 16 22 13 18 16C14 19 15 27 21 31C16 31 11 35 11 40C11 45 16 48 22 46C23 52 27 56 32 56C37 56 41 52 42 46C48 48 53 45 53 40C53 35 48 31 43 31C49 27 50 19 46 16C42 13 35 16 32 22Z"
          fill="white"
        />
        <circle cx="32" cy="34" r="4.5" fill="#fbbf24" />
        <path d="M31.5 40C30 44 27 47 24 49" stroke="white" strokeWidth="3" strokeLinecap="round" />
        <path d="M31.5 42C35 43 38 46 40 49" stroke="white" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  );
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
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <DaisyHeaderLogo />
        <div style={{ fontSize: 20, fontWeight: 900, color: NAVY, letterSpacing: "-0.02em" }}>
          물금동아
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {isAdmin ? <div style={styles.adminPill}>Admin</div> : <div style={styles.userPill}>{nickname}</div>}
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

  const [formData, setFormData] = useState({
    category: "cup",
    area: AREAS[0],
    description: "",
    image: "",
    location: null as { lat: number; lng: number } | null,
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

        const items = Object.entries(data).map(([id, value]: any) => ({
          id,
          ...value,
        }));

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
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 2200);
    return () => clearTimeout(timer);
  }, [message]);

  const isAdmin =
    nickname.trim().toLowerCase() === ADMIN_NAME &&
    savedAdminCode === ADMIN_CODE;

  const stats = useMemo(() => {
    const solved = reports.filter((r) => r.status === "solved").length;
    const pending = reports.length - solved;

    const categoryCounts = CATEGORIES.map((category) => ({
      ...category,
      count: reports.filter((r) => r.category === category.id).length,
    }));

    return {
      total: reports.length,
      solved,
      pending,
      categoryCounts,
    };
  }, [reports]);

  const resetForm = () => {
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
      setMessage("학번과 이름을 입력해 주세요.");
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

    try {
      await signOut(auth);
    } catch (error) {
      console.error(error);
    }

    setMessage("로그아웃 되었습니다.");
  };

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMessage("이 브라우저에서는 위치 기능을 지원하지 않습니다.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData((prev) => ({
          ...prev,
          location: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          },
        }));
        setMessage("현재 위치를 불러왔습니다.");
      },
      () => {
        setMessage("위치 권한을 허용해 주세요.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleImageChange = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage("이미지 파일만 올릴 수 있습니다.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFormData((prev) => ({ ...prev, image: reader.result as string }));
      setMessage("사진이 첨부되었습니다.");
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!nickname) {
      setMessage("학번과 이름이 필요합니다.");
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

    const reportData = {
      uid: user.uid,
      userName: nickname,
      category: formData.category,
      area: formData.area,
      description: formData.description.trim() || "내용 없음",
      image: formData.image || "",
      location: formData.location,
      status: "pending",
      createdAtMs: Date.now(),
    };

    try {
      await push(ref(db, REPORTS_PATH), reportData);
      resetForm();
      setShowAddSheet(false);
      setActiveTab("map");
      setMessage("업로드 완료");
    } catch (error) {
      console.error(error);

      if (formData.image) {
        try {
          await push(ref(db, REPORTS_PATH), {
            ...reportData,
            image: "",
          });
          resetForm();
          setShowAddSheet(false);
          setActiveTab("map");
          setMessage("사진 없이 업로드 완료");
          return;
        } catch (retryError) {
          console.error(retryError);
        }
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
    } catch (error) {
      console.error(error);
      setMessage("삭제 권한이 없습니다.");
    }
  };

  const handleToggleStatus = async (report: any) => {
    const isOwner = !!user && report.uid === user.uid;
    const canSolve = report.status === "pending";
    const canReopen = report.status === "solved" && (isOwner || isAdmin);

    if (!canSolve && !canReopen) {
      setMessage("이 상태는 변경할 수 없습니다.");
      return;
    }

    const nextStatus = report.status === "pending" ? "solved" : "pending";

    try {
      await update(ref(db, `${REPORTS_PATH}/${report.id}`), {
        status: nextStatus,
      });
      setMessage(nextStatus === "solved" ? "해결됨으로 변경되었습니다." : "진행중으로 변경되었습니다.");
    } catch (error) {
      console.error(error);
      setMessage("상태 변경에 실패했습니다.");
    }
  };

  const handleClearAll = async () => {
    const ok = window.confirm("전체 데이터를 삭제할까요?");
    if (!ok) return;

    try {
      await remove(ref(db, REPORTS_PATH));
      setMessage("전체 데이터가 초기화되었습니다.");
    } catch (error) {
      console.error(error);
      setMessage("관리자 권한이 필요합니다.");
    }
  };

  if (!nickname) {
    return (
      <div style={styles.joinScreen}>
        <style>{globalCss}</style>
        {message ? <div style={styles.toast}>{message}</div> : null}

        <div style={styles.joinWrap}>
          <DaisyLogo size={64} />
          <div style={styles.joinTitle}>물금동아</div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              whiteSpace: "nowrap",
              overflow: "visible",
              marginTop: 4,
              marginBottom: 18,
              padding: "0 8px",
              flexWrap: "nowrap",
            }}
          >
            <DaisyLetter letter="데" />
            <span style={{ fontSize: 12, fontWeight: 800, color: "#78350f" }}>이터를</span>
            <DaisyLetter letter="이" />
            <span style={{ fontSize: 12, fontWeight: 800, color: "#78350f" }}>용한</span>
            <DaisyLetter letter="지" />
            <span style={{ fontSize: 12, fontWeight: 800, color: "#78350f" }}>역 쓰레기 해결</span>
          </div>

          <div style={styles.joinCard}>
            <div style={styles.joinCardTitle}>반가워요 활동가님!</div>
            <div style={styles.joinCardSub}>
              실시간 지도에 합류하기 위해
              <br />
              학번과 이름을 입력해 주세요.
            </div>

            <form onSubmit={handleJoin}>
              <input
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                placeholder="예: 30101_홍길동"
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
                프로젝트 합류하기
                <span style={{ fontSize: 24, lineHeight: 0, opacity: 0.95 }}>›</span>
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
            <MapContainer
              center={DEFAULT_CENTER}
              zoom={14}
              style={styles.mapContainer}
              preferCanvas={true}
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapSizeFixer />

              {reports.map((report) => (
                <Marker
                  key={report.id}
                  position={[report.location.lat, report.location.lng]}
                  icon={makeMarkerIcon(report.category)}
                >
                  <Popup>
                    <div style={{ minWidth: 160 }}>
                      <div>
                        <strong>
                          {getCategory(report.category).icon} {getCategory(report.category).label}
                        </strong>
                      </div>
                      <div style={{ marginTop: 6, fontSize: 13 }}>지역: {report.area}</div>
                      <div style={{ fontSize: 13 }}>작성자: {report.userName}</div>
                      <div style={{ fontSize: 13 }}>상태: {report.status === "solved" ? "해결됨" : "진행중"}</div>
                      <div style={{ marginTop: 6, fontSize: 13 }}>{report.description}</div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>

            <button style={styles.recordFab} onClick={() => setShowAddSheet(true)}>
              기록하기 +
            </button>
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
                const canToggle =
                  isAdmin ||
                  report.status === "pending" ||
                  (report.status === "solved" && isOwner);

                const statusButtonStyle =
                  report.status === "solved" ? styles.statusSolved : styles.statusPending;

                const statusLabel = report.status === "solved" ? "해결됨 ✓" : "진행중";

                return (
                  <div key={report.id} style={styles.feedCard}>
                    <div style={styles.feedCardTop}>
                      <div style={styles.areaBadge}>
                        {cat.icon} {report.area}
                      </div>

                      <button
                        onClick={() => canToggle && handleToggleStatus(report)}
                        style={{
                          ...statusButtonStyle,
                          opacity: canToggle ? 1 : 0.55,
                          cursor: canToggle ? "pointer" : "not-allowed",
                        }}
                      >
                        {statusLabel}
                      </button>
                    </div>

                    {report.image ? <img src={report.image} alt="record" style={styles.feedImage} /> : null}

                    <div style={styles.feedText}>{report.description || "내용 없음"}</div>

                    <div style={styles.feedFooter}>
                      <div style={styles.feedUser}>👤 {report.userName}</div>
                      {canDelete ? (
                        <button onClick={() => handleDelete(report.id)} style={styles.deleteButton}>
                          삭제
                        </button>
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
                    <div
                      style={{
                        ...styles.categoryStatIcon,
                        background: item.color,
                      }}
                    >
                      {item.icon}
                    </div>
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
                <button onClick={handleClearAll} style={styles.adminButton}>
                  데이터 전체 초기화
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

      {showAddSheet && (
        <div style={styles.sheetBackdrop}>
          <div style={styles.addSheet}>
            <div style={styles.sheetHeader}>
              <div style={styles.sheetTitle}>NEW RECORD</div>
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
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapSizeFixer />
                <ClickLocationPicker
                  selectedLocation={formData.location}
                  onChange={(loc) => setFormData((prev) => ({ ...prev, location: loc }))}
                />
              </MapContainer>
            </div>

            <div style={styles.helpCopy}>작은 지도에서 위치를 한 번 눌러 주세요.</div>

            <div style={styles.topActionGrid}>
              <button type="button" onClick={handleCurrentLocation} style={styles.actionCardDark}>
                <div style={{ fontSize: 20 }}>📍</div>
                <div style={styles.actionCardLabelWhite}>내 위치 잡기</div>
              </button>

              <label style={styles.actionCardLight}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  style={{ display: "none" }}
                />

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
              </label>
            </div>

            <select
              value={formData.area}
              onChange={(e) => setFormData((prev) => ({ ...prev, area: e.target.value }))}
              style={styles.selectBox}
            >
              {AREAS.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
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
                    borderColor: formData.category === cat.id ? GREEN : "transparent",
                    boxShadow:
                      formData.category === cat.id
                        ? "inset 0 0 0 1px rgba(251,191,36,0.25)"
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
              {user ? "지도에 업로드" : "로그인 연결 중..."}
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
  * { box-sizing: border-box; }
  button, input, textarea, select { font: inherit; }
  .leaflet-container {
    width: 100%;
    height: 100%;
    background: #fefce8;
  }
  .trash-map-marker,
  .trash-map-picker {
    background: transparent !important;
    border: none !important;
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
    background: BG,
    overflowY: "auto",
  },
  joinWrap: {
    minHeight: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 16px 36px",
  },
  joinTitle: {
    fontSize: 32,
    fontWeight: 900,
    color: NAVY,
    letterSpacing: "-0.04em",
    marginTop: 2,
    marginBottom: 6,
    lineHeight: 1.1,
  },
  joinCard: {
    width: "100%",
    maxWidth: 640,
    background: "white",
    borderRadius: 40,
    marginTop: 10,
    padding: "32px 24px 24px",
    boxShadow: "0 18px 36px rgba(0,0,0,0.08)",
    border: `1px solid ${BORDER}`,
  },
  joinCardTitle: {
    textAlign: "center",
    color: "#78350f",
    fontWeight: 900,
    fontSize: 28,
    letterSpacing: "-0.04em",
  },
  joinCardSub: {
    textAlign: "center",
    color: LIGHT_TEXT,
    lineHeight: 1.6,
    fontSize: 14,
    fontWeight: 700,
    marginTop: 10,
    marginBottom: 22,
  },
  joinInput: {
    width: "100%",
    background: BG,
    border: `2px solid ${BORDER}`,
    borderRadius: 22,
    padding: "18px 14px",
    fontSize: 18,
    fontWeight: 800,
    color: "#9ca3af",
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
    boxShadow: "0 12px 24px rgba(251,191,36,0.22)",
    cursor: "pointer",
  },
  headerBar: {
    height: 72,
    background: "white",
    borderBottom: `1px solid ${BORDER}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 10px",
    flexShrink: 0,
  },
  adminPill: {
    minWidth: 88,
    height: 40,
    borderRadius: 999,
    border: `1px solid ${BORDER}`,
    color: "#b45309",
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#fff8dc",
    fontSize: 14,
  },
  userPill: {
    minWidth: 88,
    height: 40,
    borderRadius: 999,
    border: `1px solid ${BORDER}`,
    color: "#b45309",
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#fff8dc",
    padding: "0 12px",
    fontSize: 13,
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
  },
  mapPage: {
    position: "relative",
    width: "100%",
    height: "100%",
    minHeight: 0,
  },
  mapContainer: {
    width: "100%",
    height: "100%",
  },
  recordFab: {
    position: "absolute",
    left: "50%",
    bottom: 86,
    transform: "translateX(-50%)",
    border: "none",
    background: "#8c3f0b",
    color: "white",
    fontSize: 17,
    fontWeight: 900,
    padding: "18px 32px",
    borderRadius: 999,
    boxShadow: "0 14px 28px rgba(120,53,15,0.22)",
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
    color: "#78350f",
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
    color: "#b45309",
    padding: "7px 10px",
    background: "#fff8dc",
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
  deleteButton: {
    border: "none",
    background: "transparent",
    color: "#ef9a9a",
    fontWeight: 900,
    fontSize: 13,
    cursor: "pointer",
  },
  totalBox: {
    background: "#78350f",
    borderRadius: 40,
    padding: "34px 16px 24px",
    textAlign: "center",
    boxShadow: "0 14px 28px rgba(120,53,15,0.18)",
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
    color: "#78350f",
    fontWeight: 900,
    fontSize: 18,
    marginBottom: 14,
  },
  categoryStatsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
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
    minHeight: 116,
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
    color: "#78350f",
    fontSize: 12,
    fontWeight: 800,
    marginBottom: 6,
    lineHeight: 1.35,
  },
  categoryStatCount: {
    color: GREEN,
    fontSize: 24,
    fontWeight: 900,
    lineHeight: 1,
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
    height: 82,
    background: "white",
    borderTop: `1px solid ${BORDER}`,
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    alignItems: "center",
    flexShrink: 0,
    paddingBottom: 4,
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
    zIndex: 2000,
  },
  addSheet: {
    width: "100%",
    maxWidth: 800,
    maxHeight: "88vh",
    overflowY: "auto",
    background: BG,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: "18px 14px 22px",
    boxShadow: "0 -14px 36px rgba(0,0,0,0.16)",
  },
  sheetHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sheetTitle: {
    color: "#78350f",
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
    background: "#78350f",
    color: "white",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    boxShadow: "0 8px 18px rgba(120,53,15,0.18)",
    cursor: "pointer",
  },
  actionCardLabelWhite: {
    fontSize: 11,
    fontWeight: 900,
    color: "white",
  },
  actionCardLight: {
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
    color: "#78350f",
    marginBottom: 12,
    outline: "none",
  },
  categoryGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginBottom: 12,
  },
  categoryCard: {
    border: "2px solid transparent",
    background: "white",
    borderRadius: 20,
    minHeight: 68,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0 14px",
    cursor: "pointer",
  },
  categoryCardText: {
    color: "#78350f",
    fontSize: 12,
    fontWeight: 900,
  },
  textAreaBox: {
    width: "100%",
    minHeight: 120,
    borderRadius: 24,
    border: "2px solid #f6ead3",
    background: "white",
    padding: "16px 14px",
    fontSize: 15,
    color: "#78350f",
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
    boxShadow: "0 14px 24px rgba(251,191,36,0.20)",
  },
  toast: {
    position: "fixed",
    top: 14,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#78350f",
    color: "white",
    padding: "10px 18px",
    borderRadius: 14,
    zIndex: 4000,
    boxShadow: "0 12px 24px rgba(0,0,0,0.18)",
    fontWeight: 800,
    fontSize: 14,
    whiteSpace: "nowrap",
    maxWidth: "90vw",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
};