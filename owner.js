// ==== CONFIG ====
const SUPABASE_URL = "https://jywhymtctdnvwwvxtcpw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8-VfhsJiclZMwjjkZ-k18A_gLYKbaGR";
const BUSINESS_ID = "shauna-may-dance";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

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
    const row = document.createElement("div");
    row.className = "appointment-row";
    row.innerHTML = `
      <div>
        <strong>${enrollment.customer_name}</strong> — ${label}<br>
        ${enrollment.package_size} class/week: ${enrollment.chosen_days.join(", ")} — ${formatPrice(enrollment.price_per_week)}/week<br>
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

  message.textContent = "Cancelled.";
  dateInput.value = "";
  reasonInput.value = "";
  loadBlockedSessions();
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
