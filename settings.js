const key = document.getElementById("key");
const rate = document.getElementById("rate");
const rateVal = document.getElementById("rateVal");
const speak = document.getElementById("speak");
const result = document.getElementById("result");

function show(message) {
  if (result) {
    result.textContent = message;
  }
}

function hasExtensionStorage() {
  return (
    typeof chrome !== "undefined" &&
    chrome.storage &&
    chrome.storage.local
  );
}

rate.oninput = () => {
  rateVal.textContent = rate.value;
};

async function load() {
  try {
    if (!hasExtensionStorage()) {
      show(
        "JARVIS settings must be opened from the Chrome extension. Do not open settings.html directly."
      );
      return;
    }

    const data = await chrome.storage.local.get([
      "apiKey",
      "settings"
    ]);

    if (data.apiKey) {
      key.value = data.apiKey;
    }

    const settings = data.settings || {};

    rate.value =
      settings.voiceRate !== undefined
        ? settings.voiceRate
        : 1.05;

    rateVal.textContent = rate.value;

    speak.checked =
      settings.speak !== false;
  } catch (error) {
    console.error("JARVIS settings load error:", error);
    show("Error loading settings: " + error.message);
  }
}

document.getElementById("save").onclick = async () => {
  try {
    if (!hasExtensionStorage()) {
      show(
        "Storage unavailable. Open JARVIS through chrome://extensions."
      );
      return;
    }

    const apiKey = key.value.trim();

    const settings = {
      voiceRate: Number(rate.value),
      speak: speak.checked,
      model: "gemini-3.6-flash"
    };

    await chrome.storage.local.set({
      apiKey: apiKey,
      settings: settings
    });

    show("Saved successfully.");
  } catch (error) {
    console.error("JARVIS save error:", error);
    show("Error saving settings: " + error.message);
  }
};

document.getElementById("clear").onclick = async () => {
  try {
    if (!hasExtensionStorage()) {
      show(
        "Storage unavailable. Open JARVIS through chrome://extensions."
      );
      return;
    }

    await chrome.storage.local.remove("apiKey");

    key.value = "";

    show("API key removed.");
  } catch (error) {
    console.error("JARVIS remove error:", error);
    show("Error removing API key: " + error.message);
  }
};

document.getElementById("test").onclick = async () => {
  const apiKey = key.value.trim();

  if (!apiKey) {
    show("Add an API key first.");
    return;
  }

  show("Testing...");

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: "Reply with exactly: JARVIS ONLINE"
                }
              ]
            }
          ],
          generationConfig: {
            maxOutputTokens: 20
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error?.message ||
        `HTTP ${response.status}`
      );
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Connected";

    show("Success: " + text);
  } catch (error) {
    console.error("JARVIS AI test error:", error);
    show("Error: " + error.message);
  }
};

load();
