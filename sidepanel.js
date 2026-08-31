const $ = id => document.getElementById(id);
const MODEL = "gemini-3.6-flash";
let recognition = null;
let listening = false;
let wakeMode = true;
let busy = false;
let history = [];

function log(who, text) {
  const div = document.createElement("div");
  div.className = `msg ${who === "YOU" ? "user" : "ai"}`;
  div.innerHTML = `<div class="who">${who}</div><div></div>`;
  div.querySelector("div:last-child").textContent = text;
  $("chat").appendChild(div);
  $("chat").scrollTop = $("chat").scrollHeight;
}
function state(text, mode="") {
  $("state").textContent = text;
  $("reactor").className = "reactor " + mode;
}
function speak(text) {
  const s = new SpeechSynthesisUtterance(text);
  chrome.storage.local.get(["settings"]).then(({settings={}})=>{
    s.rate = Number(settings.voiceRate || 1.05);
    s.pitch = .9;
    if(settings.speak !== false) speechSynthesis.speak(s);
  });
}
function stopVoice(){ speechSynthesis.cancel(); state("READY"); $("aiStatus").textContent="AI: READY"; }
function initRecognition(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){ $("status").textContent="Speech recognition is not available here. Use typing."; return; }
  recognition = new SR();
  recognition.lang = "en-GB";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.onstart = ()=>{ listening=true; $("micBtn").textContent="⏹ Stop listening"; $("micBtn").classList.add("active"); $("status").textContent="Listening…"; state(wakeMode?"LISTENING FOR JARVIS":"LISTENING","listening"); };
  recognition.onend = ()=>{ if(listening){ try{recognition.start()}catch(e){} } };
  recognition.onerror = e=>{ $("status").textContent = "Microphone: " + e.error; if(e.error==="not-allowed"){listening=false; $("micBtn").textContent="🎙 Start listening";} };
  recognition.onresult = e=>{
    let finalText="";
    for(let i=e.resultIndex;i<e.results.length;i++){
      if(e.results[i].isFinal) finalText += e.results[i][0].transcript;
    }
    finalText=finalText.trim();
    if(!finalText) return;
    if(wakeMode){
      if(/\bjarvis\b/i.test(finalText)){
        wakeMode=false;
        state("LISTENING FOR COMMAND","listening");
        $("status").textContent="Go ahead.";
        speak("Yes?");
      }
      return;
    }
    wakeMode=true;
    log("YOU",finalText);
    handle(finalText);
  };
}
function toggleMic(){
  if(!recognition) initRecognition();
  if(!recognition) return;
  if(listening){ listening=false; try{recognition.stop()}catch(e){} $("micBtn").textContent="🎙 Start listening"; state("READY"); $("status").textContent="Say “Jarvis” or type a message."; return; }
  try{recognition.start()}catch(e){}
}
function google(q){ chrome.tabs.create({url:"https://www.google.com/search?q="+encodeURIComponent(q)}); }
function youtube(q){ chrome.tabs.create({url:"https://www.youtube.com/results?search_query="+encodeURIComponent(q)}); }
function weather(){ google("weather today"); }
function time(){ speak("It is " + new Date().toLocaleTimeString("en-GB",{hour:"numeric",minute:"2-digit"})); }
async function currentPage(){
  const tabs=await chrome.tabs.query({active:true,currentWindow:true});
  if(!tabs[0]?.id) return "";
  try{
    const r=await chrome.scripting.executeScript({target:{tabId:tabs[0].id},func:()=>document.body?.innerText?.slice(0,30000)||""});
    return r?.[0]?.result||"";
  }catch(e){return "";}
}
async function handle(text){
  const l=text.toLowerCase();
  if(l.includes("what time")){time();return;}
  if(l.includes("open youtube")){chrome.tabs.create({url:"https://www.youtube.com"});speak("Opening YouTube.");return;}
  if(l.includes("open google")){chrome.tabs.create({url:"https://www.google.com"});speak("Opening Google.");return;}
  if(l.includes("open gmail")){chrome.tabs.create({url:"https://mail.google.com"});speak("Opening Gmail.");return;}
  if(l.startsWith("search google for")){google(text.replace(/search google for/i,"").trim());return;}
  if(l.startsWith("search youtube for")){youtube(text.replace(/search youtube for/i,"").trim());return;}
  if(l.includes("weather")){weather();return;}
  const rm=text.match(/remind me in\s+(\d+(?:\.\d+)?)\s*(minute|minutes|hour|hours)\s*(?:to\s*)?(.*)/i);
  if(rm){
    let mins=Number(rm[1])*(rm[2].toLowerCase().startsWith("hour")?60:1);
    const msg=rm[3]||"Your reminder";
    chrome.runtime.sendMessage({type:"createReminder",text:msg,minutes:mins});
    speak(`Okay. I’ll remind you in ${rm[1]} ${rm[2]}.`);
    return;
  }
  if(l.includes("summarise this page")||l.includes("summarize this page")){
    const p=await currentPage();
    if(!p){speak("I couldn't read the current page.");return;}
    ask("Summarise this webpage clearly and briefly:\n\n"+p);return;
  }
  await ask(text);
}
async function ask(question){
  if(busy)return;
  busy=true; state("THINKING","thinking"); $("aiStatus").textContent="AI: THINKING"; $("status").textContent="Working…";
  const {apiKey,settings={}}=await chrome.storage.local.get(["apiKey","settings"]);
  if(!apiKey){busy=false;state("SETUP NEEDED");$("status").textContent="Add your Gemini API key in ⚙ Settings."; $("aiStatus").textContent="AI: NO KEY"; return;}
  const contents=[];
  contents.push({role:"user",parts:[{text:`You are JARVIS, a personal AI assistant on a Chromebook. Be concise, natural and useful because your answers are spoken aloud. Do not claim actions you cannot perform. Answer in plain spoken language.\n\nUser request: ${question}`}]});
  const recent=history.slice(-8);
  for(const h of recent) contents.push({role:h.role,parts:[{text:h.text}]});
  try{
    const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,{
      method:"POST",
      headers:{"Content-Type":"application/json","x-goog-api-key":apiKey},
      body:JSON.stringify({contents,generationConfig:{maxOutputTokens:350}})
    });
    const data=await res.json();
    if(!res.ok) throw new Error(data?.error?.message||("HTTP "+res.status));
    const answer=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("").trim()||"I didn't get a response.";
    history.push({role:"user",text:question},{role:"model",text:answer});
    if(history.length>20) history=history.slice(-20);
    await chrome.storage.local.set({history});
    log("JARVIS",answer); state("SPEAKING","speaking"); $("aiStatus").textContent="AI: SPEAKING"; $("status").textContent="Response ready."; speak(answer);
  }catch(e){
    log("JARVIS ERROR",e.message); state("AI ERROR"); $("aiStatus").textContent="AI: ERROR"; $("status").textContent=e.message;
  }finally{busy=false;}
}
async function pending(){
  const {pendingPrompt}=await chrome.storage.local.get(["pendingPrompt"]);
  if(pendingPrompt){await chrome.storage.local.remove("pendingPrompt"); log("JARVIS", "I’m working on the selected page/text…"); ask(pendingPrompt);}
}
$("micBtn").onclick=toggleMic;
$("stopBtn").onclick=stopVoice;
$("sendBtn").onclick=()=>{const t=$("input").value.trim();if(t){$("input").value="";log("YOU",t);handle(t);}};
$("input").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("sendBtn").click();}});
$("clearBtn").onclick=()=>{$("chat").innerHTML="";history=[];chrome.storage.local.remove("history");};
$("settingsBtn").onclick = () => {
    window.location.href = "settings.html";
};
$("quick").onclick=()=>{};
document.querySelectorAll(".quick button").forEach(b=>b.onclick=async()=>{
  const c=b.dataset.cmd;
  if(c==="time") time();
  if(c==="search"){const q=prompt("Search Google for:");if(q)google(q);}
  if(c==="youtube"){const q=prompt("Search YouTube for:");if(q)youtube(q);}
  if(c==="weather") weather();
  if(c==="reminder"){const mins=prompt("Minutes from now:");const text=prompt("Reminder:");if(mins&&text){chrome.runtime.sendMessage({type:"createReminder",text,minutes:Number(mins)});speak("Reminder set.");}}
  if(c==="page"){const p=await currentPage();if(p)ask("Summarise this webpage:\n\n"+p);else speak("I couldn't read this page.");}
});
chrome.storage.local.get(["apiKey","history"]).then(({apiKey,history:h=[]})=>{
  $("keyStatus").textContent=apiKey?"KEY: SET":"KEY: NOT SET";
  history=h||[];
  if(!history.length) log("JARVIS","System ready. Say “Jarvis” or type a command.");
  else history.slice(-6).forEach(x=>log(x.role==="user"?"YOU":"JARVIS",x.text));
  initRecognition();
  pending();
});
