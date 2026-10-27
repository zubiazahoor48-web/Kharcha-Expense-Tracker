"use strict";

const STORAGE_KEY = "kharcha.transactions.v1";
const CATEGORIES = {
  expense: ["Food", "Transport", "Bills", "Shopping", "Health", "Education", "Other"],
  income: ["Salary", "Freelance", "Gift", "Other"],
};
const CHART_COLORS = ["#0f766e", "#4f46e5", "#0891b2", "#7c3aed", "#14b8a6", "#6366f1", "#94a3b8"];

const $ = (sel) => document.querySelector(sel);
const money = (n) =>
  new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(n);
const escapeHTML = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const today = () => new Date().toISOString().slice(0, 10);

let transactions = load();
let chart = null;
const modal = new bootstrap.Modal("#txModal");
const toast = new bootstrap.Toast("#toast", { delay: 2200 });

/* ---------- Storage ---------- */
function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}
function notify(msg) {
  $("#toastMsg").textContent = msg;
  toast.show();
}

/* ---------- Filtering ---------- */
function filtered() {
  const q = $("#search").value.trim().toLowerCase();
  const type = $("#typeFilter").value;
  const month = $("#monthFilter").value;
  return transactions
    .filter((t) => (type === "all" || t.type === type) && (month === "all" || t.date.startsWith(month)))
    .filter((t) => t.description.toLowerCase().includes(q))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function renderMonths() {
  const select = $("#monthFilter");
  const current = select.value || "all";
  const months = [...new Set(transactions.map((t) => t.date.slice(0, 7)))].sort().reverse();
  select.innerHTML =
    `<option value="all">All months</option>` +
    months
      .map((m) => {
        const label = new Date(m + "-01").toLocaleDateString("en-GB", { month: "long", year: "numeric" });
        return `<option value="${m}">${label}</option>`;
      })
      .join("");
  select.value = months.includes(current) ? current : "all";
}

/* ---------- Rendering ---------- */
function render() {
  const list = filtered();

  const income = list.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = list.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  $("#income").textContent = money(income);
  $("#expense").textContent = money(expense);
  $("#balance").textContent = money(income - expense);

  $("#rows").innerHTML = list
    .map(
      (t) => `
      <tr>
        <td class="text-nowrap">${new Date(t.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
        <td>${escapeHTML(t.description)}</td>
        <td><span class="badge-cat">${t.category}</span></td>
        <td class="text-end fw-semibold ${t.type === "income" ? "text-income" : "text-expense"}">
          ${t.type === "income" ? "+" : "−"}${money(t.amount)}
        </td>
        <td class="text-end text-nowrap row-actions">
          <button class="btn btn-outline-secondary" data-edit="${t.id}">Edit</button>
          <button class="btn btn-outline-danger" data-delete="${t.id}">Delete</button>
        </td>
      </tr>`
    )
    .join("");

  $("#empty").classList.toggle("d-none", list.length > 0);
  $(".table-responsive").classList.toggle("d-none", list.length === 0);
  renderChart(list);
}

function renderChart(list) {
  const totals = {};
  list.filter((t) => t.type === "expense").forEach((t) => (totals[t.category] = (totals[t.category] || 0) + t.amount));
  const labels = Object.keys(totals);
  const hasData = labels.length > 0;

  $("#chartWrap").classList.toggle("d-none", !hasData);
  $("#chartEmpty").classList.toggle("d-none", hasData);
  if (chart) chart.destroy();
  if (!hasData) return;

  chart = new Chart($("#chart"), {
    type: "doughnut",
    data: { labels, datasets: [{ data: labels.map((l) => totals[l]), backgroundColor: CHART_COLORS, borderWidth: 2 }] },
    options: {
      cutout: "62%",
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 12, font: { family: "Manrope" } } },
        tooltip: { callbacks: { label: (c) => ` ${c.label}: ${money(c.parsed)}` } },
      },
    },
  });
}

/* ---------- Modal / form ---------- */
function fillCategories(type, selected) {
  $("#category").innerHTML = CATEGORIES[type].map((c) => `<option ${c === selected ? "selected" : ""}>${c}</option>`).join("");
}

function openModal(tx) {
  const form = $("#txForm");
  form.classList.remove("was-validated");
  form.reset();
  $("#txId").value = tx ? tx.id : "";
  $("#modalTitle").textContent = tx ? "Edit transaction" : "Add transaction";
  const type = tx ? tx.type : "expense";
  $(type === "income" ? "#typeIncome" : "#typeExpense").checked = true;
  fillCategories(type, tx && tx.category);
  $("#desc").value = tx ? tx.description : "";
  $("#amount").value = tx ? tx.amount : "";
  $("#date").value = tx ? tx.date : today();
  modal.show();
}

document.querySelectorAll('input[name="type"]').forEach((r) =>
  r.addEventListener("change", (e) => fillCategories(e.target.value))
);

$("#txForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.target;
  if (!form.checkValidity()) {
    form.classList.add("was-validated");
    return;
  }
  const id = $("#txId").value;
  const data = {
    type: form.querySelector('input[name="type"]:checked').value,
    description: $("#desc").value.trim(),
    amount: Number($("#amount").value),
    date: $("#date").value,
    category: $("#category").value,
  };
  if (id) {
    transactions = transactions.map((t) => (t.id === id ? { ...t, ...data } : t));
    notify("Transaction updated");
  } else {
    transactions.push({ id: crypto.randomUUID(), ...data });
    notify("Transaction added");
  }
  save();
  modal.hide();
  renderMonths();
  render();
});

/* ---------- Events ---------- */
$("#addBtn").addEventListener("click", () => openModal());
$("#emptyAdd").addEventListener("click", () => openModal());
["#search", "#typeFilter", "#monthFilter"].forEach((s) => $(s).addEventListener("input", render));

$("#rows").addEventListener("click", (e) => {
  const editId = e.target.dataset.edit;
  const delId = e.target.dataset.delete;
  if (editId) openModal(transactions.find((t) => t.id === editId));
  if (delId && confirm("Delete this transaction?")) {
    transactions = transactions.filter((t) => t.id !== delId);
    save();
    renderMonths();
    render();
    notify("Transaction deleted");
  }
});

$("#sampleBtn").addEventListener("click", () => {
  const d = (offset) => {
    const x = new Date();
    x.setDate(x.getDate() - offset);
    return x.toISOString().slice(0, 10);
  };
  const sample = [
    ["income", "Freelance project", 85000, "Freelance", 20],
    ["income", "Monthly salary", 60000, "Salary", 12],
    ["expense", "Groceries", 7200, "Food", 11],
    ["expense", "Electricity bill", 9800, "Bills", 9],
    ["expense", "Fuel", 4500, "Transport", 7],
    ["expense", "Online course", 12000, "Education", 5],
    ["expense", "Lunch with team", 2600, "Food", 3],
    ["expense", "Pharmacy", 1800, "Health", 1],
  ];
  sample.forEach(([type, description, amount, category, off]) =>
    transactions.push({ id: crypto.randomUUID(), type, description, amount, category, date: d(off) })
  );
  save();
  renderMonths();
  render();
  notify("Sample data loaded");
});

$("#exportBtn").addEventListener("click", () => {
  if (!transactions.length) return notify("Nothing to export yet");
  const rows = [["Date", "Type", "Category", "Description", "Amount"]].concat(
    filtered().map((t) => [t.date, t.type, t.category, t.description, t.amount])
  );
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "kharcha-transactions.csv";
  a.click();
  URL.revokeObjectURL(a.href);
});

/* ---------- Init ---------- */
renderMonths();
render();