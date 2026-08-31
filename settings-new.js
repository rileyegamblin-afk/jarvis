const key = document.getElementById("key");
const rate = document.getElementById("rate");
const rateVal = document.getElementById("rateVal");
const speak = document.getElementById("speak");
const result = document.getElementById("result");
const save = document.getElementById("save");
const clear = document.getElementById("clear");
const test = document.getElementById("test");

const MODEL = "gemini-3.7-flash";


// VOICE SPEED
if (rate) {
    rate.addEventListener("input", () => {
        rateVal.textContent = rate.value;
    });
}


// LOAD SETTINGS
function loadSettings() {
    const apiKey = localStorage.getItem("jarvis_api_key") || "";

    let settings = {};

    try {
        settings = JSON.parse(
            localStorage.getItem("jarvis_settings") || "{}"
        );
    } catch {
        settings = {};
    }

    key.value = apiKey;

    rate.value =
        settings.voiceRate !== undefined
            ? settings.voiceRate
            : 1.05;

    rateVal.textContent = rate.value;

    speak.checked = settings.speak !== false;

    result.textContent = apiKey
        ? "✓ API key loaded."
        : "No API key saved yet.";
}


// SAVE
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


// REMOVE KEY
clear.addEventListener("click", () => {

    localStorage.removeItem(
        "jarvis_api_key"
    );

    key.value = "";

    result.textContent =
        "✓ API key removed.";
});


// TEST AI
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
                        maxOutputTokens: 100
                    }
                })
            }
        );


        const data = await response.json();


        console.log(
            "JARVIS GEMINI RESPONSE:",
            data
        );


        if (!response.ok) {

            throw new Error(
                data?.error?.message ||
                `HTTP ${response.status}`
            );
        }


        const parts =
            data?.candidates?.[0]?.content?.parts || [];


        const text = parts
            .filter(part =>
                typeof part.text === "string"
            )
            .map(part => part.text)
            .join("")
            .trim();


        if (!text) {

            const reason =
                data?.candidates?.[0]?.finishReason ||
                data?.promptFeedback?.blockReason ||
                "Unknown";

            throw new Error(
                `Gemini returned no text. Reason: ${reason}`
            );
        }


        // SAVE WORKING KEY
        localStorage.setItem(
            "jarvis_api_key",
            apiKey
        );

        localStorage.setItem(
            "jarvis_settings",
            JSON.stringify({
                voiceRate: Number(rate.value),
                speak: speak.checked,
                model: MODEL
            })
        );


        result.textContent =
            "✓ SUCCESS — " + text;


    } catch (error) {

        console.error(
            "JARVIS AI TEST ERROR:",
            error
        );

        result.textContent =
            "✕ ERROR — " +
            error.message;
    }
});


// START
loadSettings();
