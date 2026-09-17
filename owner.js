// ==== CONFIG ====
const SUPABASE_URL = "https://jywhymtctdnvwwvxtcpw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8-VfhsJiclZMwjjkZ-k18A_gLYKbaGR";
const BUSINESS_ID = "shauna-may-dance";
const BUSINESS_NAME = "Shauna-May's School of Dance";

// EmailJS — same account as your other sites, plus a dedicated
// cancellation template (see chat for setup).
const EMAILJS_SERVICE_ID = "service_zzjha2e";
const EMAILJS_PUBLIC_KEY = "fs6q7ZsiYGhRUtas5";
const EMAILJS_TEMPLATE_ID = "template_khedkjr";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
if (window.emailjs && EMAILJS_PUBLIC_KEY !== "YOUR_PUBLIC_KEY") {
  emailjs.init(EMAILJS_PUBLIC_KEY);
}

function formatPrice(amount) {
  return `£${Number(amount).toFixed(2)}`;
}

async function checkSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) await enterDashboard(session);
}

async function enterDashboard(session) {
  const { data: ownerRows, error } = await supabaseClient
    .from("business_owners")
    .select("business_id")
    .eq("business_id", BUSINESS_ID)
    .eq("owner_user_id", session.user.id);

  if (error || !ownerRows || ownerRows.length === 0) {
    document.getElementById("login-message").textContent = "This account isn't linked to Shauna-May's School of Dance.";
    await supabaseClient.auth.signOut();
    return;
  }

  document.getElementById("login-section").classList.add("hidden");
  document.getElementById("dashboard-section").classList.remove("hidden");
  document.getElementById("signed-in-as").textContent = `Signed in as ${session.user.email}`;

  loadMembers();
  loadBlockedSessions();
}

async function handleLogin() {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const message = document.getElementById("login-message");

  if (!email || !password) {
    message.textContent = "Enter both email and password.";
    return;
  }

  message.textContent = "Signing in…";
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    message.textContent = "Sign in failed — check your email and password.";
    return;
  }

  message.textContent = "";
  await enterDashboard(data.session);
}

async function handleSignOut() {
  await supabaseClient.auth.signOut();
  document.getElementById("dashboard-section").classList.add("hidden");
  document.getElementById("login-section").classList.remove("hidden");
  document.getElementById("login-email").value = "";
  document.getElementById("login-password").value = "";
}

async function loadMembers() {
  const listEl = document.getElementById("members-list");
  listEl.innerHTML = "<p class=\"empty-basket\">Loading…</p>";

  const { data, error } = await supabaseClient
    .from("class_enrollments")
    .select("*")
    .eq("business_id", BUSINESS_ID)
    .order("created_at", { ascending: false });

  if (error || !data || data.length === 0) {
    listEl.innerHTML = "<p class=\"empty-basket\">No one signed up yet.</p>";
    return;
  }

  listEl.innerHTML = "";
  data.forEach(enrollment => {
    const label = enrollment.category === "kids" ? "Kids Boogie Bounce" : "Adult Boogie Bounce";
    const durationLabel = enrollment.duration_weeks
      ? `${enrollment.duration_weeks} weeks (ends ${addWeeks(enrollment.start_date, enrollment.duration_weeks)})`
      : "ongoing";
    const row = document.createElement("div");
    row.className = "appointment-row";
    row.innerHTML = `
      <div>
        <strong>${enrollment.customer_name}</strong> — ${label}<br>
        ${enrollment.package_size} class/week: ${enrollment.chosen_days.join(", ")} — ${formatPrice(enrollment.price_per_week)}/week<br>
        Started ${enrollment.start_date || "unknown"} — ${durationLabel}<br>
        ${enrollment.customer_phone || "No phone"} · ${enrollment.customer_email || "No email"}
      </div>
      <button class="secondary-btn cancel-btn" data-id="${enrollment.id}">Remove</button>
    `;
    listEl.appendChild(row);
  });

  listEl.querySelectorAll(".cancel-btn").forEach(btn => {
    btn.addEventListener("click", () => removeMember(btn.dataset.id));
  });
}

async function removeMember(id) {
  if (!confirm("Remove this sign-up? This can't be undone.")) return;
  const { error } = await supabaseClient.from("class_enrollments").delete().eq("id", id);
  if (error) {
    alert("Couldn't remove — please try again.");
    return;
  }
  loadMembers();
}

async function handleBlockSession() {
  const categorySelect = document.getElementById("block-category");
  const dateInput = document.getElementById("block-date");
  const reasonInput = document.getElementById("block-reason");
  const message = document.getElementById("block-message");

  if (!dateInput.value) {
    message.textContent = "Choose a date first.";
    return;
  }

  const { error } = await supabaseClient.from("blocked_class_sessions").insert({
    business_id: BUSINESS_ID,
    category: categorySelect.value,
    session_date: dateInput.value,
    reason: reasonInput.value.trim() || null,
  });

  if (error) {
    message.textContent = "Something went wrong — please try again.";
    console.error(error);
    return;
  }

  message.textContent = "Cancelled — notifying affected members…";
  const notifiedCount = await notifyAffectedMembers(categorySelect.value, dateInput.value, reasonInput.value.trim());
  message.textContent = notifiedCount > 0
    ? `Cancelled — ${notifiedCount} member${notifiedCount > 1 ? "s" : ""} notified by email.`
    : "Cancelled. No enrolled members found for that day to notify.";

  dateInput.value = "";
  reasonInput.value = "";
  loadBlockedSessions();
}

function dayNameFromDate(dateStr) {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[new Date(dateStr + "T00:00:00").getDay()];
}

function addWeeks(dateStr, weeks) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + weeks * 7);
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isActiveOnDate(enrollment, sessionDate) {
  if (!enrollment.start_date) return true; // older sign-ups without a start date — assume active
  const session = new Date(sessionDate + "T00:00:00");
  const start = new Date(enrollment.start_date + "T00:00:00");
  if (session < start) return false;
  if (enrollment.duration_weeks) {
    const end = new Date(start);
    end.setDate(end.getDate() + enrollment.duration_weeks * 7);
    if (session >= end) return false;
  }
  return true;
}

async function notifyAffectedMembers(category, sessionDate, reason) {
  if (!window.emailjs) {
    console.warn("EmailJS not available — skipping notifications.");
    return 0;
  }

  const dayName = dayNameFromDate(sessionDate);
  const categoryLabel = category === "kids" ? "Kids Boogie Bounce" : "Adult Boogie Bounce";

  const { data, error } = await supabaseClient
    .from("class_enrollments")
    .select("customer_name, customer_email, chosen_days, start_date, duration_weeks")
    .eq("business_id", BUSINESS_ID)
    .eq("category", category);

  if (error) {
    console.error("Failed to fetch enrollments for notification:", error);
    return 0;
  }
  if (!data) return 0;

  const affected = data.filter(row =>
    (row.chosen_days || []).includes(dayName) && isActiveOnDate(row, sessionDate)
  );

  let sentCount = 0;
  for (const member of affected) {
    if (!member.customer_email) continue;
    try {
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        to_email: member.customer_email,
        to_name: member.customer_name || "there",
        business_name: BUSINESS_NAME,
        email_subject: `Class Cancelled — ${BUSINESS_NAME}`,
        email_body: `Unfortunately your ${categoryLabel} class on ${sessionDate} has been cancelled.\n\nReason: ${reason || "Unforeseen circumstances"}\n\nIf you've already paid for this session, your refund will be processed automatically back to your original payment method within 3-5 business days.\n\nSorry for the short notice — see you at the next session!`,
      });
      sentCount++;
    } catch (err) {
      console.error("Failed to notify", member.customer_email, err);
    }
  }
  return sentCount;
}

async function loadBlockedSessions() {
  const listEl = document.getElementById("blocked-list");
  listEl.innerHTML = "<p class=\"empty-basket\">Loading…</p>";

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const { data, error } = await supabaseClient
    .from("blocked_class_sessions")
    .select("*")
    .eq("business_id", BUSINESS_ID)
    .gte("session_date", todayStr)
    .order("session_date", { ascending: true });

  if (error || !data || data.length === 0) {
    listEl.innerHTML = "<p class=\"empty-basket\">Nothing currently cancelled.</p>";
    return;
  }

  listEl.innerHTML = "";
  data.forEach(row => {
    const label = row.category === "kids" ? "Kids Boogie Bounce" : "Adult Boogie Bounce";
    const el = document.createElement("div");
    el.className = "appointment-row";
    el.innerHTML = `
      <div>
        <strong>${row.session_date} — ${label}</strong><br>
        ${row.reason || "No reason given"}
      </div>
      <button class="secondary-btn unblock-btn" data-id="${row.id}">Un-cancel</button>
    `;
    listEl.appendChild(el);
  });

  listEl.querySelectorAll(".unblock-btn").forEach(btn => {
    btn.addEventListener("click", () => unblockSession(btn.dataset.id));
  });
}

async function unblockSession(id) {
  const { error } = await supabaseClient.from("blocked_class_sessions").delete().eq("id", id);
  if (error) {
    alert("Couldn't remove — please try again.");
    return;
  }
  loadBlockedSessions();
}

document.getElementById("login-btn").addEventListener("click", handleLogin);
document.getElementById("sign-out-btn").addEventListener("click", handleSignOut);
document.getElementById("block-btn").addEventListener("click", handleBlockSession);

checkSession();
