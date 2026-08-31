const key = document.getElementById("key");
const rate = document.getElementById("rate");
const rateVal = document.getElementById("rateVal");
const speak = document.getElementById("speak");
const result = document.getElementById("result");
const save = document.getElementById("save");
const clear = document.getElementById("clear");
const test = document.getElementById("test");

const MODEL = "gemini-3.6-flash";


// ==========================================
// VOICE SPEED
// ==========================================

if (rate && rateVal) {
    rate.addEventListener("input", () => {
        rateVal.textContent = rate.value;
    });
}


// ==========================================
// LOAD SETTINGS
// ==========================================

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

        if (key) {
            key.value = savedKey;
        }

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
            speak.checked =
                settings.speak !== false;
        }

        if (result) {
            result.textContent =
                savedKey
                    ? "✓ API key loaded."
                    : "No API key saved yet.";
        }

    } catch (error) {

        console.error(
            "JARVIS settings error:",
            error
        );

        if (result) {
            result.textContent =
                "Error loading settings: " +
                error.message;
        }
    }
}


// ==========================================
// SAVE
// ==========================================

if (save) {

    save.addEventListener("click", () => {

        try {

            const apiKey =
                key.value.trim();

            if (!apiKey) {

                result.textContent =
                    "Please enter your Gemini API key.";

                return;
            }

            const settings = {

                voiceRate:
                    Number(rate.value),

                speak:
                    speak.checked,

                model:
                    MODEL
            };


            // SAVE API KEY

            localStorage.setItem(
                "jarvis_api_key",
                apiKey
            );


            // SAVE SETTINGS

            localStorage.setItem(
                "jarvis_settings",
                JSON.stringify(settings)
            );


            result.textContent =
                "✓ API key saved successfully.";

        } catch (error) {

            console.error(
                "JARVIS save error:",
                error
            );

            result.textContent =
                "Save failed: " +
                error.message;
        }
    });
}


// ==========================================
// REMOVE API KEY
// ==========================================

if (clear) {

    clear.addEventListener("click", () => {

        try {

            localStorage.removeItem(
                "jarvis_api_key"
            );

            if (key) {
                key.value = "";
            }

            result.textContent =
                "✓ API key removed.";

        } catch (error) {

            result.textContent =
                "Remove failed: " +
                error.message;
        }
    });
}


// ==========================================
// TEST GEMINI
// ==========================================

if (test) {

    test.addEventListener(
        "click",
        async () => {

            const apiKey =
                key.value.trim();

            if (!apiKey) {

                result.textContent =
                    "Enter your API key first.";

                return;
            }

            result.textContent =
                "Testing Gemini...";


            try {

                const response =
                    await fetch(
                        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json",

                                "x-goog-api-key":
                                    apiKey
                            },

                            body:
                                JSON.stringify({

                                    contents: [
                                        {
                                            role: "user",

                                            parts: [
                                                {
                                                    text:
                                                        "Reply with exactly: JARVIS ONLINE"
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


                const data =
                    await response.json();


                if (!response.ok) {

                    throw new Error(
                        data?.error?.message ||
                        `HTTP ${response.status}`
                    );
                }


                const text =
                    data
                        ?.candidates?.[0]
                        ?.content?.parts
                        ?.map(
                            part =>
                                part.text || ""
                        )
                        .join("")
                        .trim();


                if (!text) {

                    throw new Error(
                        "Gemini returned no text."
                    );
                }


                // SAVE THE WORKING KEY

                localStorage.setItem(
                    "jarvis_api_key",
                    apiKey
                );


                // SAVE SETTINGS

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
                    "✓ SUCCESS — " +
                    text;

            } catch (error) {

                console.error(
                    "JARVIS AI test error:",
                    error
                );

                result.textContent =
                    "✕ ERROR — " +
                    error.message;
            }
        }
    );
}


// ==========================================
// START
// ==========================================

loadSettings();
