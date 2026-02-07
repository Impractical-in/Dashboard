(function initAgentChat() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const STYLE_ID = "dashboard-agent-chat-style";
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .agent-chat-launcher{position:fixed;right:18px;bottom:18px;z-index:9999;width:54px;height:54px;border-radius:999px;border:1px solid #243246;background:#8ec9ff;color:#0b0b0b;font-weight:700;cursor:pointer;box-shadow:0 10px 26px rgba(0,0,0,.35)}
      .agent-chat-panel{position:fixed;right:18px;bottom:84px;z-index:9999;width:min(390px,calc(100vw - 24px));height:min(540px,72vh);display:none;flex-direction:column;border:1px solid #243246;border-radius:14px;background:#0f1722;color:#e8f3ff;box-shadow:0 18px 44px rgba(0,0,0,.4)}
      .agent-chat-panel.open{display:flex}
      .agent-chat-head{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid #243246;font-size:14px}
      .agent-chat-log{flex:1;overflow:auto;padding:10px;display:flex;flex-direction:column;gap:8px}
      .agent-chat-msg{padding:8px 10px;border-radius:10px;max-width:90%;white-space:pre-wrap;word-break:break-word;font-size:13px;line-height:1.35}
      .agent-chat-msg.user{align-self:flex-end;background:#8ec9ff;color:#0b0b0b}
      .agent-chat-msg.bot{align-self:flex-start;background:#162131;color:#e8f3ff}
      .agent-chat-input{display:flex;gap:8px;padding:10px;border-top:1px solid #243246}
      .agent-chat-input textarea{flex:1;resize:none;height:64px;border:1px solid #243246;border-radius:10px;background:#111823;color:#e8f3ff;padding:8px}
      .agent-chat-input button{border-radius:10px;border:1px solid #243246;background:#8ec9ff;color:#0b0b0b;font-weight:700;padding:0 12px;cursor:pointer}
    `;
    document.head.appendChild(style);
  }

  const panel = document.createElement("section");
  panel.className = "agent-chat-panel";
  panel.innerHTML = `
    <div class="agent-chat-head">
      <strong>Local Agent</strong>
      <button type="button" data-close aria-label="Close">x</button>
    </div>
    <div class="agent-chat-log" id="agentChatLog"></div>
    <div class="agent-chat-input">
      <textarea id="agentChatInput" placeholder="Ask about tasks, projects, habits, due dates..."></textarea>
      <button type="button" id="agentChatSend">Send</button>
    </div>
  `;

  const launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "agent-chat-launcher";
  launcher.textContent = "AI";
  launcher.setAttribute("aria-label", "Open local dashboard agent");

  document.body.appendChild(panel);
  document.body.appendChild(launcher);

  const log = panel.querySelector("#agentChatLog");
  const input = panel.querySelector("#agentChatInput");
  const sendBtn = panel.querySelector("#agentChatSend");
  const closeBtn = panel.querySelector("[data-close]");
  let agentBaseUrl = "";

  function pushMessage(kind, text) {
    const item = document.createElement("div");
    item.className = `agent-chat-msg ${kind}`;
    item.textContent = text;
    log.appendChild(item);
    log.scrollTop = log.scrollHeight;
    return item;
  }

  function safeGet(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function collectContext() {
    const includeKeys = [
      "todoTasks",
      "todoArchive",
      "dashboardEntries",
      "hobbyTracker",
      "journalEntries",
      "quickLinks",
      "localPomodoroLogs",
      "appMeta",
    ];
    const context = { generatedAt: new Date().toISOString(), page: window.location.pathname, data: {} };
    includeKeys.forEach((key) => {
      context.data[key] = safeGet(key);
    });
    return context;
  }

  function getCandidateBases() {
    const bases = [window.location.origin, "http://127.0.0.1:8080", "http://localhost:8080"];
    return Array.from(new Set(bases.filter(Boolean)));
  }

  async function checkAgentHealth() {
    const bases = getCandidateBases();
    for (const base of bases) {
      try {
        const response = await fetch(`${base}/api/agent/health`);
        const data = await response.json();
        if (response.ok && data.ok) {
          agentBaseUrl = base;
          return `Connected (${data.model || "local model"})`;
        }
      } catch (err) {
        // Try next candidate base.
      }
    }
    return "Agent offline. Open dashboard from localhost:8080 and keep Ollama running.";
  }

  async function askAgent() {
    const question = (input.value || "").trim();
    if (!question) return;
    input.value = "";
    pushMessage("user", question);
    const pending = pushMessage("bot", "Thinking...");
    sendBtn.disabled = true;
    try {
      const base = agentBaseUrl || window.location.origin;
      const response = await fetch(`${base}/api/agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, context: collectContext() }),
      });
      const result = await response.json();
      pending.textContent = response.ok ? String(result.reply || "") : String(result.detail || result.error || "Request failed");
    } catch (err) {
      pending.textContent = "Agent unavailable. Start Ollama and try again.";
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  }

  launcher.addEventListener("click", () => {
    panel.classList.toggle("open");
    if (panel.classList.contains("open")) {
      if (!log.children.length) {
        pushMessage("bot", "Local agent ready. I can answer using your dashboard data on this browser.");
      }
      checkAgentHealth().then((text) => {
        pushMessage("bot", text);
      });
      input.focus();
    }
  });
  closeBtn.addEventListener("click", () => panel.classList.remove("open"));
  sendBtn.addEventListener("click", askAgent);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      askAgent();
    }
  });
})();
