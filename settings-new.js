const key = document.getElementById("key");
const rate = document.getElementById("rate");
const rateVal = document.getElementById("rateVal");
const speak = document.getElementById("speak");
const result = document.getElementById("result");
const save = document.getElementById("save");
const clear = document.getElementById("clear");
const test = document.getElementById("test");

const MODEL = "gemini-3.6-flash";


// ================================
// VOICE SPEED DISPLAY
// ================================

rate.addEventListener("input", () => {
    rateVal.textContent = rate.value;
});


// ================================
// LOAD SETTINGS
// ================================

async function loadSettings() {
    try {
        const data = await chrome.storage.local.get([
            "apiKey",
            "settings"
        ]);

        const apiKey = data.apiKey || "";
        const settings = data.settings || {};

        key.value = apiKey;

        rate.value =
            settings.voiceRate !== undefined
                ? settings.voiceRate
                : 1.05;

        rateVal.textContent = rate.value;

        speak.checked =
            settings.speak !== false;

        if (apiKey) {
            result.textContent = "API key loaded.";
        } else {
            result.textContent = "No API key saved yet.";
        }

    } catch (error) {
        console.error(error);
        result.textContent =
            "Could not load settings: " + error.message;
    }
}


// ================================
// SAVE SETTINGS
// ================================

save.addEventListener("click", async () => {

    try {

        const apiKey = key.value.trim();

        if (!apiKey) {
            result.textContent = "Please enter your Gemini API key.";
            return;
        }

        const settings = {
            voiceRate: Number(rate.value),
            speak: speak.checked,
            model: MODEL
        };

        await chrome.storage.local.set({
            apiKey: apiKey,
            settings: settings
        });

        result.textContent =
            "✓ API key saved successfully.";

    } catch (error) {

        console.error(error);

        result.textContent =
            "Save failed: " + error.message;
    }
});


// ================================
// REMOVE API KEY
// ================================

clear.addEventListener("click", async () => {

    try {

        await chrome.storage.local.remove([
            "apiKey"
        ]);

        key.value = "";

        result.textContent =
            "API key removed.";

    } catch (error) {

        console.error(error);

        result.textContent =
            "Remove failed: " + error.message;
    }
});


// ================================
// TEST GEMINI
// ================================

test.addEventListener("click", async () => {

    const apiKey = key.value.trim();

    if (!apiKey) {
        result.textContent =
            "Enter your API key first.";
        return;
    }

    result.textContent =
        "Testing Gemini...";

    try {

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
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
                        maxOutputTokens: 20,
                        thinkingConfig: {
                            thinkingLevel: "minimal"
                        }
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
            data?.candidates?.[0]?.content?.parts
                ?.map(part => part.text || "")
                .join("")
                .trim();

        if (!text) {
            throw new Error("Gemini returned no text.");
        }

        // Save the working key
        await chrome.storage.local.set({
            apiKey: apiKey,
            settings: {
                voiceRate: Number(rate.value),
                speak: speak.checked,
                model: MODEL
            }
        });

        result.textContent =
            "✓ SUCCESS — " + text;

    } catch (error) {

        console.error(
            "Gemini test error:",
            error
        );

        result.textContent =
            "✕ ERROR — " + error.message;
    }
});


// ================================
// START
// ================================

loadSettings();
