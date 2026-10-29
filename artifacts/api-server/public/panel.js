const loginCard = document.querySelector("#login-card");
const dashboard = document.querySelector("#dashboard");
const loginForm = document.querySelector("#login-form");
const passwordInput = document.querySelector("#password");
const loginError = document.querySelector("#login-error");
const configurationNote = document.querySelector("#configuration-note");
const pageError = document.querySelector("#page-error");
const statusPill = document.querySelector("#status-pill");
const statusLabel = document.querySelector("#status-label");
const statusDetail = document.querySelector("#status-detail");
const actionMessage = document.querySelector("#action-message");

const statusLabels = {
  connected: "Connected",
  connecting: "Connecting",
  disconnected: "Disconnected",
  error: "Needs attention",
};

async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

function showError(element, message) {
  element.textContent = message;
  element.hidden = false;
}

function clearError(element) {
  element.textContent = "";
  element.hidden = true;
}

function setAuthenticated(authenticated, configured) {
  loginCard.hidden = authenticated;
  dashboard.hidden = !authenticated;
  configurationNote.hidden = configured;
  passwordInput.disabled = !configured;
  loginForm.querySelector("button").disabled = !configured;
  clearError(loginError);
}

function renderStatus(data) {
  const status = data.status in statusLabels ? data.status : "disconnected";
  statusPill.className = `status-pill status-${status}`;
  statusLabel.textContent = statusLabels[status];
  statusDetail.textContent =
    data.error ||
    (data.userID
      ? `Connected account · ${data.userID}`
      : status === "connecting"
        ? "The bot is establishing its Messenger connection."
        : status === "connected"
          ? "The Messenger connection is active."
          : "The bot is not connected. Check the service variables and logs.");
}

async function refreshSession() {
  try {
    const session = await request("/api/auth/session");
    setAuthenticated(session.authenticated, session.configured);
    clearError(pageError);
    if (session.authenticated) {
      renderStatus(await request("/api/bot/status"));
    }
  } catch (error) {
    setAuthenticated(false, false);
    showError(pageError, error.message || "Could not reach the service.");
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError(loginError);
  const button = loginForm.querySelector("button");
  button.disabled = true;
  try {
    await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password: passwordInput.value }),
    });
    passwordInput.value = "";
    await refreshSession();
  } catch (error) {
    showError(loginError, error.message || "Sign-in failed.");
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#refresh-button").addEventListener("click", async () => {
  try {
    renderStatus(await request("/api/bot/status"));
    actionMessage.textContent = "Status updated.";
    actionMessage.hidden = false;
  } catch (error) {
    showError(pageError, error.message);
  }
});

document.querySelector("#restart-button").addEventListener("click", async () => {
  if (!window.confirm("Reconnect the bot now?")) return;
  const button = document.querySelector("#restart-button");
  button.disabled = true;
  actionMessage.hidden = true;
  try {
    const result = await request("/api/bot/restart", { method: "POST" });
    actionMessage.textContent = result.message || "Reconnect started.";
    actionMessage.hidden = false;
    window.setTimeout(refreshSession, 1500);
  } catch (error) {
    showError(pageError, error.message);
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#logout-button").addEventListener("click", async () => {
  try {
    await request("/api/auth/logout", { method: "POST" });
  } finally {
    setAuthenticated(false, true);
  }
});

void refreshSession();
window.setInterval(() => {
  if (!dashboard.hidden) void refreshSession();
}, 15_000);
