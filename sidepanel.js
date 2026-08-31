const $ = id =>
    document.getElementById(id);


// ======================================================
// GEMINI MODELS
// ======================================================

const MODELS = [

    "gemini-3.7-flash",

    "gemini-3.6-flash",

    "gemini-3.5-flash",

    "gemini-2.5-flash"

];


// ======================================================
// VARIABLES
// ======================================================

let recognition = null;

let listening = false;

let wakeMode = true;

let busy = false;

let history = [];


// ======================================================
// UI
// ======================================================

function log(
    who,
    text
) {

    const div =
        document.createElement(
            "div"
        );


    div.className =
        `msg ${
            who === "YOU"
                ? "user"
                : "ai"
        }`;


    div.innerHTML =

        `<div class="who">${who}</div>
         <div></div>`;


    div.querySelector(
        "div:last-child"
    ).textContent =
        text;


    $("chat").appendChild(
        div
    );


    $("chat").scrollTop =
        $("chat").scrollHeight;
}


function state(
    text,
    mode = ""
) {

    $("state").textContent =
        text;

    $("reactor").className =
        "reactor " + mode;
}


// ======================================================
// SETTINGS
// ======================================================

function getSettings() {

    let settings = {};

    try {

        settings =
            JSON.parse(
                localStorage.getItem(
                    "jarvis_settings"
                ) || "{}"
            );

    } catch {

        settings = {};

    }

    return settings;
}


// ======================================================
// SPEECH
// ======================================================

function speak(text) {

    const settings =
        getSettings();


    const s =
        new SpeechSynthesisUtterance(
            text
        );


    s.rate =
        Number(
            settings.voiceRate ||
            1.05
        );


    s.pitch =
        0.9;


    if (
        settings.speak !== false
    ) {

        speechSynthesis.speak(
            s
        );
    }
}


function stopVoice() {

    speechSynthesis.cancel();

    state(
        "READY"
    );

    $("aiStatus").textContent =
        "AI: READY";
}


// ======================================================
// SPEECH RECOGNITION
// ======================================================

function initRecognition() {

    const SR =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;


    if (!SR) {

        $("status").textContent =
            "Speech recognition isn't available here. Use typing.";

        return;
    }


    recognition =
        new SR();


    recognition.lang =
        "en-GB";


    recognition.continuous =
        true;


    recognition.interimResults =
        true;


    recognition.maxAlternatives =
        1;


    recognition.onstart =
        () => {

            listening = true;

            $("micBtn").textContent =
                "⏹ Stop listening";

            $("micBtn")
                .classList
                .add("active");


            $("status").textContent =
                "Listening…";


            state(

                wakeMode
                    ? "LISTENING FOR JARVIS"
                    : "LISTENING",

                "listening"
            );
        };


    recognition.onend =
        () => {

            if (listening) {

                try {

                    recognition.start();

                } catch {}

            }

        };


    recognition.onerror =
        event => {

            $("status").textContent =
                "Microphone: " +
                event.error;


            if (
                event.error ===
                "not-allowed"
            ) {

                listening =
                    false;

                $("micBtn").textContent =
                    "🎙 Start listening";
            }

        };


    recognition.onresult =
        event => {

            let finalText =
                "";


            for (
                let i =
                    event.resultIndex;

                i <
                    event.results.length;

                i++
            ) {

                if (
                    event.results[i]
                        .isFinal
                ) {

                    finalText +=
                        event.results[i][0]
                            .transcript;

                }

            }


            finalText =
                finalText.trim();


            if (!finalText)
                return;


            if (wakeMode) {

                if (
                    /\bjarvis\b/i
                        .test(finalText)
                ) {

                    wakeMode =
                        false;


                    state(
                        "LISTENING FOR COMMAND",
                        "listening"
                    );


                    $("status").textContent =
                        "Go ahead.";


                    speak(
                        "Yes?"
                    );

                }

                return;
            }


            wakeMode =
                true;


            log(
                "YOU",
                finalText
            );


            handle(
                finalText
            );

        };
}


// ======================================================
// MICROPHONE
// ======================================================

function toggleMic() {

    if (!recognition)
        initRecognition();


    if (!recognition)
        return;


    if (listening) {

        listening =
            false;


        try {

            recognition.stop();

        } catch {}


        $("micBtn").textContent =
            "🎙 Start listening";


        state(
            "READY"
        );


        $("status").textContent =
            "Say “Jarvis” or type a message.";

        return;
    }


    try {

        recognition.start();

    } catch {}

}


// ======================================================
// GOOGLE / YOUTUBE
// ======================================================

function google(q) {

    window.open(

        "https://www.google.com/search?q=" +
        encodeURIComponent(q),

        "_blank"

    );

}


function youtube(q) {

    window.open(

        "https://www.youtube.com/results?search_query=" +
        encodeURIComponent(q),

        "_blank"

    );

}


function weather() {

    google(
        "weather today"
    );

}


function time() {

    speak(

        "It is " +

        new Date()
            .toLocaleTimeString(
                "en-GB",
                {
                    hour:
                        "numeric",

                    minute:
                        "2-digit"
                }
            )

    );

}


// ======================================================
// GEMINI REQUEST
// ======================================================

async function requestGemini(
    model,
    apiKey,
    contents
) {

    const response =
        await fetch(

            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,

            {

                method:
                    "POST",

                headers: {

                    "Content-Type":
                        "application/json",

                    "x-goog-api-key":
                        apiKey

                },

                body:
                    JSON.stringify({

                        contents,

                        generationConfig: {

                            maxOutputTokens:
                                500

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


    const answer =
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


    if (!answer) {

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


        error.status =
            503;


        throw error;

    }


    return answer;

}


// ======================================================
// TEMPORARY ERROR DETECTION
// ======================================================

function isTemporaryError(
    error
) {

    const status =
        Number(
            error?.status || 0
        );


    const message =
        String(
            error?.message || ""
        )
        .toLowerCase();


    return (

        status === 429 ||

        status === 500 ||

        status === 502 ||

        status === 503 ||

        status === 504 ||

        message.includes(
            "high demand"
        ) ||

        message.includes(
            "overloaded"
        ) ||

        message.includes(
            "temporarily unavailable"
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
// AUTOMATIC MODEL FALLBACK
// ======================================================

async function askGemini(
    question
) {

    const apiKey =
        localStorage.getItem(
            "jarvis_api_key"
        );


    if (!apiKey) {

        throw new Error(
            "No Gemini API key is saved. Open Settings and add your key."
        );

    }


    const contents = [];


    contents.push({

        role:
            "user",

        parts: [

            {

                text:

`You are JARVIS, a personal AI assistant running on a Chromebook.

Be helpful, natural and concise.

Speak like a capable personal assistant.

Do not claim that you performed an action unless the browser actually performed it.

The user wants spoken-friendly answers.

User request:
${question}`

            }

        ]

    });


    const recent =
        history.slice(
            -8
        );


    for (
        const item
        of recent
    ) {

        contents.push({

            role:
                item.role,

            parts: [

                {
                    text:
                        item.text
                }

            ]

        });

    }


    let lastError =
        null;


    for (
        let i = 0;

        i <
            MODELS.length;

        i++
    ) {

        const model =
            MODELS[i];


        try {

            state(
                i === 0
                    ? "THINKING"
                    : `SWITCHING TO ${model.toUpperCase()}`,
                "thinking"
            );


            $("status").textContent =
                `Using ${model}…`;


            const answer =
                await requestGemini(

                    model,

                    apiKey,

                    contents

                );


            return {

                answer,

                model

            };


        } catch (error) {

            lastError =
                error;


            console.warn(
                model +
                " failed:",
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

                $("status").textContent =
                    `${model} is busy. Trying another Gemini model…`;


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
            "All Gemini models are currently unavailable."
        );

}


// ======================================================
// HANDLE COMMANDS
// ======================================================

async function handle(
    text
) {

    const l =
        text.toLowerCase();


    if (
        l.includes(
            "what time"
        )
    ) {

        time();

        return;
    }


    if (
        l.includes(
            "open youtube"
        )
    ) {

        window.open(
            "https://www.youtube.com",
            "_blank"
        );

        speak(
            "Opening YouTube."
        );

        return;
    }


    if (
        l.includes(
            "open google"
        )
    ) {

        window.open(
            "https://www.google.com",
            "_blank"
        );

        speak(
            "Opening Google."
        );

        return;
    }


    if (
        l.includes(
            "open gmail"
        )
    ) {

        window.open(
            "https://mail.google.com",
            "_blank"
        );

        speak(
            "Opening Gmail."
        );

        return;
    }


    if (
        l.startsWith(
            "search google for"
        )
    ) {

        google(

            text
                .replace(
                    /search google for/i,
                    ""
                )
                .trim()

        );

        return;
    }


    if (
        l.startsWith(
            "search youtube for"
        )
    ) {

        youtube(

            text
                .replace(
                    /search youtube for/i,
                    ""
                )
                .trim()

        );

        return;
    }


    if (
        l.includes(
            "weather"
        )
    ) {

        weather();

        return;
    }


    await ask(
        text
    );

}


// ======================================================
// ASK
// ======================================================

async function ask(
    question
) {

    if (busy)
        return;


    busy =
        true;


    state(
        "THINKING",
        "thinking"
    );


    $("aiStatus").textContent =
        "AI: THINKING";


    $("status").textContent =
        "Working…";


    try {

        const response =
            await askGemini(
                question
            );


        const answer =
            response.answer;


        const model =
            response.model;


        history.push(

            {
                role:
                    "user",

                text:
                    question
            },

            {
                role:
                    "model",

                text:
                    answer
            }

        );


        if (
            history.length >
            20
        ) {

            history =
                history.slice(
                    -20
                );

        }


        localStorage.setItem(

            "jarvis_history",

            JSON.stringify(
                history
            )

        );


        log(
            "JARVIS",
            answer
        );


        state(
            "SPEAKING",
            "speaking"
        );


        $("aiStatus").textContent =
            "AI: SPEAKING";


        $("status").textContent =
            `Response from ${model}.`;


        speak(
            answer
        );


    } catch (error) {

        console.error(
            "JARVIS ERROR:",
            error
        );


        log(
            "JARVIS ERROR",
            error.message
        );


        state(
            "AI ERROR"
        );


        $("aiStatus").textContent =
            "AI: ERROR";


        $("status").textContent =
            error.message;


    } finally {

        busy =
            false;

    }

}


// ======================================================
// BUTTONS
// ======================================================

$("micBtn").onclick =
    toggleMic;


$("stopBtn").onclick =
    stopVoice;


$("sendBtn").onclick =
    () => {

        const text =
            $("input")
                .value
                .trim();


        if (!text)
            return;


        $("input").value =
            "";


        log(
            "YOU",
            text
        );


        handle(
            text
        );

    };


$("input").addEventListener(
    "keydown",
    event => {

        if (
            event.key ===
            "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();

            $("sendBtn").click();

        }

    }
);


$("clearBtn").onclick =
    () => {

        $("chat").innerHTML =
            "";

        history =
            [];

        localStorage.removeItem(
            "jarvis_history"
        );

    };


// ======================================================
// SETTINGS BUTTON
// ======================================================

$("settingsBtn").onclick =
    () => {

        window.location.href =
            "settings.html";

    };


// ======================================================
// QUICK BUTTONS
// ======================================================

document
    .querySelectorAll(
        ".quick button"
    )
    .forEach(
        button => {

            button.onclick =
                async () => {

                    const command =
                        button.dataset.cmd;


                    if (
                        command ===
                        "time"
                    ) {

                        time();

                    }


                    if (
                        command ===
                        "search"
                    ) {

                        const q =
                            prompt(
                                "Search Google for:"
                            );

                        if (q)
                            google(q);

                    }


                    if (
                        command ===
                        "youtube"
                    ) {

                        const q =
                            prompt(
                                "Search YouTube for:"
                            );

                        if (q)
                            youtube(q);

                    }


                    if (
                        command ===
                        "weather"
                    ) {

                        weather();

                    }


                    if (
                        command ===
                        "page"
                    ) {

                        speak(
                            "Page summarisation isn't available when JARVIS is running as a normal GitHub Pages website."
                        );

                    }

                };

        }
    );


// ======================================================
// START JARVIS
// ======================================================

function startJarvis() {

    const apiKey =
        localStorage.getItem(
            "jarvis_api_key"
        );


    try {

        history =
            JSON.parse(
                localStorage.getItem(
                    "jarvis_history"
                ) || "[]"
            );

    } catch {

        history =
            [];

    }


    $("keyStatus").textContent =
        apiKey
            ? "KEY: SET"
            : "KEY: NOT SET";


    if (
        !history.length
    ) {

        log(
            "JARVIS",
            "System ready. Say “Jarvis” or type a command."
        );

    } else {

        history
            .slice(-6)
            .forEach(
                item => {

                    log(

                        item.role ===
                        "user"
                            ? "YOU"
                            : "JARVIS",

                        item.text

                    );

                }
            );

    }


    initRecognition();

}


startJarvis();
