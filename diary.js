// ==== CONFIG ====
const SUPABASE_URL = "https://jywhymtctdnvwwvxtcpw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8-VfhsJiclZMwjjkZ-k18A_gLYKbaGR";
const BUSINESS_ID = "shauna-may-dance";

const CLASS_DAYS = {
  kids: ["Monday"],
  adult: ["Wednesday", "Friday"],
};
const CLASS_CAPACITY = 20;

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

function statusFor(taken) {
  const spotsLeft = CLASS_CAPACITY - taken;
  if (spotsLeft <= 0) return { text: "Full", cls: "diary-full" };
  if (spotsLeft <= 5) return { text: `${spotsLeft} spots left`, cls: "diary-nearly-full" };
  return { text: `${spotsLeft} spots left`, cls: "diary-available" };
}

async function loadDiary() {
  const { data } = await supabaseClient
    .from("public_class_availability")
    .select("category, chosen_days")
    .eq("business_id", BUSINESS_ID);

  const counts = {};
  (data || []).forEach(row => {
    (row.chosen_days || []).forEach(day => {
      const key = `${row.category}-${day}`;
      counts[key] = (counts[key] || 0) + 1;
    });
  });

  renderCategory("kids", "kids-list", counts);
  renderCategory("adult", "adult-list", counts);
  loadCancelledSessions();
}

function renderCategory(category, elementId, counts) {
  const listEl = document.getElementById(elementId);
  listEl.innerHTML = "";
  CLASS_DAYS[category].forEach(day => {
    const taken = counts[`${category}-${day}`] || 0;
    const status = statusFor(taken);
    const row = document.createElement("div");
    row.className = `diary-row ${status.cls}`;
    row.innerHTML = `<span>${day}</span><span>${status.text}</span>`;
    listEl.appendChild(row);
  });
}

async function loadCancelledSessions() {
  const listEl = document.getElementById("cancelled-list");
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const { data } = await supabaseClient
    .from("blocked_class_sessions")
    .select("*")
    .eq("business_id", BUSINESS_ID)
    .gte("session_date", todayStr)
    .order("session_date", { ascending: true });

  if (!data || data.length === 0) {
    listEl.innerHTML = `<p class="empty-basket">No cancelled sessions coming up.</p>`;
    return;
  }

  listEl.innerHTML = "";
  data.forEach(row => {
    const el = document.createElement("div");
    el.className = "diary-row diary-blocked";
    const label = row.category === "kids" ? "Kids Boogie Bounce" : "Adult Boogie Bounce";
    el.innerHTML = `<span>${row.session_date} — ${label}</span><span>${row.reason || "Cancelled"}</span>`;
    listEl.appendChild(el);
  });
}

loadDiary();
