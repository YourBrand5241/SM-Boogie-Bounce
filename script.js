// ==== CONFIG ====
const SUPABASE_URL = "https://jywhymtctdnvwwvxtcpw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8-VfhsJiclZMwjjkZ-k18A_gLYKbaGR";
const BUSINESS_ID = "shauna-may-dance";
const BUSINESS_NAME = "Shauna-May's School of Dance";

// EmailJS — same account/template as your other sites.
const EMAILJS_SERVICE_ID = "service_zzjha2e";
const EMAILJS_TEMPLATE_ID = "template_khedkjr";
const EMAILJS_PUBLIC_KEY = "fs6q7ZsiYGhRUtas5";

// ASSUMPTIONS — swap these for the real schedule/pricing/capacity.
const CLASS_DAYS = {
  kids: ["Monday"],
  adult: ["Wednesday", "Friday"],
};
const CLASS_TIME = "6:00pm"; // both classes run 6-7pm
const CLASS_CAPACITY = 20; // spots per session

const PACKAGES = {
  kids: [
    { size: 1, name: "Weekly Junior Class", price: 7.00 },
  ],
  adult: [
    { size: 1, name: "1 class / week", price: 7.00 },
    { size: 2, name: "2 classes / week", price: 13.00 },
  ],
};

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
if (window.emailjs) emailjs.init(EMAILJS_PUBLIC_KEY);

let selectedCategory = "kids";
let selectedPackage = null;
let selectedDays = [];
let dayCounts = {}; // { "kids-Monday": 7, ... }

function formatPrice(amount) {
  return `£${amount.toFixed(2)}`;
}

function getCategoryLabel() {
  return selectedCategory === "kids" ? "Kids Boogie Bounce" : "Adult Boogie Bounce";
}

async function loadDayCounts() {
  const { data } = await supabaseClient
    .from("public_class_availability")
    .select("category, chosen_days")
    .eq("business_id", BUSINESS_ID);

  dayCounts = {};
  (data || []).forEach(row => {
    (row.chosen_days || []).forEach(day => {
      const key = `${row.category}-${day}`;
      dayCounts[key] = (dayCounts[key] || 0) + 1;
    });
  });
}

function renderPackages() {
  const list = document.getElementById("package-list");
  const heading = document.getElementById("package-heading");
  const options = PACKAGES[selectedCategory];
  list.innerHTML = "";

  if (options.length === 1) {
    // Nothing to choose — just confirm the one option and move on.
    selectedPackage = options[0];
    heading.textContent = "2. Your class";
    list.innerHTML = `
      <div class="product-card selected">
        <div class="package-name">${options[0].name}</div>
        <div class="package-price">${formatPrice(options[0].price)}</div>
      </div>
    `;
    return;
  }

  heading.textContent = "2. Choose your package";
  options.forEach(pkg => {
    const card = document.createElement("div");
    card.className = "product-card" + (selectedPackage && selectedPackage.size === pkg.size ? " selected" : "");
    card.innerHTML = `
      <div class="package-name">${pkg.name}</div>
      <div class="package-price">${formatPrice(pkg.price)}</div>
    `;
    card.addEventListener("click", () => {
      selectedPackage = pkg;
      selectedDays = [];
      renderPackages();
      renderDays();
      renderSummary();
    });
    list.appendChild(card);
  });
}

function renderDays() {
  const list = document.getElementById("days-list");
  const instruction = document.getElementById("days-instruction");
  list.innerHTML = "";

  if (!selectedPackage) {
    instruction.textContent = "Choose a package first";
    return;
  }

  const availableDays = CLASS_DAYS[selectedCategory];

  // If the number of available days exactly matches the package size,
  // there's no real choice to make — select them all automatically.
  if (availableDays.length === selectedPackage.size) {
    selectedDays = [...availableDays];
    instruction.textContent = selectedPackage.size === 1
      ? `Your class day: ${availableDays[0]}`
      : `Your class days: ${availableDays.join(" & ")}`;

    availableDays.forEach(day => {
      const key = `${selectedCategory}-${day}`;
      const taken = dayCounts[key] || 0;
      const spotsLeft = CLASS_CAPACITY - taken;
      const el = document.createElement("div");
      el.className = "day-option selected";
      el.innerHTML = `<span>${day}</span><span class="day-spots">${spotsLeft} spots left</span>`;
      list.appendChild(el);
    });
    renderSummary();
    return;
  }

  instruction.textContent = `Pick ${selectedPackage.size} day${selectedPackage.size > 1 ? "s" : ""}`;

  availableDays.forEach(day => {
    const key = `${selectedCategory}-${day}`;
    const taken = dayCounts[key] || 0;
    const spotsLeft = CLASS_CAPACITY - taken;
    const isFull = spotsLeft <= 0;
    const isSelected = selectedDays.includes(day);

    const el = document.createElement("div");
    el.className = "day-option" + (isSelected ? " selected" : "") + (isFull ? " full" : "");
    el.innerHTML = `
      <span>${day}</span>
      <span class="day-spots">${isFull ? "Full" : `${spotsLeft} spots left`}</span>
    `;

    if (!isFull) {
      el.addEventListener("click", () => toggleDay(day));
    }

    list.appendChild(el);
  });
}

function toggleDay(day) {
  if (selectedDays.includes(day)) {
    selectedDays = selectedDays.filter(d => d !== day);
  } else {
    if (selectedDays.length >= selectedPackage.size) {
      alert(`Your ${selectedPackage.name} package lets you pick ${selectedPackage.size} day${selectedPackage.size > 1 ? "s" : ""} — remove one first to change your choice.`);
      return;
    }
    selectedDays.push(day);
  }
  renderDays();
  renderSummary();
}

function renderSummary() {
  const summaryEl = document.getElementById("summary");
  const totalEl = document.getElementById("basket-total");

  if (!selectedPackage || selectedDays.length === 0) {
    summaryEl.innerHTML = `<p class="empty-basket">Choose a package and days to continue</p>`;
    totalEl.textContent = formatPrice(0);
  } else {
    summaryEl.innerHTML = `
      <p><strong>${getCategoryLabel()}</strong></p>
      <p>${selectedPackage.name}</p>
      <p>Days: ${selectedDays.join(", ")}</p>
    `;
    totalEl.textContent = formatPrice(selectedPackage.price);
  }
  updateCheckoutAvailability();
}

function updateCheckoutAvailability() {
  const nameInput = document.getElementById("customer-name");
  const emailInput = document.getElementById("customer-email");
  const phoneInput = document.getElementById("customer-phone");
  const startDateInput = document.getElementById("start-date");
  const checkoutBtn = document.getElementById("checkout-btn");

  checkoutBtn.disabled = !selectedPackage
    || selectedDays.length !== selectedPackage.size
    || !nameInput.value.trim() || !emailInput.value.trim() || !phoneInput.value.trim()
    || !startDateInput.value;
}

async function confirmSignUp() {
  const nameInput = document.getElementById("customer-name");
  const emailInput = document.getElementById("customer-email");
  const phoneInput = document.getElementById("customer-phone");
  const startDateInput = document.getElementById("start-date");
  const durationInput = document.querySelector('input[name="duration"]:checked');
  const durationWeeks = durationInput.value ? Number(durationInput.value) : null;
  const durationLabel = durationWeeks ? `${durationWeeks} weeks` : "ongoing, until cancelled";

  if (!selectedPackage || selectedDays.length !== selectedPackage.size
    || !nameInput.value.trim() || !emailInput.value.trim() || !phoneInput.value.trim()
    || !startDateInput.value) return;

  const { error } = await supabaseClient.from("class_enrollments").insert({
    business_id: BUSINESS_ID,
    category: selectedCategory,
    package_size: selectedPackage.size,
    chosen_days: selectedDays,
    price_per_week: selectedPackage.price,
    customer_name: nameInput.value.trim(),
    customer_email: emailInput.value.trim(),
    customer_phone: phoneInput.value.trim(),
    start_date: startDateInput.value,
    duration_weeks: durationWeeks,
  });

  if (error) {
    alert("Something went wrong saving your sign-up — please try again.");
    console.error(error);
    return;
  }

  if (window.emailjs) {
    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      to_email: emailInput.value.trim(),
      to_name: nameInput.value.trim(),
      business_name: BUSINESS_NAME,
      email_subject: `Sign-up confirmed — ${BUSINESS_NAME}`,
      email_body: `You're signed up with ${BUSINESS_NAME}.\n\n${getCategoryLabel()} — ${selectedPackage.name} (${selectedDays.join(", ")})\nEvery week at ${CLASS_TIME}\nStarting: ${startDateInput.value} (${durationLabel})\nTotal: ${formatPrice(selectedPackage.price)}/week`,
    }).catch(err => console.error("Confirmation email failed to send:", err));
  }

  document.getElementById("confirmation-overlay").classList.remove("hidden");

  selectedPackage = null;
  selectedDays = [];
  nameInput.value = "";
  emailInput.value = "";
  phoneInput.value = "";
  startDateInput.value = "";
  await loadDayCounts();
  renderPackages();
  renderDays();
  renderSummary();
}

function setupCategoryToggle() {
  document.querySelectorAll('input[name="category"]').forEach(radio => {
    radio.addEventListener("change", () => {
      selectedCategory = radio.value;
      selectedPackage = null;
      selectedDays = [];
      renderPackages();
      renderDays();
      renderSummary();
    });
  });
}

function setupCheckout() {
  const overlay = document.getElementById("confirmation-overlay");
  document.getElementById("checkout-btn").addEventListener("click", confirmSignUp);
  document.getElementById("close-overlay").addEventListener("click", () => overlay.classList.add("hidden"));
}

["customer-name", "customer-email", "customer-phone"].forEach(id => {
  document.getElementById(id).addEventListener("input", updateCheckoutAvailability);
});
document.getElementById("start-date").addEventListener("change", updateCheckoutAvailability);

function setupStartDateMin() {
  const startDateInput = document.getElementById("start-date");
  const today = new Date();
  const pad = n => String(n).padStart(2, "0");
  startDateInput.min = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
}

(async function init() {
  await loadDayCounts();
  renderPackages();
  renderDays();
  renderSummary();
  setupCategoryToggle();
  setupCheckout();
  setupStartDateMin();
})();
