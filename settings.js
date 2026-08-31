const key = document.getElementById("key");
const rate = document.getElementById("rate");
const rateVal = document.getElementById("rateVal");
const speak = document.getElementById("speak");
const result = document.getElementById("result");

rate.oninput = () => {
  rateVal.textContent = rate.value;
};


// ================================
// LOAD SETTINGS
// ================================

function load() {
  try {
    const savedKey = localStorage.getItem("jarvis_api_key");
    const savedSettings = localStorage.getItem("jarvis_settings");

    if (savedKey) {
      key.value = savedKey;
    }

    const settings = savedSettings
      ? JSON.parse(savedSettings)
      : {};

    rate.value =
      settings.voiceRate !== undefined
        ? settings.voiceRate
        : 1.05;

    rateVal.textContent = rate.value;

    speak.checked =
      settings.speak !== false;

  } catch (error) {
    console.error("JARVIS settings load error:", error);
    result.textContent =
      "Error loading settings: " + error.message;
  }
}


// ================================
// SAVE
// ================================

document.getElementById("save").onclick = () => {
  try {
    const apiKey = key.value.trim();

    const settings = {
      voiceRate: Number(rate.value),
      speak: speak.checked,
      model: "gemini-3.6-flash"
    };

    localStorage.setItem(
      "jarvis_api_key",
      apiKey
    );

    localStorage.setItem(
      "jarvis_settings",
      JSON.stringify(settings)
    );

    result.textContent = "Saved successfully.";

  } catch (error) {
    console.error("JARVIS save error:", error);
    result.textContent =
      "Error saving settings: " + error.message;
  }
};


// ================================
// REMOVE API KEY
// ================================

document.getElementById("clear").onclick = () => {
  try {
    localStorage.removeItem("jarvis_api_key");

    key.value = "";

    result.textContent =
      "API key removed.";

  } catch (error) {
    console.error("JARVIS remove error:", error);
    result.textContent =
      "Error removing API key: " + error.message;
  }
};


// ================================
// TEST AI
// ================================

document.getElementById("test").onclick = async () => {

  const apiKey = key.value.trim();

  if (!apiKey) {
    result.textContent =
      "Add an API key first.";
    return;
  }

  result.textContent = "Testing...";

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

    result.textContent =
      "Success: " + text;

  } catch (error) {

    console.error(
      "JARVIS AI test error:",
      error
    );

    result.textContent =
      "Error: " + error.message;
  }
};


// ================================
// START
// ================================

load();
