// Подстраховка для старых Safari/WebKit (Telegram на старом macOS показывает мини-приложение системным WebKit).
// 1) Мелкие полифилы того, что Next.js использует без своих полифилов.
// 2) На /crm: если страница не запустилась — плашка со всеми ошибками и диагностикой вместо вечного «Загружаем…».
// Простой ES5 без зависимостей: выполняется до бандлов Next.
export const LEGACY_SCRIPT = `(function(){
try{
if(typeof window.structuredClone!=="function"){window.structuredClone=function(v){return v===undefined?undefined:JSON.parse(JSON.stringify(v));};}
if(window.AbortSignal&&typeof AbortSignal.timeout!=="function"&&typeof AbortController==="function"){AbortSignal.timeout=function(ms){var c=new AbortController();setTimeout(function(){c.abort();},ms);return c.signal;};}
if(window.crypto&&typeof crypto.randomUUID!=="function"&&crypto.getRandomValues){crypto.randomUUID=function(){var b=crypto.getRandomValues(new Uint8Array(16));b[6]=b[6]&15|64;b[8]=b[8]&63|128;var h=[];for(var i=0;i<16;i++)h.push((b[i]+256).toString(16).slice(1));return h.slice(0,4).join("")+"-"+h.slice(4,6).join("")+"-"+h.slice(6,8).join("")+"-"+h.slice(8,10).join("")+"-"+h.slice(10).join("");};}
}catch(e){}
if(location.pathname.indexOf("/crm")!==0)return;
var errs=[];
function short(s){s=String(s||"");var i=s.lastIndexOf("/");return i>=0?s.slice(i+1):s;}
function render(){if(window.__crmMounted)return;try{var d=document.getElementById("crm-fatal");if(!d){d=document.createElement("div");d.id="crm-fatal";d.style.cssText="position:fixed;left:12px;right:12px;bottom:12px;z-index:99999;background:#fff;border:2px solid #B42318;border-radius:12px;padding:12px;font:13px/1.4 -apple-system,sans-serif;color:#191715;max-height:60vh;overflow:auto;white-space:pre-wrap;user-select:text;-webkit-user-select:text";(document.body||document.documentElement).appendChild(d);}
var chunks=0;try{chunks=(self.webpackChunk_N_E||[]).length;}catch(e){}
var diag="скрипты: "+document.scripts.length+", загружено частей: "+chunks+", next_f: "+(self.__next_f?self.__next_f.length:"нет")+", Telegram: "+(window.Telegram&&window.Telegram.WebApp?("да "+(window.Telegram.WebApp.version||"")):"нет");
d.textContent="CRM не запустилась на этом устройстве. Пришлите скриншот:\\n"+(errs.length?errs.join("\\n"):"ошибок нет")+"\\n"+diag+"\\n"+navigator.userAgent;}catch(e){}}
window.addEventListener("error",function(e){var t=e&&e.target;if(t&&t!==window&&(t.src||t.href)){errs.push("не загрузился файл: "+short(t.src||t.href));}else{errs.push((e&&e.message||"ошибка")+" @ "+short(e&&e.filename)+":"+(e&&e.lineno)+":"+(e&&e.colno));}if(errs.length>8)errs.length=8;render();},true);
window.addEventListener("unhandledrejection",function(e){var r=e&&e.reason;errs.push("promise: "+((r&&r.message)||r)+(r&&r.stack?" | "+String(r.stack).split("\\n")[0]:""));render();});
var ce=console.error;console.error=function(){try{if(!window.__crmMounted){var a=[];for(var i=0;i<arguments.length;i++){var x=arguments[i];a.push(x&&x.message?x.message:String(x).slice(0,200));}errs.push("console: "+a.join(" "));if(errs.length>8)errs.length=8;}}catch(e){}return ce.apply(console,arguments);};
setTimeout(function(){if(!window.__crmMounted){errs.push("страница не запустилась за 8 секунд");render();}},8000);
})();`;
