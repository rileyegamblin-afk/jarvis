const key = document.getElementById("key");
const rate = document.getElementById("rate");
const rateVal = document.getElementById("rateVal");
const speak = document.getElementById("speak");
const result = document.getElementById("result");
const save = document.getElementById("save");
const clear = document.getElementById("clear");
const test = document.getElementById("test");

const MODEL = "gemini-3.7-flash";

if (rate && rateVal) {
    rate.addEventListener("input", () => {
        rateVal.textContent = rate.value;
    });
}

function loadSettings() {
    try {
        const savedKey =
            localStorage.getItem("jarvis_api_key") || "";

        let settings = {};

        try {
            settings = JSON.parse(
                localStorage.getItem("jarvis_settings") || "{}"
            );
        } catch {
            settings = {};
        }

        if (key) key.value = savedKey;

        if (rate) {
            rate.value =
                settings.voiceRate !== undefined
                    ? settings.voiceRate
                    : 1.05;
        }

        if (rateVal && rate) {
            rateVal.textContent = rate.value;
        }

        if (speak) {
            speak.checked = settings.speak !== false;
        }

        if (result) {
            result.textContent =
                savedKey
                    ? "✓ API key loaded."
                    : "No API key saved yet.";
        }

    } catch (error) {
        console.error(error);

        if (result) {
            result.textContent =
                "Error loading settings: " + error.message;
        }
    }
}


if (save) {
    save.addEventListener("click", () => {

        const apiKey = key.value.trim();

        if (!apiKey) {
            result.textContent =
                "Please enter your Gemini API key.";
            return;
        }

        const settings = {
            voiceRate: Number(rate.value),
            speak: speak.checked,
            model: MODEL
        };

        localStorage.setItem(
            "jarvis_api_key",
            apiKey
        );

        localStorage.setItem(
            "jarvis_settings",
            JSON.stringify(settings)
        );

        result.textContent =
            "✓ API key saved successfully.";
    });
}


if (clear) {
    clear.addEventListener("click", () => {

        localStorage.removeItem(
            "jarvis_api_key"
        );

        if (key) key.value = "";

        result.textContent =
            "✓ API key removed.";
    });
}


if (test) {

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
                `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        contents: [
                            {
                                parts: [
                                    {
                                        text: "Say JARVIS ONLINE"
                                    }
                                ]
                            }
                        ]
                    })
                }
            );

            const rawText =
                await response.text();

            console.log(
                "GEMINI STATUS:",
                response.status
            );

            console.log(
                "GEMINI RESPONSE:",
                rawText
            );


            let data;

            try {
                data = JSON.parse(rawText);
            } catch {
                throw new Error(
                    "Gemini returned invalid JSON: " +
                    rawText.substring(0, 300)
                );
            }


            if (!response.ok) {

                throw new Error(
                    data?.error?.message ||
                    `HTTP ${response.status}`
                );
            }


            const parts =
    data?.candidates?.[0]?.content?.parts || [];

const text = parts
    .filter(part => part.text)
    .map(part => part.text)
    .join("")
    .trim();


            if (!text) {

                console.log(
                    "FULL GEMINI DATA:",
                    data
                );

                throw new Error(
                    "Gemini returned no text. Check the browser console for the full response."
                );
            }


            localStorage.setItem(
                "jarvis_api_key",
                apiKey
            );

            localStorage.setItem(
                "jarvis_settings",
                JSON.stringify({
                    voiceRate:
                        Number(rate.value),

                    speak:
                        speak.checked,

                    model:
                        MODEL
                })
            );


            result.textContent =
                "✓ SUCCESS — " + text;

        } catch (error) {

            console.error(
                "JARVIS GEMINI ERROR:",
                error
            );

            result.textContent =
                "✕ ERROR — " +
                error.message;
        }
    });
}


loadSettings();
