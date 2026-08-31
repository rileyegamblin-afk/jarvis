const MENU_ASK = "jarvis-ask-selection";
const MENU_SUMMARY = "jarvis-summarise-page";

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  chrome.contextMenus.create({
    id: MENU_ASK,
    title: "Ask JARVIS about this",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: MENU_SUMMARY,
    title: "Summarise this page with JARVIS",
    contexts: ["page"]
  });

  const existing = await chrome.storage.local.get(["settings"]);
  if (!existing.settings) {
    await chrome.storage.local.set({
      settings: {
        model: "gemini-3.6-flash",
        voiceRate: 1.05,
        wakeWord: "jarvis",
        speak: true
      }
    });
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ windowId: tab.windowId });
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "open-jarvis") {
    await openJarvisWindow();
  }
});

async function openJarvisWindow() {
  const jarvisUrl = chrome.runtime.getURL("standalone.html");
  const existing = await chrome.windows.getAll({ populate: true });

  for (const w of existing) {
    for (const tab of (w.tabs || [])) {
      if (tab.url === jarvisUrl) {
        await chrome.windows.update(w.id, { focused: true, state: "maximized" });
        return;
      }
    }
  }

  await chrome.windows.create({
    url: jarvisUrl,
    type: "popup",
    state: "maximized",
    focused: true
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;

  if (info.menuItemId === MENU_ASK && info.selectionText) {
    await chrome.storage.local.set({
      pendingPrompt: `The user selected this text from a webpage:\n\n${info.selectionText}\n\nExplain or help with it.`
    });
    await chrome.sidePanel.open({ windowId: tab.windowId });
  }

  if (info.menuItemId === MENU_SUMMARY) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.body ? document.body.innerText.slice(0, 30000) : ""
      });
      const text = results?.[0]?.result || "";
      await chrome.storage.local.set({
        pendingPrompt: `Summarise the current webpage. Here is the page text:\n\n${text}`
      });
      await chrome.sidePanel.open({ windowId: tab.windowId });
    } catch (e) {
      await chrome.storage.local.set({
        pendingPrompt: "I couldn't read the current page. Explain why and suggest what I can do instead."
      });
      await chrome.sidePanel.open({ windowId: tab.windowId });
    }
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith("jarvis-reminder-")) return;
  const data = await chrome.storage.local.get(["reminders"]);
  const reminders = data.reminders || [];
  const reminder = reminders.find(r => r.id === alarm.name);

  if (reminder) {
    await chrome.notifications.create(reminder.id, {
      type: "basic",
      iconUrl: "icon128.png",
      title: "JARVIS Reminder",
      message: reminder.text,
      priority: 2
    });
    await chrome.storage.local.set({
      reminders: reminders.filter(r => r.id !== reminder.id)
    });
  }
});

chrome.notifications.onClicked.addListener(async (id) => {
  await chrome.notifications.clear(id);
  const windows = await chrome.windows.getCurrent();
  await chrome.sidePanel.open({ windowId: windows.id });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "createReminder") {
    createReminder(msg.text, msg.minutes)
      .then(() => sendResponse({ ok: true }))
      .catch(e => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
});

async function createReminder(text, minutes) {
  const id = `jarvis-reminder-${Date.now()}`;
  const when = Date.now() + Math.max(0.5, Number(minutes)) * 60000;
  await chrome.alarms.create(id, { when });

  const data = await chrome.storage.local.get(["reminders"]);
  const reminders = data.reminders || [];
  reminders.push({ id, text, minutes, when });
  await chrome.storage.local.set({ reminders });
}