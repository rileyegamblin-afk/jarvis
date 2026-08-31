const key = document.getElementById("key");
const rate = document.getElementById("rate");
const rateVal = document.getElementById("rateVal");
const speak = document.getElementById("speak");
const result = document.getElementById("result");
const save = document.getElementById("save");
const clear = document.getElementById("clear");
const test = document.getElementById("test");


// ======================================================
// JARVIS MODEL SYSTEM
// ======================================================

const MODELS = [
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-2.5-flash"
];


// ======================================================
// VOICE SPEED
// ======================================================

if (rate) {
    rate.addEventListener("input", () => {
        rateVal.textContent = rate.value;
    });
}


// ======================================================
// LOAD SETTINGS
// ======================================================

function loadSettings() {

    try {

        const apiKey =
            localStorage.getItem("jarvis_api_key") || "";

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

        speak.checked =
            settings.speak !== false;

        if (apiKey) {

            result.textContent =
                "✓ API key loaded.";

        } else {

            result.textContent =
                "No API key saved yet.";

        }

    } catch (error) {

        console.error(
            "JARVIS settings load error:",
            error
        );

        result.textContent =
            "Could not load settings: " +
            error.message;
    }
}


// ======================================================
// SAVE SETTINGS
// ======================================================

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
                MODELS[0]
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

    } catch (error) {

        console.error(error);

        result.textContent =
            "Save failed: " +
            error.message;
    }
});


// ======================================================
// REMOVE KEY
// ======================================================

clear.addEventListener("click", () => {

    localStorage.removeItem(
        "jarvis_api_key"
    );

    key.value = "";

    result.textContent =
        "✓ API key removed.";
});


// ======================================================
// GEMINI REQUEST
// ======================================================

async function requestGemini(
    model,
    apiKey,
    prompt
) {

    const response = await fetch(

        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,

        {

            method: "POST",

            headers: {

                "Content-Type":
                    "application/json",

                "x-goog-api-key":
                    apiKey
            },

            body: JSON.stringify({

                contents: [

                    {

                        role: "user",

                        parts: [

                            {
                                text: prompt
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


    const data =
        await response.json();


    if (!response.ok) {

        const error =
            new Error(
                data?.error?.message ||
                `HTTP ${response.status}`
            );

        error.status =
            response.status;

        throw error;
    }


    const parts =
        data?.candidates?.[0]
            ?.content
            ?.parts || [];


    const text =
        parts

            .filter(
                part =>
                    typeof part.text ===
                    "string"
            )

            .map(
                part =>
                    part.text
            )

            .join("")

            .trim();


    if (!text) {

        const reason =
            data?.candidates?.[0]
                ?.finishReason ||
            data?.promptFeedback
                ?.blockReason ||
            "Unknown";

        const error =
            new Error(
                `Gemini returned no text. Reason: ${reason}`
            );

        error.status = 503;

        throw error;
    }


    return text;
}


// ======================================================
// SHOULD WE TRY ANOTHER MODEL?
// ======================================================

function isTemporaryError(error) {

    const status =
        Number(error?.status || 0);

    const message =
        String(
            error?.message || ""
        ).toLowerCase();


    if (
        status === 429 ||
        status === 500 ||
        status === 502 ||
        status === 503 ||
        status === 504
    ) {

        return true;
    }


    return (

        message.includes(
            "high demand"
        ) ||

        message.includes(
            "temporarily unavailable"
        ) ||

        message.includes(
            "overloaded"
        ) ||

        message.includes(
            "service unavailable"
        ) ||

        message.includes(
            "resource exhausted"
        )
    );
}


// ======================================================
// ASK WITH AUTOMATIC FALLBACK
// ======================================================

async function askWithFallback(
    apiKey,
    prompt,
    progressCallback
) {

    let lastError = null;


    for (
        let i = 0;
        i < MODELS.length;
        i++
    ) {

        const model =
            MODELS[i];


        try {

            progressCallback(
                `Trying ${model}...`
            );


            const answer =
                await requestGemini(
                    model,
                    apiKey,
                    prompt
                );


            return {

                answer,
                model

            };


        } catch (error) {

            lastError =
                error;


            console.warn(
                `${model} failed:`,
                error
            );


            if (
                !isTemporaryError(
                    error
                )
            ) {

                throw error;
            }


            if (
                i <
                MODELS.length - 1
            ) {

                progressCallback(
                    `${model} is busy. Switching to ${MODELS[i + 1]}...`
                );

                await new Promise(
                    resolve =>
                        setTimeout(
                            resolve,
                            800
                        )
                );
            }
        }
    }


    throw lastError ||
        new Error(
            "All Gemini models failed."
        );
}


// ======================================================
// TEST AI
// ======================================================

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


        test.disabled = true;


        try {

            const response =
                await askWithFallback(

                    apiKey,

                    "Reply with exactly: JARVIS ONLINE",

                    message => {

                        result.textContent =
                            message;
                    }
                );


            // Save the working key
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
                        response.model
                })
            );


            result.textContent =
                `✓ SUCCESS — ${response.answer} (${response.model})`;


        } catch (error) {

            console.error(
                "JARVIS AI TEST ERROR:",
                error
            );


            result.textContent =
                "✕ ERROR — " +
                error.message;


        } finally {

            test.disabled = false;

        }

    }
);


// ======================================================
// START
// ======================================================

loadSettings();
