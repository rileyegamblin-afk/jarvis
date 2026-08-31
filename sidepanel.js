```javascript
const $ = id => document.getElementById(id);


// ======================================================
// JARVIS CONFIGURATION
// ======================================================

const MODELS = [
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash"
];

const MAX_HISTORY = 12;


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

function log(who, text) {

    const div = document.createElement("div");

    div.className =
        `msg ${who === "YOU" ? "user" : "ai"}`;

    div.innerHTML =
        `<div class="who">${who}</div><div></div>`;

    div.querySelector(
        "div:last-child"
    ).textContent = text;

    $("chat").appendChild(div);

    $("chat").scrollTop =
        $("chat").scrollHeight;
}


function state(text, mode = "") {

    if ($("state")) {
        $("state").textContent = text;
    }

    if ($("reactor")) {
        $("reactor").className =
            "reactor " + mode;
    }
}


// ======================================================
// SETTINGS
// ======================================================

function getSettings() {

    try {

        return JSON.parse(
            localStorage.getItem(
                "jarvis_settings"
            ) || "{}"
        );

    } catch {

        return {};

    }
}


function getApiKey() {

    return localStorage.getItem(
        "jarvis_api_key"
    ) || "";
}


// ======================================================
// SPEECH
// ======================================================

function speak(text) {

    const settings =
        getSettings();

    if (settings.speak === false) {
        return;
    }

    speechSynthesis.cancel();

    const utterance =
        new SpeechSynthesisUtterance(text);

    utterance.rate =
        Number(
            settings.voiceRate || 1.15
        );

    utterance.pitch = 0.9;

    speechSynthesis.speak(
        utterance
    );
}


function stopVoice() {

    speechSynthesis.cancel();

    state("READY");

    if ($("aiStatus")) {
        $("aiStatus").textContent =
            "AI: READY";
    }
}


// ======================================================
// VOICE RECOGNITION
// ======================================================

function initRecognition() {

    const SR =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SR) {

        $("status").textContent =
            "Voice recognition isn't available here. You can still type.";

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


    recognition.onstart = () => {

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


    recognition.onend = () => {

        if (listening) {

            try {
                recognition.start();
            } catch {}

        }
    };


    recognition.onerror = event => {

        $("status").textContent =
            "Microphone: " +
            event.error;

        if (
            event.error ===
            "not-allowed"
        ) {

            listening = false;

            $("micBtn").textContent =
                "🎙 Start listening";
        }
    };


    recognition.onresult = event => {

        let finalText = "";

        for (
            let i = event.resultIndex;
            i < event.results.length;
            i++
        ) {

            if (
                event.results[i].isFinal
            ) {

                finalText +=
                    event.results[i][0]
                        .transcript;
            }
        }

        finalText =
            finalText.trim();

        if (!finalText) {
            return;
        }


        if (wakeMode) {

            if (
                /\bjarvis\b/i.test(
                    finalText
                )
            ) {

                wakeMode = false;

                state(
                    "LISTENING FOR COMMAND",
                    "listening"
                );

                $("status").textContent =
                    "Go ahead.";

                speak("Yes?");
            }

            return;
        }


        wakeMode = true;

        log(
            "YOU",
            finalText
        );

        handle(
            finalText
        );
    };
}


function toggleMic() {

    if (!recognition) {
        initRecognition();
    }

    if (!recognition) {
        return;
    }

    if (listening) {

        listening = false;

        try {
            recognition.stop();
        } catch {}

        $("micBtn").textContent =
            "🎙 Start listening";

        state("READY");

        $("status").textContent =
            "Say “Jarvis” or type a message.";

        return;
    }

    try {
        recognition.start();
    } catch {}
}


// ======================================================
// BASIC ACTIONS
// ======================================================

function google(query) {

    window.open(
        "https://www.google.com/search?q=" +
        encodeURIComponent(query),
        "_blank"
    );
}


function youtube(query) {

    window.open(
        "https://www.youtube.com/results?search_query=" +
        encodeURIComponent(query),
        "_blank"
    );
}


function openWebsite(url, spokenName) {

    window.open(
        url,
        "_blank"
    );

    speak(
        "Opening " +
        spokenName +
        "."
    );
}


function tellTime() {

    const time =
        new Date().toLocaleTimeString(
            "en-GB",
            {
                hour: "numeric",
                minute: "2-digit"
            }
        );

    log(
        "JARVIS",
        `The time is ${time}.`
    );

    speak(
        `It is ${time}.`
    );
}


// ======================================================
// WEATHER
// ======================================================

async function getCoordinates(place) {

    if (!place) {

        return new Promise(
            resolve => {

                navigator.geolocation.getCurrentPosition(

                    position => {

                        resolve({
                            latitude:
                                position.coords.latitude,

                            longitude:
                                position.coords.longitude,

                            name:
                                "your current location"
                        });

                    },

                    () => {

                        resolve(null);

                    },

                    {
                        enableHighAccuracy: false,
                        timeout: 8000,
                        maximumAge: 600000
                    }
                );

            }
        );
    }


    const response =
        await fetch(
            "https://geocoding-api.open-meteo.com/v1/search?name=" +
            encodeURIComponent(place) +
            "&count=1&language=en&format=json"
        );

    if (!response.ok) {
        throw new Error(
            "Could not find that location."
        );
    }

    const data =
        await response.json();

    if (
        !data.results ||
        !data.results.length
    ) {

        throw new Error(
            `I couldn't find ${place}.`
        );
    }

    const location =
        data.results[0];

    return {

        latitude:
            location.latitude,

        longitude:
            location.longitude,

        name:
            [
                location.name,
                location.country
            ]
                .filter(Boolean)
                .join(", ")
    };
}


function weatherDescription(code) {

    const descriptions = {

        0: "Clear sky",

        1: "Mainly clear",

        2: "Partly cloudy",

        3: "Overcast",

        45: "Foggy",

        48: "Foggy",

        51: "Light drizzle",

        53: "Drizzle",

        55: "Heavy drizzle",

        61: "Light rain",

        63: "Rain",

        65: "Heavy rain",

        71: "Light snow",

        73: "Snow",

        75: "Heavy snow",

        80: "Rain showers",

        81: "Rain showers",

        82: "Heavy rain showers",

        95: "Thunderstorm",

        96: "Thunderstorm with hail",

        99: "Thunderstorm with hail"
    };

    return (
        descriptions[code] ||
        "Unknown conditions"
    );
}


async function showWeather(place = "") {

    state(
        "CHECKING WEATHER",
        "thinking"
    );

    $("status").textContent =
        "Getting the latest weather…";

    try {

        const location =
            await getCoordinates(
                place
            );

        if (!location) {

            const requested =
                prompt(
                    "What's the town or city you want the weather for?"
                );

            if (!requested) {

                state("READY");

                return;
            }

            return showWeather(
                requested
            );
        }


        const url =
            "https://api.open-meteo.com/v1/forecast?" +
            "latitude=" +
            location.latitude +
            "&longitude=" +
            location.longitude +
            "&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m" +
            "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
            "&timezone=auto" +
            "&forecast_days=4";


        const response =
            await fetch(url);


        if (!response.ok) {

            throw new Error(
                "Weather service unavailable."
            );
        }


        const data =
            await response.json();


        const current =
            data.current;


        const daily =
            data.daily;


        const condition =
            weatherDescription(
                current.weather_code
            );


        let weatherText =

`Weather for ${location.name}

🌡️ Temperature: ${Math.round(current.temperature_2m)}°C
🌡️ Feels like: ${Math.round(current.apparent_temperature)}°C
☁️ Conditions: ${condition}
💧 Humidity: ${current.relative_humidity_2m}%
🌧️ Rain now: ${current.rain} mm
💨 Wind: ${Math.round(current.wind_speed_10m)} km/h

Forecast:

`;


        for (
            let i = 0;
            i < daily.time.length;
            i++
        ) {

            const date =
                new Date(
                    daily.time[i]
                );


            const day =
                i === 0
                    ? "Today"
                    : date.toLocaleDateString(
                        "en-GB",
                        {
                            weekday:
                                "long"
                        }
                    );


            weatherText +=

`${day}: ${Math.round(daily.temperature_2m_min[i])}–${Math.round(daily.temperature_2m_max[i])}°C, ${weatherDescription(daily.weather_code[i])}, ${daily.precipitation_probability_max[i]}% chance of rain
`;
        }


        log(
            "JARVIS",
            weatherText
        );


        const spoken =
            `In ${location.name}, it's ${Math.round(current.temperature_2m)} degrees and ${condition}. The wind is ${Math.round(current.wind_speed_10m)} kilometres per hour, with a ${daily.precipitation_probability_max[0]} percent chance of rain today.`;


        speak(
            spoken
        );


        state(
            "WEATHER READY"
        );

        $("status").textContent =
            "Weather updated.";

    } catch (error) {

        log(
            "JARVIS ERROR",
            error.message
        );

        speak(
            "Sorry, I couldn't get the weather right now."
        );

        state(
            "WEATHER ERROR"
        );

    }
}


// ======================================================
// GEMINI
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

                method: "POST",

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
                                300,

                            thinkingConfig: {

                                thinkingLevel:
                                    "low"

                            }

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

        const error =
            new Error(
                "Gemini returned no text."
            );

        error.status =
            503;

        throw error;
    }


    return answer;
}


function isTemporaryError(error) {

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
            "resource exhausted"
        )
    );
}


async function askGemini(
    question
) {

    const apiKey =
        getApiKey();


    if (!apiKey) {

        throw new Error(
            "No API key is saved. Open Settings and add your Gemini key."
        );
    }


    const contents = [];


    const systemPrompt =

`You are JARVIS, a fast personal AI assistant.

Be concise, natural and useful.

Keep most answers under about 100 words unless the user asks for detail.

You are running inside a Chromebook web app.

You can perform browser actions only when the application code explicitly provides them.

Do not pretend you performed an action that you didn't perform.

The application handles weather, time, Google searches, YouTube searches and opening websites directly.

User request:
${question}`;


    contents.push({

        role: "user",

        parts: [
            {
                text: systemPrompt
            }
        ]
    });


    const recent =
        history.slice(
            -MAX_HISTORY
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
        i < MODELS.length;
        i++
    ) {

        const model =
            MODELS[i];


        try {

            if (i > 0) {

                state(
                    "SWITCHING AI",
                    "thinking"
                );

                $("status").textContent =
                    `Switching to ${model}…`;
            }


            return {

                answer:
                    await requestGemini(
                        model,
                        apiKey,
                        contents
                    ),

                model
            };


        } catch (error) {

            lastError =
                error;


            console.warn(
                model,
                error
            );


            if (
                !isTemporaryError(
                    error
                )
            ) {

                throw error;
            }
        }
    }


    throw (
        lastError ||
        new Error(
            "All Gemini models are currently unavailable."
        )
    );
}


// ======================================================
// COMMAND HANDLER
// ======================================================

async function handle(text) {

    const lower =
        text.toLowerCase().trim();


    // TIME
    if (
        lower.includes("what time") ||
        lower === "time"
    ) {

        tellTime();

        return;
    }


    // WEATHER
    if (
        lower === "weather" ||
        lower.includes("weather today") ||
        lower.includes("what's the weather") ||
        lower.includes("what is the weather") ||
        lower.includes("how's the weather") ||
        lower.includes("how is the weather")
    ) {

        let place = "";


        const match =
            text.match(
                /(?:weather|forecast)\s+(?:in|for|at)\s+(.+)/i
            );


        if (match) {
            place =
                match[1].trim();
        }


        await showWeather(
            place
        );

        return;
    }


    // OPEN YOUTUBE
    if (
        lower.includes(
            "open youtube"
        )
    ) {

        openWebsite(
            "https://www.youtube.com",
            "YouTube"
        );

        return;
    }


    // OPEN GOOGLE
    if (
        lower.includes(
            "open google"
        )
    ) {

        openWebsite(
            "https://www.google.com",
            "Google"
        );

        return;
    }


    // OPEN GMAIL
    if (
        lower.includes(
            "open gmail"
        )
    ) {

        openWebsite(
            "https://mail.google.com",
            "Gmail"
        );

        return;
    }


    // SEARCH GOOGLE
    const googleMatch =
        text.match(
            /^search google for\s+(.+)/i
        );


    if (googleMatch) {

        google(
            googleMatch[1]
        );

        speak(
            "Searching Google."
        );

        return;
    }


    // SEARCH YOUTUBE
    const youtubeMatch =
        text.match(
            /^search youtube for\s+(.+)/i
        );


    if (youtubeMatch) {

        youtube(
            youtubeMatch[1]
        );

        speak(
            "Searching YouTube."
        );

        return;
    }


    // OPEN COMMON WEBSITES
    const websites = {

        "open netflix":
            [
                "https://www.netflix.com",
                "Netflix"
            ],

        "open spotify":
            [
                "https://open.spotify.com",
                "Spotify"
            ],

        "open amazon":
            [
                "https://www.amazon.co.uk",
                "Amazon"
            ],

        "open github":
            [
                "https://github.com",
                "GitHub"
            ],

        "open microsoft":
            [
                "https://www.microsoft.com",
                "Microsoft"
            ],

        "open outlook":
            [
                "https://outlook.live.com",
                "Outlook"
            ]

    };


    for (
        const command in websites
    ) {

        if (
            lower.includes(
                command
            )
        ) {

            openWebsite(
                websites[command][0],
                websites[command][1]
            );

            return;
        }
    }


    // OTHERWISE ASK GEMINI
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

    if (busy) {
        return;
    }


    busy = true;


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
            MAX_HISTORY * 2
        ) {

            history =
                history.slice(
                    -(MAX_HISTORY * 2)
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
            `Response from ${response.model}.`;


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

        busy = false;
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


        if (!text) {
            return;
        }


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
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();

            $("sendBtn").click();
        }
    }
);


// CLEAR CHAT
$("clearBtn").onclick =
    () => {

        $("chat").innerHTML =
            "";

        history =
            [];

        localStorage.removeItem(
            "jarvis_history"
        );

        log(
            "JARVIS",
            "Conversation cleared."
        );
    };


// SETTINGS
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

                        tellTime();

                    }


                    if (
                        command ===
                        "weather"
                    ) {

                        await showWeather();

                    }


                    if (
                        command ===
                        "search"
                    ) {

                        const q =
                            prompt(
                                "Search Google for:"
                            );

                        if (q) {
                            google(q);
                        }

                    }


                    if (
                        command ===
                        "youtube"
                    ) {

                        const q =
                            prompt(
                                "Search YouTube for:"
                            );

                        if (q) {
                            youtube(q);
                        }

                    }

                };
        }
    );


// ======================================================
// START
// ======================================================

function startJarvis() {

    const apiKey =
        getApiKey();


    try {

        history =
            JSON.parse(
                localStorage.getItem(
                    "jarvis_history"
                ) || "[]"
            );

    } catch {

        history = [];
    }


    $("keyStatus").textContent =
        apiKey
            ? "KEY: SET"
            : "KEY: NOT SET";


    if (!history.length) {

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

                        item.role === "user"
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
```
